const assert = require('assert');

// Test simulation of robust physics-based audit calculations

function computeAuditState({ p, v, h, t, spot = 100, preheat = 25, post = 'HIP', alloy = 'Grade 5', activePredHv = 340 }) {
  const hMm = h * 1e-3;
  const tMm = t * 1e-3;
  const ved = p / (v * hMm * tMm);

  // Melt pool kinematics approximation (Eagar-Tsai)
  const isWaam = false, isDed = false;
  const coolingRate = Math.round(Math.max(100.0, (2 * Math.PI * 21.9 * (v * 1e-3) * Math.pow(1660 - preheat, 2)) / Math.max(5, p * 0.42)));
  const width = Math.round(spot * 0.5 + Math.sqrt((8 * p * 0.42) / (Math.PI * Math.E * 4430 * 670 * (1660 - preheat) * (v * 1e-3))) * 1e6 * 0.75);
  const aspect = Math.max(0.22, Math.min(3.5, 0.52 * Math.pow(Math.max(0.05, ved / 70.0), 0.25)));
  const depth = Math.round(width * aspect);
  const length = Math.round(width * (1.2 + 0.0012 * v));

  const penetrationRatio = depth / t;
  const lofIndex = 1.35 / Math.max(0.1, penetrationRatio);
  const keyholeRatio = ((p / 1000) / 0.25) * 0.53 * (aspect / 0.8);
  const ballingRatio = length / (Math.max(1, width) * Math.PI);

  // Relative density
  let densityPct = 99.85 - (lofIndex > 1 ? (lofIndex - 1) * 8.5 : 0) - (keyholeRatio > 1 ? (keyholeRatio - 1) * 4.2 : 0) - (ballingRatio > 1 ? (ballingRatio - 1) * 6.0 : 0);
  if (post === 'HIP') densityPct = Math.min(99.98, densityPct + 0.5);
  densityPct = Math.max(88.0, Math.min(99.98, densityPct));

  // Mechanical properties
  const stateKey = post === 'HIP' ? 'hip' : (post === 'Stress-relieved' ? 'stress_relieved' : (post === 'Annealed' ? 'annealed' : 'as_built'));
  const taborFactor = stateKey === 'hip' ? 2.95 : (stateKey === 'as_built' ? 3.15 : 3.05);
  const utsToYsRatio = stateKey === 'hip' ? 1.09 : 1.10;

  const utsTabor = Math.round(activePredHv * taborFactor);
  const yieldStrength = Math.round(utsTabor / utsToYsRatio);

  // Elongation
  const baseElongation = (stateKey === 'hip' ? 14.5 : (stateKey === 'annealed' ? 12.5 : (stateKey === 'stress_relieved' ? 9.8 : 7.5)));
  const poreKnockdown = Math.exp(-0.45 * Math.max(0, 100 - densityPct));
  const lofPenalty = lofIndex > 1.0 ? Math.max(0.15, 1.0 - (lofIndex - 1.0) * 1.4) : 1.0;
  const keyholePenalty = keyholeRatio > 1.0 ? Math.max(0.4, 1.0 - (keyholeRatio - 1.0) * 0.5) : 1.0;
  const elongationPct = Math.max(1.0, Math.min(22.0, baseElongation * poreKnockdown * lofPenalty * keyholePenalty));

  // Residual stress
  const thermalScaling = Math.pow(Math.max(1e4, coolingRate) / 480000, 0.08);
  let residualStressMPa = 1085;
  if (stateKey === 'hip') {
    residualStressMPa = Math.max(10, Math.round(12 + (yieldStrength * 0.003)));
  } else if (stateKey === 'annealed') {
    residualStressMPa = Math.max(20, Math.round(20 + (yieldStrength * 0.010)));
  } else if (stateKey === 'stress_relieved') {
    residualStressMPa = Math.max(35, Math.round((35 + (yieldStrength * 0.012)) * thermalScaling));
  } else {
    residualStressMPa = Math.round(yieldStrength * 1.06 * thermalScaling);
  }

  // Fatigue threshold
  const kBaseFatigue = (stateKey === 'hip') ? 0.71 : (stateKey === 'annealed' ? 0.69 : (stateKey === 'stress_relieved' ? 0.65 : 0.68));
  const densityFatigueFactor = Math.pow(Math.max(0.5, densityPct / 100.0), 4.0);
  const lofFatigueFactor = lofIndex > 1.0 ? Math.max(0.20, 1.0 - (lofIndex - 1.0) * 1.6) : 1.0;
  const keyholeFatigueFactor = keyholeRatio > 1.0 ? Math.max(0.35, 1.0 - (keyholeRatio - 1.0) * 0.6) : 1.0;
  const stressFatigueFactor = Math.max(0.65, 1.0 - 0.28 * (Math.max(0, residualStressMPa - 50) / Math.max(400, yieldStrength)));
  const fatigueThreshold = Math.round(utsTabor * kBaseFatigue * densityFatigueFactor * lofFatigueFactor * keyholeFatigueFactor * stressFatigueFactor);

  return {
    ved,
    densityPct,
    yieldStrength,
    tensileStrength: utsTabor,
    elongationPct,
    residualStress: residualStressMPa,
    fatigueThreshold,
    post,
    stateKey
  };
}

// 1. Test nominal HIP state
const hipRes = computeAuditState({ p: 280, v: 960, h: 110, t: 40, post: 'HIP', activePredHv: 322 });
console.log('Nominal HIP Results:', hipRes);
assert(hipRes.densityPct >= 99.5, 'Density must pass in HIP');
assert(hipRes.elongationPct >= 10.0, 'Elongation must pass in HIP');
assert(hipRes.residualStress <= 60, 'Residual stress must pass in HIP');
assert(hipRes.yieldStrength >= 825, 'YS must pass ASTM F2924 in HIP');
assert(hipRes.tensileStrength >= 895, 'UTS must pass ASTM F2924 in HIP');
assert(hipRes.fatigueThreshold >= 520, 'Fatigue must pass ASTM F2924 in HIP');

// 2. Test As-Built state (fails elongation and residual stress)
const abRes = computeAuditState({ p: 280, v: 960, h: 110, t: 40, post: 'None', activePredHv: 385 });
console.log('As-Built Results:', abRes);
assert(abRes.elongationPct < 10.0, 'As-built elongation must fail');
assert(abRes.residualStress > 60, 'As-built residual stress must fail');

// 3. Test Severe Lack of Fusion state (P = 80W)
const lofRes = computeAuditState({ p: 80, v: 1200, h: 140, t: 50, post: 'HIP', activePredHv: 310 });
console.log('Severe LOF Results:', lofRes);
assert(lofRes.densityPct < 99.5, 'LOF density must drop below 99.5%');
assert(lofRes.fatigueThreshold < 520, 'LOF fatigue must drop below 520 MPa');

console.log('All physics test cases passed successfully!');
