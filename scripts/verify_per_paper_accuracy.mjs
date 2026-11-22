#!/usr/bin/env node
/**
 * Step 5: Tiered LOPO-CV & Physics-Prior Verification Gate + Audit Report
 *
 * Enforces:
 *   - Evaluated ML cells (N >= 5, Strength & Hardness: HV, YS, UTS):
 *       Strict LOPO-CV Mean Accuracy >= 90.0% (MAPE <= 10%) AND 95% PI Coverage >= 85.0%
 *   - Evaluated ML cells (N >= 5, Ductility: Elongation %):
 *       Strict LOPO-CV MAE <= 2.0 percentage points AND 95% PI Coverage >= 85.0%
 *   - Sparse cells (N < 5: WAAM N=1, Binder Jetting N=0, Relative Density N=0):
 *       "physics_prior_only" — skip ML LOPO-CV assertions; assert finite physical bounds (zero NaNs)
 *
 * Writes:
 *   - data/lopo_gap_audit.json (excluded records, same-input scatter cohorts, per-paper residuals, gate status)
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CALIBRATION_SUMMARY,
  VALIDATION_MATRIX,
  CALIBRATED_MATRIX,
  applyCalibratedResidual
} from '../api/_calibrated_models.js';
import {
  PROCESSES,
  PROPERTIES,
  MODEL_IDS,
  computePhysicsPrior,
  buildStandardizedFeatureRaw,
  fitScaler,
  tuneGprHyperparamsLopo,
  fitAllSixOnFold,
  computeStats
} from './train_ti64_models.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

const CORPUS_PATH = path.join(ROOT, 'data', 'cleaned_benchmark_corpus.json');
const AUDIT_PATH = path.join(ROOT, 'data', 'lopo_gap_audit.json');

const PHYSICAL_BOUNDS = {
  hardness_hv: [180, 520],
  ys_mpa: [500, 1300],
  uts_mpa: [550, 1450],
  elongation_pct: [2, 25],
  relative_density_pct: [90, 100]
};

const SPARSE_NOMINAL_RECIPES = {
  waam: [
    { process: 'waam', condition: 'As-Built', rawCondition: 'As-Built', P: 2200, v: 8, h: 3400, t: 1400, T0: 120 },
    { process: 'waam', condition: 'HIP', rawCondition: 'HIP 920°C', P: 2200, v: 8, h: 3400, t: 1400, T0: 120, htTempC: 920 }
  ],
  'binder-jetting': [
    { process: 'binder-jetting', condition: 'As-Built', rawCondition: 'As-Sintered', P: 120, v: 300, h: 100, t: 50, T0: 25 },
    { process: 'binder-jetting', condition: 'HIP', rawCondition: 'HIP 920°C', P: 120, v: 300, h: 100, t: 50, T0: 25, htTempC: 920 }
  ],
  lpbf: [
    { process: 'lpbf', condition: 'As-Built', rawCondition: 'As-Built', P: 280, v: 1200, h: 100, t: 30, T0: 200 },
    { process: 'lpbf', condition: 'HIP', rawCondition: 'HIP 920°C', P: 280, v: 1200, h: 100, t: 30, T0: 200, htTempC: 920 }
  ],
  'ded-laser': [
    { process: 'ded-laser', condition: 'As-Built', rawCondition: 'As-Built', P: 1500, v: 15, h: 1100, t: 450, T0: 120 },
    { process: 'ded-laser', condition: 'Stress-Relieved', rawCondition: 'Stress-Relieved 650°C', P: 1500, v: 15, h: 1100, t: 450, T0: 120, htTempC: 650 }
  ]
};

function findSameInputScatterCohorts(eligibleRows) {
  const groups = new Map();
  for (const r of eligibleRows) {
    const key = [
      r.process,
      r.condition || 'As-Built',
      r.P ?? 'na',
      r.v ?? 'na',
      r.h ?? 'na',
      r.t ?? 'na',
      r.T0 ?? 'default'
    ].join('|');
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(r);
  }
  const scatter = [];
  for (const [key, rows] of groups.entries()) {
    if (rows.length < 2) continue;
    const summary = {};
    for (const prop of PROPERTIES) {
      const vals = rows.map((r) => r[prop]).filter((v) => v !== null && Number.isFinite(v));
      if (vals.length >= 2) {
        const min = Math.min(...vals);
        const max = Math.max(...vals);
        const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
        summary[prop] = {
          min: Number(min.toFixed(2)),
          max: Number(max.toFixed(2)),
          spread: Number((max - min).toFixed(2)),
          mean: Number(mean.toFixed(2))
        };
      }
    }
    scatter.push({
      signature: key,
      count: rows.length,
      papers: rows.map((r) => `${r.paperNumber} ${r.authors} (${r.year})`),
      experimentalSpread: summary
    });
  }
  return scatter;
}

function main() {
  if (!fs.existsSync(CORPUS_PATH)) {
    console.error(`Missing cleaned corpus at ${CORPUS_PATH}. Run scripts/clean_benchmark_corpus.mjs first.`);
    process.exit(1);
  }

  const corpus = JSON.parse(fs.readFileSync(CORPUS_PATH, 'utf8'));
  const eligibleRows = corpus.records
    .filter((r) => r.benchmark_eligible === true)
    .map((r) => ({ ...r, prior: computePhysicsPrior(r) }));
  const excludedRows = corpus.records.filter((r) => r.benchmark_eligible !== true);

  const failures = [];
  const gateChecks = [];
  const perPaperAudit = new Map();

  for (const r of eligibleRows) {
    perPaperAudit.set(r.paperNumber, {
      paperNumber: r.paperNumber,
      authors: r.authors,
      year: r.year,
      process: r.process,
      condition: r.condition,
      rawCondition: r.rawCondition,
      P: r.P,
      v: r.v,
      h: r.h,
      t: r.t,
      T0: r.prior.T0,
      htTempC: r.prior.htTempC,
      metrics: {}
    });
  }

  for (const proc of PROCESSES) {
    for (const prop of PROPERTIES) {
      const cohort = eligibleRows.filter((r) => r[prop] !== null && r.process === proc);

      if (cohort.length < 5) {
        // Sparse / Physics-Prior Mode check: ensure finite bounded predictions with zero NaNs
        const checkInputs = [...cohort, ...(SPARSE_NOMINAL_RECIPES[proc] || [])];
        const [lo, hi] = PHYSICAL_BOUNDS[prop];
        let allFinite = true;
        let inBounds = true;
        const sampleOutputs = [];

        for (const row of checkInputs) {
          const prior = row.prior || computePhysicsPrior(row);
          const priorVal = prior[prop];
          const pred = applyCalibratedResidual({
            processId: proc,
            prop,
            priorVal,
            P: prior.P,
            v: prior.v,
            h: prior.h,
            t: prior.t,
            T0: prior.T0,
            ved: prior.ved,
            hi: prior.hi,
            htTempC: prior.htTempC,
            postProcessing: prior.post,
            oxygenWtPct: prior.oxygenWtPct,
            buildOrientationDeg: row.buildOrientationDeg ?? 0,
            surfaceTreatment: prior.surfTreat,
            isEli: prior.isEli,
            modelId: 'ensemble'
          });
          if (!Number.isFinite(pred)) allFinite = false;
          if (!(pred >= lo && pred <= hi)) inBounds = false;
          sampleOutputs.push(Number(pred.toFixed(2)));
        }

        const passed = allFinite && inBounds;
        const matrixCell = VALIDATION_MATRIX?.ensemble?.[proc]?.[prop];
        const check = {
          process: proc,
          property: prop,
          tier: 'physics_prior_only',
          nSamples: cohort.length,
          status: passed ? 'PASS' : 'FAIL',
          allFinite,
          withinPhysicalBounds: inBounds,
          bounds: [lo, hi],
          sampleOutputs,
          matrixTag: matrixCell?.validationType || 'missing'
        };
        gateChecks.push(check);
        if (!passed || matrixCell?.validationType !== 'physics_prior_only') {
          failures.push(`${proc}/${prop}: physics_prior_only bound/tag check failed`);
        }

        // Log N=1 WAAM experimental comparison transparently without ML assertions
        for (const r of cohort) {
          const entry = perPaperAudit.get(r.paperNumber);
          const priorVal = r.prior[prop];
          const apePct = (Math.abs(priorVal - r[prop]) / Math.max(1e-6, r[prop])) * 100;
          entry.metrics[prop] = {
            mode: 'physics_prior_only',
            exp: r[prop],
            physicsPriorPred: Number(priorVal.toFixed(2)),
            delta: Number((priorVal - r[prop]).toFixed(2)),
            apePct: Number(apePct.toFixed(2)),
            accuracyPct: Number((100 - apePct).toFixed(2))
          };
        }
        continue;
      }

      // N >= 5: independent LOPO-CV + exported runtime inference check
      const XAllRaw = cohort.map((r) => buildStandardizedFeatureRaw(r.prior, proc));
      const fullScaler = fitScaler(XAllRaw);
      const ZAll = XAllRaw.map(fullScaler.apply);
      const rAll = cohort.map((r) => r[prop] - r.prior[prop]);

      const gprHp = tuneGprHyperparamsLopo(ZAll, rAll);
      const svmHp = { gamma: gprHp.gamma * 0.75, reg: Math.max(0.18, gprHp.reg * 1.4) };

      const trues = [];
      const oofEnsemble = [];
      const runtimeCalib = [];

      for (let i = 0; i < cohort.length; i++) {
        const trainFold = cohort.filter((_, idx) => idx !== i);
        const foldFit = fitAllSixOnFold(trainFold, prop, proc, gprHp, svmHp);
        const foldPred = foldFit.predict(cohort[i]);
        const row = cohort[i];
        const prior = row.prior;

        const runtimePred = applyCalibratedResidual({
          processId: proc,
          prop,
          priorVal: prior[prop],
          P: prior.P,
          v: prior.v,
          h: prior.h,
          t: prior.t,
          T0: prior.T0,
          ved: prior.ved,
          hi: prior.hi,
          htTempC: prior.htTempC,
          postProcessing: prior.post,
          oxygenWtPct: prior.oxygenWtPct,
          buildOrientationDeg: row.buildOrientationDeg ?? 0,
          surfaceTreatment: prior.surfTreat,
          isEli: prior.isEli,
          modelId: 'ensemble'
        });

        trues.push(row[prop]);
        oofEnsemble.push(foldPred.ensemble);
        runtimeCalib.push(runtimePred);

        const lopoApe = (Math.abs(foldPred.ensemble - row[prop]) / Math.max(1e-6, row[prop])) * 100;
        const calApe = (Math.abs(runtimePred - row[prop]) / Math.max(1e-6, row[prop])) * 100;

        perPaperAudit.get(row.paperNumber).metrics[prop] = {
          mode: 'lopo_cv',
          exp: row[prop],
          physicsPriorPred: Number(prior[prop].toFixed(2)),
          lopoPredEnsemble: Number(foldPred.ensemble.toFixed(2)),
          lopoDelta: Number((foldPred.ensemble - row[prop]).toFixed(2)),
          lopoApePct: Number(lopoApe.toFixed(2)),
          lopoAccuracyPct: Number((100 - lopoApe).toFixed(2)),
          calibratedRuntimePred: Number(runtimePred.toFixed(2)),
          calibratedDelta: Number((runtimePred - row[prop]).toFixed(2)),
          calibratedApePct: Number(calApe.toFixed(2)),
          calibratedAccuracyPct: Number((100 - calApe).toFixed(2))
        };
      }

      const lopoStats = computeStats(trues, oofEnsemble);
      const calibStats = computeStats(trues, runtimeCalib);
      const isDuctility = prop === 'elongation_pct';

      let passed = false;
      let gateCriterion = '';
      if (isDuctility) {
        passed = lopoStats.mae <= 2.0 && lopoStats.pi95CoveragePct >= 85.0;
        gateCriterion = 'LOPO MAE <= 2.0 pp AND 95% PI Coverage >= 85%';
      } else {
        passed = lopoStats.accuracyPct >= 90.0 && lopoStats.pi95CoveragePct >= 85.0;
        gateCriterion = 'LOPO Mean Accuracy >= 90.0% AND 95% PI Coverage >= 85%';
      }

      if (!passed) {
        failures.push(
          `${proc}/${prop} failed (${gateCriterion}): Acc=${lopoStats.accuracyPct}%, MAE=${lopoStats.mae}, PICov=${lopoStats.pi95CoveragePct}%`
        );
      }

      gateChecks.push({
        process: proc,
        property: prop,
        tier: isDuctility ? 'evaluated_ductility' : 'evaluated_strength_hardness',
        nSamples: cohort.length,
        criterion: gateCriterion,
        status: passed ? 'PASS' : 'FAIL',
        lopoStats,
        calibratedRuntimeStats: calibStats,
        matrixSynced:
          Math.abs((VALIDATION_MATRIX?.ensemble?.[proc]?.[prop]?.accuracyPct ?? -999) - lopoStats.accuracyPct) < 0.05 &&
          Math.abs((CALIBRATED_MATRIX?.ensemble?.[proc]?.[prop]?.accuracyPct ?? -999) - calibStats.accuracyPct) < 0.05
      });
    }
  }

  // Summarize papers falling below 90% strictly out-of-sample (gap audit transparency)
  const lopoOutliersBelow90 = [];
  for (const p of perPaperAudit.values()) {
    for (const [prop, m] of Object.entries(p.metrics)) {
      if (m.mode === 'lopo_cv' && m.lopoAccuracyPct < 90.0) {
        lopoOutliersBelow90.push({
          paperNumber: p.paperNumber,
          authors: p.authors,
          year: p.year,
          process: p.process,
          condition: p.rawCondition || p.condition,
          property: prop,
          exp: m.exp,
          lopoPredEnsemble: m.lopoPredEnsemble,
          lopoAccuracyPct: m.lopoAccuracyPct,
          calibratedAccuracyPct: m.calibratedAccuracyPct
        });
      }
    }
  }

  const auditReport = {
    generated_at: new Date().toISOString(),
    calibrated_model_version: CALIBRATION_SUMMARY.calibrated_model_version,
    gate_passed: failures.length === 0,
    failures,
    corpus_summary: corpus.summary,
    gate_checks: gateChecks,
    same_input_scatter_cohorts: findSameInputScatterCohorts(eligibleRows),
    lopo_outliers_below_90pct: lopoOutliersBelow90,
    excluded_records: excludedRows.map((r) => ({
      paperNumber: r.paperNumber,
      authors: r.authors,
      year: r.year,
      process: r.process,
      specimen_type: r.specimen_type,
      exclusion_reason: r.exclusion_reason
    })),
    per_paper_audit: Array.from(perPaperAudit.values())
  };

  fs.writeFileSync(AUDIT_PATH, JSON.stringify(auditReport, null, 2), 'utf8');

  console.log('\n=== Tiered LOPO-CV & Physics-Prior Verification Gate ===');
  for (const g of gateChecks) {
    if (g.tier === 'physics_prior_only') {
      console.log(`  [${g.status}] ${g.process.padEnd(14)} | ${g.property.padEnd(20)} | N=${g.nSamples} | Physics-Prior Mode (${g.sampleOutputs.join(', ')})`);
    } else {
      console.log(
        `  [${g.status}] ${g.process.padEnd(14)} | ${g.property.padEnd(20)} | N=${String(g.nSamples).padEnd(2)} | LOPO Acc=${g.lopoStats.accuracyPct.toFixed(2)}% MAE=${g.lopoStats.mae.toFixed(2)} R2=${g.lopoStats.r2} PICov=${g.lopoStats.pi95CoveragePct}% | Calib Acc=${g.calibratedRuntimeStats.accuracyPct.toFixed(2)}% (>90%:${g.calibratedRuntimeStats.papersAbove90Count}/${g.nSamples})`
      );
    }
  }
  console.log(`\nAudit written to ${path.relative(ROOT, AUDIT_PATH)} (LOPO outliers <90%: ${lopoOutliersBelow90.length})`);

  if (failures.length > 0) {
    console.error('\nVerification Gate FAILED:');
    for (const f of failures) console.error('  - ' + f);
    process.exit(1);
  }
  console.log('\nVerification Gate PASSED.');
}

main();
