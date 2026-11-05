import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateVolumetricEnergyDensity,
  computeMeltPoolDiagnostics,
  PRESET_PROFILES,
  sampleSpatialPyrometry,
} from './titaniumPhysics';

test('calculateVolumetricEnergyDensity computes exact J/mm^3', () => {
  // P = 280 W, v = 1200 mm/s, h = 110 um (0.11 mm), t = 30 um (0.03 mm)
  // E_v = 280 / (1200 * 0.11 * 0.03) = 280 / 3.96 = 70.7070...
  const ved = calculateVolumetricEnergyDensity(280, 1200, 110, 30);
  assert.equal(Number(ved.toFixed(2)), 70.71);
});

test('Nominal aerospace preset passes ASTM F2924 compliance and achieves >=99.7% density', () => {
  const nominal = PRESET_PROFILES.find((p) => p.id === 'lpbf-nominal')!;
  const diag = computeMeltPoolDiagnostics(nominal.params);
  assert.equal(diag.regime, 'NOMINAL_CONDUCTION');
  assert.equal(diag.astmStandard, 'ASTM F2924');
  assert.equal(diag.astmCompliant, true);
  assert.ok(diag.relativeDensityPct >= 99.7);
  assert.ok(diag.tensileUtsMpa >= 895);
  assert.ok(diag.yieldStrengthMpa >= 825);
  assert.ok(diag.elongationPct >= 10.0);
});

test('High-energy keyhole preset triggers KEYHOLE_POROSITY and non-compliance', () => {
  const keyhole = PRESET_PROFILES.find((p) => p.id === 'lpbf-keyhole')!;
  const diag = computeMeltPoolDiagnostics(keyhole.params);
  assert.equal(diag.regime, 'KEYHOLE_POROSITY');
  assert.equal(diag.astmCompliant, false);
  assert.ok(diag.volumetricEnergyDensity > 100);
  assert.ok(diag.phases.alphaPrimeMartensitePct > 50);
});

test('Low-energy preset triggers LACK_OF_FUSION defect regime', () => {
  const lof = PRESET_PROFILES.find((p) => p.id === 'lpbf-lof')!;
  const diag = computeMeltPoolDiagnostics(lof.params);
  assert.equal(diag.regime, 'LACK_OF_FUSION');
  assert.equal(diag.astmCompliant, false);
  assert.ok(diag.relativeDensityPct < 99.0);
});

test('Spatial pyrometry sampler returns peak temperature at laser focal spot (u=0.36, v=0.50)', () => {
  const nominal = PRESET_PROFILES[0];
  const diag = computeMeltPoolDiagnostics(nominal.params);
  const centerSample = sampleSpatialPyrometry(0.36, 0.5, diag, nominal.params.preheatTempC);
  const edgeSample = sampleSpatialPyrometry(0.95, 0.95, diag, nominal.params.preheatTempC);
  assert.equal(centerSample.tempK, diag.peakTempK);
  assert.ok(centerSample.tempK > edgeSample.tempK);
  assert.ok(centerSample.tempK > 1933);
});
