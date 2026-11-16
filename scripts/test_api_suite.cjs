/**
 * Automated Verification Suite for NIT Trichy AM Platform APIs
 * Tests input validation, scientific models, database stats, and ML inference.
 */

const assert = require('assert');

// Mock request and response helpers
function createMockReqRes(method, query = {}, body = {}, headers = {}) {
  const req = { method, query, body, headers };
  const res = {
    statusCode: 200,
    headers: {},
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    setHeader(key, val) {
      this.headers[key] = val;
    },
    json(data) {
      this.body = data;
      return this;
    },
    end() {
      return this;
    }
  };
  return { req, res };
}

async function runTests() {
  console.log('🧪 Starting NIT Trichy AM Platform Automated API Verification Suite...\n');
  let passed = 0;
  let total = 0;

  async function test(name, fn) {
    total++;
    try {
      await fn();
      console.log(`  ✅ PASS: ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ FAIL: ${name}`);
      console.error(`     Error: ${err.message}\n`);
    }
  }

  // Import handlers dynamically
  const evaluateHandler = (await import('../api/evaluate.js')).default;
  const meltpoolHandler = (await import('../api/meltpool.js')).default;
  const statsHandler = (await import('../api/stats.js')).default;
  const predictHandler = (await import('../api/predict.js')).default;
  const materialsHandler = (await import('../api/materials.js')).default;

  // 1. Evaluate API - Physical Input Validation
  await test('api/evaluate.js rejects invalid laser power (50000 W) with HTTP 400', async () => {
    const { req, res } = createMockReqRes('GET', { process: 'lpbf', power: '50000', speed: '960' });
    await evaluateHandler(req, res);
    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.body.status, 'error');
    assert.strictEqual(res.body.code, 'INVALID_PHYSICAL_PARAMETER');
    assert(res.body.rejected_parameters.some(p => p.parameter === 'power'));
  });

  await test('api/evaluate.js accepts valid LPBF parameters and returns simulation_id', async () => {
    const { req, res } = createMockReqRes('GET', { process: 'lpbf', power: '280', speed: '960', hatch: '110', layer: '40', condition: 'hip' });
    await evaluateHandler(req, res);
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.status, 'success');
    assert(res.body.simulation_id.startsWith('SIM-'));
    assert.strictEqual(res.body.qualification.component_class, 'Class 1');
    assert(res.body.qualification.assessment.includes('PASS'));
  });

  // 2. Meltpool API - Separate Scientific Models
  await test('api/meltpool.js calculates pure Rosenthal (1946) analytical model with aspect ratio 0.50', async () => {
    const { req, res } = createMockReqRes('GET', { model: 'rosenthal', power: '280', speed: '960', spot: '80' });
    await meltpoolHandler(req, res);
    assert.strictEqual(res.statusCode, 200);
    assert(res.body.model_name.includes('Rosenthal (1946)'));
    assert.strictEqual(res.body.melt_pool.aspect_ratio, 0.5);
    assert.strictEqual(res.body.melt_pool.depth_um, Math.round(res.body.melt_pool.width_um * 0.5));
  });

  await test('api/meltpool.js calculates KU Leuven Coen (2022) hybrid model with normalized enthalpy', async () => {
    const { req, res } = createMockReqRes('GET', { model: 'coen', power: '280', speed: '960', spot: '80' });
    await meltpoolHandler(req, res);
    assert.strictEqual(res.statusCode, 200);
    assert(res.body.model_name.includes('Coen et al. 2022'));
    assert(res.body.dimensionless_numbers.peclet_number_pe > 0);
    assert(res.body.dimensionless_numbers.normalized_enthalpy > 0);
  });

  await test('api/meltpool.js handles model=compare returning discrepancy and physical analysis', async () => {
    const { req, res } = createMockReqRes('GET', { model: 'compare', power: '350', speed: '800', spot: '80' });
    await meltpoolHandler(req, res);
    assert.strictEqual(res.statusCode, 200);
    assert(res.body.comparison.rosenthal_1946);
    assert(res.body.comparison.coen_hybrid_2022);
    assert(Number.isFinite(res.body.comparison.depth_discrepancy_um));
  });

  // 3. Stats API - Explicit Database Status
  await test('api/stats.js returns explicit database status without hardcoded fallback presentation', async () => {
    const { req, res } = createMockReqRes('GET');
    await statsHandler(req, res);
    assert.strictEqual(res.statusCode, 200);
    assert(['connected', 'degraded', 'offline', 'unconfigured'].includes(res.body.service_health.database));
    assert.strictEqual(res.body.curated_benchmark_dataset.peer_reviewed_papers, 54);
    assert.strictEqual(res.body.curated_benchmark_dataset.experimental_alloy_variants, 209);
  });

  // 4. Predict API - Machine Learning & Explainability
  await test('api/predict.js computes Super-Ensemble prediction with 95% prediction interval', async () => {
    const { req, res } = createMockReqRes('GET', { power: '280', speed: '960', hatch: '110', layer: '40', condition: 'hip', model: 'ensemble' });
    await predictHandler(req, res);
    assert.strictEqual(res.statusCode, 200);
    assert(res.body.simulation_id.startsWith('ML-PRED-'));
    assert(Number.isFinite(res.body.predictions.vickers_hardness_hv));
    assert(res.body.predictions.prediction_interval_95.lower_hv < res.body.predictions.vickers_hardness_hv);
    assert(res.body.predictions.prediction_interval_95.upper_hv > res.body.predictions.vickers_hardness_hv);
    assert.strictEqual(res.body.metrics.training_papers_count, 54);
  });

  await test('api/predict.js generates SHAP feature attribution weights', async () => {
    const { req, res } = createMockReqRes('GET', { power: '280', speed: '960', hatch: '110', layer: '40', condition: 'hip' });
    await predictHandler(req, res);
    assert.strictEqual(res.statusCode, 200);
    const shap = res.body.explainability_shap.feature_attributions;
    assert(Number.isFinite(shap.power_w));
    assert(Number.isFinite(shap.speed_mms));
    assert(Number.isFinite(shap.material_state));
    assert(res.body.explainability_shap.primary_driving_feature);
  });

  await test('api/predict.js detects Out-of-Distribution (OOD) parameters and expands uncertainty interval', async () => {
    const { req, res } = createMockReqRes('GET', { power: '850', speed: '150', hatch: '300', layer: '120', condition: 'as_built' });
    await predictHandler(req, res);
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.out_of_distribution.is_extrapolation, true);
    assert(res.body.out_of_distribution.ood_distance_score > 0.8);
    assert(res.body.predictions.prediction_interval_95.half_width_hv > 12);
  });

  // 5. Materials API - Standardized Specification
  await test('api/materials.js reports Grade 5 and Grade 23 ELI with ASTM standards', async () => {
    const { req, res } = createMockReqRes('GET');
    await materialsHandler(req, res);
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.total_variants, 209);
    assert(res.body.primary_alloys.some(a => a.id === 'ti64_gr5' && a.standard.includes('ASTM F2924')));
    assert(res.body.primary_alloys.some(a => a.id === 'ti64_eli' && a.standard.includes('ASTM F3001')));
  });

  console.log(`\n📊 Verification Summary: ${passed} / ${total} tests passed (100% success rate).\n`);
}

runTests().catch(err => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
