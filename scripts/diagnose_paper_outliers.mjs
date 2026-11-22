#!/usr/bin/env node
/**
 * Diagnostic Outlier Audit for Ti-6Al-4V Literature Corpus (Read-Only on CSVs)
 *
 * Joins:
 *   - data/ti64_papers.csv
 *   - data/ti64_process_parameters.csv
 *   - data/ti64_thermal_physics.csv
 *   - data/ti64_microstructure.csv
 *   - data/ti64_mechanical_properties.csv
 *   - data/pinn_ti64_weights.json (optional calibrated residuals)
 *
 * Ranks the Top 10 highest-error records against physics + calibrated ML predictions,
 * tags divergence root causes automatically, compares cohort MAPE% before vs. after
 * hygiene filtering, and saves the structured report to data/outlier_diagnostic_report.json.
 */

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, 'data');
const WEIGHTS_PATH = path.join(DATA_DIR, 'pinn_ti64_weights.json');
const REPORT_PATH = path.join(DATA_DIR, 'outlier_diagnostic_report.json');

const CATALOG_DUP_IDS = new Set([118, 127, 132, 135, 145, 153, 109, 115, 131, 151]);
const NON_TI64_IDS = new Set([159, 161, 171, 184, 200]);

/**
 * RFC-4180 compliant CSV parser handling quoted fields and escaped quotes.
 */
function parseCsvRfc4180(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < text.length && text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field.trim());
      field = '';
    } else if (ch === '\r') {
      if (i + 1 < text.length && text[i + 1] === '\n') i++;
      row.push(field.trim());
      if (row.some((c) => c.length > 0)) rows.push(row);
      row = [];
      field = '';
    } else if (ch === '\n') {
      row.push(field.trim());
      if (row.some((c) => c.length > 0)) rows.push(row);
      row = [];
      field = '';
    } else {
      field += ch;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field.trim());
    if (row.some((c) => c.length > 0)) rows.push(row);
  }
  if (rows.length === 0) return [];
  const headers = rows[0].map((h) => h.trim());
  return rows.slice(1).map((vals) => {
    const obj = {};
    for (let j = 0; j < headers.length; j++) {
      obj[headers[j]] = vals[j] !== undefined ? vals[j] : '';
    }
    return obj;
  });
}

function posNum(val) {
  if (val === null || val === undefined || val === '') return null;
  const n = Number.parseFloat(String(val).replace('%', '').trim());
  return Number.isFinite(n) && n > 0 ? n : null;
}

function clampFinite(val, lo, hi, fb) {
  return Number.isFinite(val) ? Math.max(lo, Math.min(hi, val)) : fb;
}

function normalizeProcess(rawProc) {
  const s = String(rawProc || '').toLowerCase();
  if (/binder\s*jetting|\bbjt\b/.test(s)) return 'binder-jetting';
  if (/waam|wire\s*\+?\s*arc|gtaw|plasma-arc/.test(s)) return 'waam';
  if (/l-ded|laser\s*powder\s*ded|wire\s*ded|wire-laser\s*ded|\bded\b|lmd|lens/.test(s) && !/review|ebm/.test(s)) {
    return 'ded-laser';
  }
  if (/lpbf|l-pbf|slm|pbf|dmls|am\s*\//.test(s)) return 'lpbf';
  return 'other';
}

function normalizePostProcessing(rawCond) {
  const s = String(rawCond || '').toLowerCase();
  if (/bi-?modal|\bsta\b|solution|aged/.test(s)) return 'Solution-Aged';
  if (/\bhip\b/.test(s)) return 'HIP';
  if (/anneal/.test(s)) return 'Annealed';
  if (/stress/.test(s)) return 'Stress-Relieved';
  return 'As-Built';
}

function computePhysicsPrior(rec) {
  const proc = rec.normProcess === 'other' ? 'lpbf' : rec.normProcess;
  const post = rec.normPost;
  const isWaam = proc === 'waam';
  const isDed = proc === 'ded-laser';
  const isBj = proc === 'binder-jetting';

  const P = rec.P || (isWaam ? 2200 : isDed ? 1500 : isBj ? 120 : 250);
  const v = rec.v || (isWaam ? 8 : isDed ? 15 : isBj ? 300 : 1000);
  const h = rec.h || (isWaam ? 3400 : isDed ? 1100 : 100);
  const t = rec.t || (isWaam ? 1400 : isDed ? 450 : 30);
  const T0 = rec.T0 || (isWaam || isDed ? 120 : 200);

  let coolingRateKs = rec.coolingRateKs;
  const ved = isBj ? 0 : (P * 1e6) / Math.max(1, v * h * t);

  if (!coolingRateKs) {
    if (isBj) {
      coolingRateKs = 0.08;
    } else {
      const kTherm = 21.9;
      const eta = isWaam ? 0.78 : (isDed ? 0.38 : 0.42);
      const accum = isWaam ? 0.55 : (isDed ? 0.85 : 1.0);
      const deltaT = Math.max(50, 1660 - T0);
      const vMs = Math.max(0.001, v / 1000.0);
      coolingRateKs = Math.max(
        isWaam || isDed ? 1.0 : 100.0,
        (accum * 2 * Math.PI * kTherm * vMs * deltaT * deltaT) / Math.max(5, P * eta)
      );
    }
  }

  let lathUm = rec.alphaLathWidthUm;
  if (!lathUm) {
    const baseLath = isBj ? 2.5 : Math.max(0.45, 35.5 * Math.pow(Math.max(10, coolingRateKs), -0.28));
    const postMult = post === 'HIP' ? 2.25 : post === 'Annealed' ? 1.75 : post === 'Stress-Relieved' ? 1.25 : post === 'Solution-Aged' ? 1.45 : 1.0;
    lathUm = clampFinite(baseLath * postMult, 0.4, 6.0, 1.5);
  }

  const eliFactor = rec.isEli ? 0.91 : 1.0;
  const sigma0 = (isBj ? 660 : isWaam ? 705 : isDed ? 720 : 755) * eliFactor;
  const kHp = 215.0 * eliFactor;
  let ysPrior = sigma0 + kHp / Math.sqrt(Math.max(0.35, lathUm));
  if (post === 'HIP') ysPrior *= isWaam ? 0.88 : isDed ? 0.89 : 0.90;
  else if (post === 'Annealed') ysPrior *= isWaam ? 0.90 : isDed ? 0.91 : 0.93;
  else if (post === 'Stress-Relieved') ysPrior *= 0.98;
  else if (post === 'Solution-Aged') ysPrior *= 1.04;
  else if (isBj) ysPrior = 700 * eliFactor;

  const taborFactor = post === 'HIP' ? 2.95 : post === 'Annealed' ? 3.00 : post === 'Solution-Aged' ? 3.06 : post === 'Stress-Relieved' ? 3.04 : (isWaam || isDed ? 3.02 : 3.12);
  const utsToYs = post === 'HIP' ? 1.11 : post === 'Annealed' ? 1.11 : (isWaam || isDed ? 1.11 : 1.13);
  const utsPrior = ysPrior * utsToYs;
  const hvPrior = isBj
    ? (post === 'HIP' ? 331 : 284)
    : clampFinite(utsPrior / taborFactor, 260, 440, 355);

  const elMap = {
    lpbf: { 'As-Built': 7.5, 'Stress-Relieved': 9.8, Annealed: 13.0, HIP: 15.6, 'Solution-Aged': 13.8 },
    'ded-laser': { 'As-Built': 11.4, 'Stress-Relieved': 12.2, Annealed: 13.8, HIP: 15.0, 'Solution-Aged': 13.5 },
    waam: { 'As-Built': 12.0, 'Stress-Relieved': 13.0, Annealed: 14.0, HIP: 14.4, 'Solution-Aged': 15.0 },
    'binder-jetting': { 'As-Built': 7.5, 'Stress-Relieved': 9.0, Annealed: 11.0, HIP: 12.3, 'Solution-Aged': 11.5 }
  };
  const elPrior = (elMap[proc] && elMap[proc][post]) || 11.5;
  const denPrior = isBj ? (post === 'HIP' ? 99.75 : 96.0) : (post === 'HIP' ? 99.92 : 99.75);

  return {
    P, v, h, t, T0, ved, coolingRateKs, lathUm,
    hardness_hv: hvPrior,
    ys_mpa: ysPrior,
    uts_mpa: utsPrior,
    elongation_pct: elPrior,
    relative_density_pct: denPrior
  };
}

function applyCalibratedWeights(calibratedResiduals, rec, prior) {
  const proc = rec.normProcess === 'other' ? 'lpbf' : rec.normProcess;
  const post = rec.normPost;
  const preds = {};

  for (const prop of ['hardness_hv', 'ys_mpa', 'uts_mpa', 'elongation_pct', 'relative_density_pct']) {
    const baseVal = prior[prop];
    const model = calibratedResiduals?.[proc]?.[prop];
    if (!model) {
      preds[prop] = baseVal;
      continue;
    }
    let rawDelta = 0;
    if (model.mode === 'parametric_ridge' && Array.isArray(model.weights)) {
      const w = model.weights;
      const x = [
        1,
        Math.log10(Math.max(10, prior.P)),
        Math.log10(Math.max(1, prior.v)),
        Math.log10(Math.max(10, prior.h)),
        Math.log10(Math.max(10, prior.t)),
        prior.T0 / 200.0,
        Math.log10(Math.max(1, prior.ved || 50)),
        post === 'Stress-Relieved' ? 1 : 0,
        post === 'Annealed' ? 1 : 0,
        post === 'HIP' ? 1 : 0,
        post === 'Solution-Aged' ? 1 : 0,
        rec.isEli ? 1 : 0
      ];
      for (let i = 0; i < Math.min(w.length, x.length); i++) rawDelta += w[i] * x[i];
    } else {
      rawDelta = model.conditionOffsets?.[post] ?? model.defaultOffset ?? 0;
    }
    const cap = prop === 'hardness_hv' ? 22 : (prop === 'ys_mpa' || prop === 'uts_mpa' ? 85 : (prop === 'elongation_pct' ? 2.5 : 1.2));
    preds[prop] = baseVal + cap * Math.tanh(rawDelta / Math.max(1e-6, cap));
  }
  return preds;
}

function groupByKey(rows, keyName) {
  const map = new Map();
  for (const r of rows) {
    const k = String(r[keyName] || '').trim();
    if (!k) continue;
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(r);
  }
  return map;
}

function classifyOutlierTags(rec, sigCounts, mechSig) {
  const tags = [];
  const pnInt = Number.parseInt(rec.paperId, 10);

  // 1. UNEXTRACTED_OR_ZERO_PARAMS
  if (rec.P === null || rec.v === null || rec.h === null || rec.t === null) {
    tags.push('UNEXTRACTED_OR_ZERO_PARAMS');
  }

  // 2. PLACEHOLDER_MECH_VALUES
  if ((mechSig && (sigCounts.get(mechSig) || 0) >= 2) || (pnInt >= 179 && pnInt <= 214)) {
    tags.push('PLACEHOLDER_MECH_VALUES');
  }

  // 3. CATALOG_HYGIENE_FLAG
  const isPorousOrLattice = /lattice|porous|scaffold|bone growth|osseointegration/i.test(`${rec.title} ${rec.mechNotes}`) ||
    (rec.hardness_hv >= 330 && rec.ys_mpa !== null && rec.ys_mpa < 400);
  if (
    CATALOG_DUP_IDS.has(pnInt) ||
    NON_TI64_IDS.has(pnInt) ||
    (pnInt >= 59 && pnInt <= 78) ||
    isPorousOrLattice
  ) {
    tags.push('CATALOG_HYGIENE_FLAG');
  }

  // 4. MISSING_OXYGEN_OR_ORIENTATION
  const dirLow = String(rec.testDirection || '').toLowerCase();
  const isVerticalOrAniso = rec.buildOrientationDeg === 90 ||
    /vertical|z\b|compression|crack|across/.test(dirLow);
  if (rec.oxygenWtPct === null || isVerticalOrAniso) {
    tags.push('MISSING_OXYGEN_OR_ORIENTATION');
  }

  // 5. EXTREME_ENERGY_OOD
  if (rec.normProcess === 'lpbf' && rec.vedMeasured !== null && (rec.vedMeasured < 35 || rec.vedMeasured > 120)) {
    tags.push('EXTREME_ENERGY_OOD');
  } else if (rec.normProcess === 'waam' && rec.hiMeasured !== null && (rec.hiMeasured < 120 || rec.hiMeasured > 600)) {
    tags.push('EXTREME_ENERGY_OOD');
  } else if (rec.normProcess === 'ded-laser' && rec.hiMeasured !== null && (rec.hiMeasured < 75 || rec.hiMeasured > 240)) {
    tags.push('EXTREME_ENERGY_OOD');
  }

  // 6. UNMODELED_HEAT_TREATMENT
  const condRaw = String(rec.rawCondition || '').toLowerCase();
  if (/shock\s*peen|lsp|polished|interpass-rolled|preheat|950°?c|400°?c|500°?c|850°?c/.test(condRaw)) {
    tags.push('UNMODELED_HEAT_TREATMENT');
  }

  return Array.from(new Set(tags));
}

function main() {
  const papers = parseCsvRfc4180(fs.readFileSync(path.join(DATA_DIR, 'ti64_papers.csv'), 'utf8'));
  const params = parseCsvRfc4180(fs.readFileSync(path.join(DATA_DIR, 'ti64_process_parameters.csv'), 'utf8'));
  const thermal = parseCsvRfc4180(fs.readFileSync(path.join(DATA_DIR, 'ti64_thermal_physics.csv'), 'utf8'));
  const micro = parseCsvRfc4180(fs.readFileSync(path.join(DATA_DIR, 'ti64_microstructure.csv'), 'utf8'));
  const mech = parseCsvRfc4180(fs.readFileSync(path.join(DATA_DIR, 'ti64_mechanical_properties.csv'), 'utf8'));

  let weightsBundle = null;
  if (fs.existsSync(WEIGHTS_PATH)) {
    weightsBundle = JSON.parse(fs.readFileSync(WEIGHTS_PATH, 'utf8'));
  }
  const calibratedResiduals = weightsBundle?.calibrated_residuals || null;

  const paramByPaper = groupByKey(params, 'paper_number');
  const thermByPaper = groupByKey(thermal, 'paper_number');
  const microByPaper = groupByKey(micro, 'paper_number');
  const mechByPaper = groupByKey(mech, 'paper_number');

  // Precompute repeated tensile signatures across mechanical rows to catch copied/placeholder blocks
  const sigCounts = new Map();
  for (const m of mech) {
    if (!m.yield_strength_mpa && !m.ultimate_tensile_strength_mpa && !m.vickers_hardness_hv) continue;
    const sig = `${m.yield_strength_mpa}|${m.ultimate_tensile_strength_mpa}|${m.elongation_pct}|${m.vickers_hardness_hv}`;
    sigCounts.set(sig, (sigCounts.get(sig) || 0) + 1);
  }

  const joinedRecords = [];
  let fullyExtractedCount = 0;

  for (const p of papers) {
    const pid = String(p.paper_number || '').trim();
    const pRows = paramByPaper.get(pid) || [{}];
    const tRows = thermByPaper.get(pid) || [{}];
    const miRows = microByPaper.get(pid) || [{}];
    const mcRows = mechByPaper.get(pid) || [{}];

    const nVariants = Math.max(1, pRows.length, mcRows.length);
    for (let idx = 0; idx < nVariants; idx++) {
      const pr = pRows[idx] || pRows[0] || {};
      const th = tRows[idx] || tRows[0] || {};
      const mi = miRows[idx] || miRows[0] || {};
      const mc = mcRows[idx] || mcRows[0] || {};

      const variantId = mc.id || pr.id || `${pid}-V${idx + 1}`;
      const P = posNum(pr.laser_power_w);
      const v = posNum(pr.scan_speed_mms);
      const h = posNum(pr.hatch_spacing_um);
      const t = posNum(pr.layer_thickness_um);
      const vedMeasured = posNum(pr.volumetric_energy_density_j_mm3) || (P && v && h && t ? (P * 1e6) / (v * h * t) : null);
      const hiMeasured = (P && v) ? (P / v) : null;

      const hardness_hv = posNum(mc.vickers_hardness_hv);
      const ys_mpa = posNum(mc.yield_strength_mpa);
      const uts_mpa = posNum(mc.ultimate_tensile_strength_mpa);
      const elongation_pct = posNum(mc.elongation_pct);
      const relative_density_pct = posNum(mc.relative_density_pct);

      const normProcess = normalizeProcess(p.am_process);
      const rawCondition = mc.condition || mi.condition || '';
      const normPost = normalizePostProcessing(rawCondition);
      const oxygenWtPct = posNum(mc.oxygen_wt_pct) || posNum(pr.oxygen_wt_pct) || posNum(mi.oxygen_wt_pct);
      const buildOrientationDeg = mc.build_orientation_deg !== '' && mc.build_orientation_deg !== undefined
        ? Number.parseFloat(mc.build_orientation_deg)
        : null;

      const hasAllParams = Boolean(P && v && h && t);
      const hasAnyTarget = [hardness_hv, ys_mpa, uts_mpa, elongation_pct, relative_density_pct].some((x) => x !== null);
      if (hasAllParams && hasAnyTarget) fullyExtractedCount++;

      const rec = {
        paperId: pid,
        paperLabel: `P-${pid.padStart(2, '0')}`,
        variantId,
        authors: p.authors,
        year: p.year,
        title: p.title,
        rawProcess: p.am_process,
        normProcess,
        rawCondition: rawCondition || 'Unreported',
        normPost,
        material: p.material,
        isEli: /\beli\b|grade\s*23|f3001/i.test(`${p.material} ${p.title}`),
        P, v, h, t,
        T0: null,
        vedMeasured: vedMeasured ? Number(vedMeasured.toFixed(2)) : null,
        hiMeasured: hiMeasured ? Number(hiMeasured.toFixed(2)) : null,
        coolingRateKs: posNum(th.cooling_rate_k_s),
        alphaLathWidthUm: posNum(mi.alpha_lath_width_um) || posNum(mi.alpha_lath_thickness_um),
        oxygenWtPct,
        buildOrientationDeg: Number.isFinite(buildOrientationDeg) ? buildOrientationDeg : null,
        testDirection: mc.test_direction || '',
        mechNotes: `${mc.notes || ''} ${pr.notes || ''}`.trim(),
        experimental: { hardness_hv, ys_mpa, uts_mpa, elongation_pct, relative_density_pct }
      };

      const mechSig = (mc.yield_strength_mpa || mc.ultimate_tensile_strength_mpa || mc.vickers_hardness_hv)
        ? `${mc.yield_strength_mpa}|${mc.ultimate_tensile_strength_mpa}|${mc.elongation_pct}|${mc.vickers_hardness_hv}`
        : null;

      const prior = computePhysicsPrior(rec);
      const preds = applyCalibratedWeights(calibratedResiduals, rec, prior);
      const rootCauseTags = classifyOutlierTags(rec, sigCounts, mechSig);

      const metricErrors = {};
      let worstProp = null;
      let worstApePct = -1;
      let apeSum = 0;
      let apeCount = 0;

      for (const prop of ['hardness_hv', 'ys_mpa', 'uts_mpa', 'elongation_pct', 'relative_density_pct']) {
        const expVal = rec.experimental[prop];
        if (expVal === null) continue;
        const predVal = Number(preds[prop].toFixed(prop === 'elongation_pct' || prop === 'relative_density_pct' ? 2 : 1));
        const delta = Number((predVal - expVal).toFixed(prop === 'elongation_pct' || prop === 'relative_density_pct' ? 2 : 1));
        const apePct = Number(((Math.abs(delta) / Math.max(1e-6, expVal)) * 100).toFixed(2));
        metricErrors[prop] = { exp: expVal, pred: predVal, delta, apePct };
        apeSum += apePct;
        apeCount++;
        if (apePct > worstApePct) {
          worstApePct = apePct;
          worstProp = prop;
        }
      }

      joinedRecords.push({
        ...rec,
        predictions: {
          hardness_hv: Number(preds.hardness_hv.toFixed(1)),
          ys_mpa: Number(preds.ys_mpa.toFixed(1)),
          uts_mpa: Number(preds.uts_mpa.toFixed(1)),
          elongation_pct: Number(preds.elongation_pct.toFixed(2)),
          relative_density_pct: Number(preds.relative_density_pct.toFixed(2))
        },
        metricErrors,
        evaluatedMetricCount: apeCount,
        meanApePct: apeCount > 0 ? Number((apeSum / apeCount).toFixed(2)) : null,
        worstProperty: worstProp,
        worstApePct: worstApePct >= 0 ? worstApePct : null,
        rootCauseTags
      });
    }
  }

  const evaluatedRecords = joinedRecords.filter((r) => r.evaluatedMetricCount > 0);
  const rankedOutliers = evaluatedRecords
    .slice()
    .sort((a, b) => (b.worstApePct || 0) - (a.worstApePct || 0));

  const top10 = rankedOutliers.slice(0, 10);

  // Compute Cohort MAPE % before vs after excluding hygiene / placeholder / unextracted rows
  const computeCohortStats = (records) => {
    const byProp = {};
    for (const prop of ['hardness_hv', 'ys_mpa', 'uts_mpa', 'elongation_pct', 'relative_density_pct']) {
      const vals = records.map((r) => r.metricErrors[prop]?.apePct).filter((v) => Number.isFinite(v));
      byProp[prop] = {
        n: vals.length,
        mapePct: vals.length > 0 ? Number((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2)) : null
      };
    }
    const allApes = records.flatMap((r) => Object.values(r.metricErrors).map((m) => m.apePct));
    return {
      recordCount: records.length,
      metricEvaluations: allApes.length,
      overallMapePct: allApes.length > 0 ? Number((allApes.reduce((a, b) => a + b, 0) / allApes.length).toFixed(2)) : null,
      byProperty: byProp
    };
  };

  const cleanCohort = evaluatedRecords.filter((r) =>
    !r.rootCauseTags.includes('CATALOG_HYGIENE_FLAG') &&
    !r.rootCauseTags.includes('PLACEHOLDER_MECH_VALUES') &&
    !r.rootCauseTags.includes('UNEXTRACTED_OR_ZERO_PARAMS')
  );

  const beforeStats = computeCohortStats(evaluatedRecords);
  const afterStats = computeCohortStats(cleanCohort);

  // Tag breakdown across all 199 papers
  const tagCounts = {};
  for (const r of joinedRecords) {
    for (const tag of r.rootCauseTags) {
      tagCounts[tag] = (tagCounts[tag] || 0) + 1;
    }
  }

  const report = {
    generated_at: new Date().toISOString(),
    weights_loaded: Boolean(weightsBundle),
    weights_version: weightsBundle?.calibrated_model_version || 'physics_prior_only',
    corpus_summary: {
      total_papers: papers.length,
      total_joined_records: joinedRecords.length,
      fully_extracted_with_params_and_mech: fullyExtractedCount,
      incomplete_or_unextracted_records: joinedRecords.length - fullyExtractedCount,
      evaluated_records_with_any_metric: evaluatedRecords.length,
      clean_cohort_records_after_hygiene_filter: cleanCohort.length,
      flag_counts: tagCounts
    },
    cohort_mape_comparison: {
      before_filtering: beforeStats,
      after_excluding_hygiene_placeholder_unextracted: afterStats
    },
    top_10_outliers: top10.map((r, rankIdx) => ({
      rank: rankIdx + 1,
      paperId: r.paperLabel,
      numericPaperId: r.paperId,
      authorsYear: `${r.authors} (${r.year})`,
      process: r.normProcess,
      rawProcess: r.rawProcess,
      condition: r.rawCondition,
      worstProperty: r.worstProperty,
      expValue: r.metricErrors[r.worstProperty]?.exp ?? null,
      predValue: r.metricErrors[r.worstProperty]?.pred ?? null,
      delta: r.metricErrors[r.worstProperty]?.delta ?? null,
      apePct: r.worstApePct,
      meanApePct: r.meanApePct,
      rootCauseTags: r.rootCauseTags,
      allMetricErrors: r.metricErrors
    })),
    all_ranked_evaluated: rankedOutliers.map((r) => ({
      paperId: r.paperLabel,
      authorsYear: `${r.authors} (${r.year})`,
      process: r.normProcess,
      condition: r.rawCondition,
      worstProperty: r.worstProperty,
      worstApePct: r.worstApePct,
      meanApePct: r.meanApePct,
      rootCauseTags: r.rootCauseTags,
      metricErrors: r.metricErrors
    }))
  };

  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2), 'utf8');

  // Print clean formatted console summary
  console.log('\n=== Ti-6Al-4V Literature Outlier Diagnostic Audit ===');
  console.log(
    `Total Papers: ${papers.length} | Fully Extracted (P,v,h,t + Mech): ${fullyExtractedCount} | Incomplete/Unextracted: ${joinedRecords.length - fullyExtractedCount} | Evaluated (>=1 target): ${evaluatedRecords.length}`
  );
  console.log('Root-Cause Flag Counts across 199 rows:', tagCounts);
  console.log('\n--- TOP 10 HIGHEST-ERROR RECORDS ---');

  const tableRows = top10.map((r, i) => {
    const m = r.metricErrors[r.worstProperty];
    return {
      '#': i + 1,
      'Paper ID': r.paperLabel,
      'Authors (Year)': `${r.authors} (${r.year})`.slice(0, 26),
      Process: r.normProcess,
      Condition: r.rawCondition.slice(0, 24),
      'Worst Property': r.worstProperty,
      'Exp vs. Pred': `${m.exp} vs ${m.pred}`,
      'APE %': `${m.apePct.toFixed(1)}%`,
      'Root Cause Tags': r.rootCauseTags.join(', ')
    };
  });
  console.table(tableRows);

  console.log('--- COHORT MAPE % BEFORE vs. AFTER EXCLUDING HYGIENE / PLACEHOLDER / UNEXTRACTED ---');
  console.table([
    {
      Cohort: 'Before Filtering (All Evaluated)',
      Records: beforeStats.recordCount,
      'Overall MAPE %': `${beforeStats.overallMapePct}%`,
      'HV MAPE': beforeStats.byProperty.hardness_hv.mapePct !== null ? `${beforeStats.byProperty.hardness_hv.mapePct}% (n=${beforeStats.byProperty.hardness_hv.n})` : 'N/A',
      'YS MAPE': beforeStats.byProperty.ys_mpa.mapePct !== null ? `${beforeStats.byProperty.ys_mpa.mapePct}% (n=${beforeStats.byProperty.ys_mpa.n})` : 'N/A',
      'UTS MAPE': beforeStats.byProperty.uts_mpa.mapePct !== null ? `${beforeStats.byProperty.uts_mpa.mapePct}% (n=${beforeStats.byProperty.uts_mpa.n})` : 'N/A',
      'Elong MAPE': beforeStats.byProperty.elongation_pct.mapePct !== null ? `${beforeStats.byProperty.elongation_pct.mapePct}% (n=${beforeStats.byProperty.elongation_pct.n})` : 'N/A',
      'Den MAPE': beforeStats.byProperty.relative_density_pct.mapePct !== null ? `${beforeStats.byProperty.relative_density_pct.mapePct}% (n=${beforeStats.byProperty.relative_density_pct.n})` : 'N/A'
    },
    {
      Cohort: 'After Clean Filter',
      Records: afterStats.recordCount,
      'Overall MAPE %': `${afterStats.overallMapePct}%`,
      'HV MAPE': afterStats.byProperty.hardness_hv.mapePct !== null ? `${afterStats.byProperty.hardness_hv.mapePct}% (n=${afterStats.byProperty.hardness_hv.n})` : 'N/A',
      'YS MAPE': afterStats.byProperty.ys_mpa.mapePct !== null ? `${afterStats.byProperty.ys_mpa.mapePct}% (n=${afterStats.byProperty.ys_mpa.n})` : 'N/A',
      'UTS MAPE': afterStats.byProperty.uts_mpa.mapePct !== null ? `${afterStats.byProperty.uts_mpa.mapePct}% (n=${afterStats.byProperty.uts_mpa.n})` : 'N/A',
      'Elong MAPE': afterStats.byProperty.elongation_pct.mapePct !== null ? `${afterStats.byProperty.elongation_pct.mapePct}% (n=${afterStats.byProperty.elongation_pct.n})` : 'N/A',
      'Den MAPE': afterStats.byProperty.relative_density_pct.mapePct !== null ? `${afterStats.byProperty.relative_density_pct.mapePct}% (n=${afterStats.byProperty.relative_density_pct.n})` : 'N/A'
    }
  ]);
  console.log(`Saved full diagnostic audit report to ${path.relative(ROOT, REPORT_PATH)}\n`);
}

main();
