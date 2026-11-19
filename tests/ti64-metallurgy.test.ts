import { describe, expect, it } from 'vitest';
import {
  computeAlphaLathKinetics,
  computeOrientationAnisotropy,
  computeOxygenAndReuseEffects,
  evaluateTi64Metallurgy
} from '../src/lib/ti64-metallurgy';

describe('Ti-6Al-4V Physical Metallurgy Engine (Phase 2)', () => {
  it('enforces ASTM F3001 at 0.14 wt% O for Grade 23 ELI and ASTM F2924 at >0.20 wt% O for Grade 5', () => {
    const eliPass = computeOxygenAndReuseEffects({
      alloyId: 'ti64_eli',
      oxygenWtPct: 0.125
    });
    expect(eliPass.astmF3001OxygenPass).toBe(true);
    expect(eliPass.activeAlloyOxygenPass).toBe(true);
    expect(eliPass.chemistryAlert).toBeNull();

    const eliFail = computeOxygenAndReuseEffects({
      alloyId: 'ti64_eli',
      oxygenWtPct: 0.14
    });
    expect(eliFail.astmF3001OxygenPass).toBe(false);
    expect(eliFail.activeAlloyOxygenPass).toBe(false);
    expect(eliFail.chemistryAlert).toContain('ASTM F3001 FAILURE');

    const gr5Pass = computeOxygenAndReuseEffects({
      alloyId: 'ti64_gr5',
      oxygenWtPct: 0.19
    });
    expect(gr5Pass.astmF2924OxygenPass).toBe(true);
    expect(gr5Pass.activeAlloyOxygenPass).toBe(true);

    const gr5Fail = computeOxygenAndReuseEffects({
      alloyId: 'ti64_gr5',
      oxygenWtPct: 0.21
    });
    expect(gr5Fail.astmF2924OxygenPass).toBe(false);
    expect(gr5Fail.activeAlloyOxygenPass).toBe(false);
    expect(gr5Fail.chemistryAlert).toContain('ASTM F2924 FAILURE');
  });

  it('shifts beta-transus temperature (975°C -> 1010°C) and applies ~+70 MPa per +0.05 wt% O solid-solution hardening', () => {
    const lowO2 = computeOxygenAndReuseEffects({ alloyId: 'ti64_eli', oxygenWtPct: 0.08 });
    const midO2 = computeOxygenAndReuseEffects({ alloyId: 'ti64_eli', oxygenWtPct: 0.13 });
    const highO2 = computeOxygenAndReuseEffects({ alloyId: 'ti64_gr5', oxygenWtPct: 0.22 });

    expect(lowO2.betaTransusC).toBeCloseTo(975.0, 1);
    expect(highO2.betaTransusC).toBeCloseTo(1010.0, 1);
    expect(midO2.betaTransusC).toBeGreaterThan(lowO2.betaTransusC);
    expect(midO2.betaTransusC).toBeLessThan(highO2.betaTransusC);

    // +0.05 wt% O -> +70 MPa solid-solution delta YS
    const ysDelta = midO2.solidSolutionDeltaYsMpa - lowO2.solidSolutionDeltaYsMpa;
    expect(ysDelta).toBeCloseTo(70.0, 1);
    expect(highO2.ductilityMultiplier).toBeLessThan(lowO2.ductilityMultiplier);
    expect(highO2.kicMultiplier).toBeLessThan(lowO2.kicMultiplier);

    // Auto-coupled powder reuse cycles monotonically increase oxygen pickup
    const reuse0 = computeOxygenAndReuseEffects({ alloyId: 'ti64_eli', processId: 'lpbf', powderReuseCycles: 0, autoCoupleReuse: true });
    const reuse10 = computeOxygenAndReuseEffects({ alloyId: 'ti64_eli', processId: 'lpbf', powderReuseCycles: 10, autoCoupleReuse: true });
    expect(reuse10.effectiveOxygenWtPct).toBeGreaterThan(reuse0.effectiveOxygenWtPct);
    expect(reuse10.astmF3001OxygenPass).toBe(false);
  });

  it('coarsens alpha-lath width monotonically from As-Built -> Stress-Relieved -> Annealed -> HIP', () => {
    const coolRate = 1.0e6;
    const asBuilt = computeAlphaLathKinetics(coolRate, 'None', 0.16);
    const stressRel = computeAlphaLathKinetics(coolRate, 'Stress-relieved', 0.16);
    const annealed = computeAlphaLathKinetics(coolRate, 'Annealed', 0.16);
    const hip = computeAlphaLathKinetics(coolRate, 'HIP', 0.16);

    expect(asBuilt.alphaLathWidthUm).toBeGreaterThanOrEqual(0.3);
    expect(asBuilt.alphaLathWidthUm).toBeLessThanOrEqual(0.6);
    expect(annealed.alphaLathWidthUm).toBeGreaterThanOrEqual(1.5);
    expect(annealed.alphaLathWidthUm).toBeLessThanOrEqual(2.2);
    expect(hip.alphaLathWidthUm).toBeGreaterThanOrEqual(3.0);
    expect(hip.alphaLathWidthUm).toBeLessThanOrEqual(4.5);

    expect(stressRel.alphaLathWidthUm).toBeGreaterThan(asBuilt.alphaLathWidthUm);
    expect(annealed.alphaLathWidthUm).toBeGreaterThan(stressRel.alphaLathWidthUm);
    expect(hip.alphaLathWidthUm).toBeGreaterThan(annealed.alphaLathWidthUm);
  });

  it('computes Hall-Petch yield strength scaling strictly with lambda_alpha^(-1/2) and models orientation anisotropy', () => {
    const coolRate = 8.0e5;
    const states = ['None', 'Stress-relieved', 'Annealed', 'HIP'] as const;
    const results = states.map((post) =>
      evaluateTi64Metallurgy({
        alloyId: 'ti64_gr5',
        coolingRateKs: coolRate,
        postProcessing: post,
        oxygenWtPct: 0.16,
        buildOrientationDeg: 0,
        scanRotationDeg: 67
      })
    );

    // Check exact linear dependence of hallPetchIncrementMpa on lambda^(-1/2)
    for (const r of results) {
      expect(r.hallPetchIncrementMpa).toBeCloseTo(220.0 * r.lath.invSqrtLathUm, 1);
      expect(r.hallPetchYieldStrengthMpa).toBeCloseTo(r.oxygen.sigma0Mpa + r.hallPetchIncrementMpa, -1);
      expect(Number.isFinite(r.predictedHv)).toBe(true);
      expect(Number.isFinite(r.predictedKicMpaM05)).toBe(true);
    }

    // Finer as-built lath has higher YS & HV than coarsened HIP
    expect(results[0].hallPetchYieldStrengthMpa).toBeGreaterThan(results[1].hallPetchYieldStrengthMpa);
    expect(results[1].hallPetchYieldStrengthMpa).toBeGreaterThan(results[2].hallPetchYieldStrengthMpa);
    expect(results[2].hallPetchYieldStrengthMpa).toBeGreaterThan(results[3].hallPetchYieldStrengthMpa);

    // Build orientation & scan rotation anisotropy attenuated after HIP
    const xyAsBuilt = computeOrientationAnisotropy(0, 90, 'None', 0.7);
    const zAsBuilt = computeOrientationAnisotropy(90, 90, 'None', 0.7);
    const zHip = computeOrientationAnisotropy(90, 67, 'HIP', 0.7);
    expect(Math.abs(1.0 - zAsBuilt.ysFactor)).toBeGreaterThan(Math.abs(1.0 - zHip.ysFactor));
    expect(xyAsBuilt.ysFactor).toBeGreaterThan(zAsBuilt.ysFactor);
    expect(zHip.residualStressFactor).toBeLessThan(xyAsBuilt.residualStressFactor);
  });
});
