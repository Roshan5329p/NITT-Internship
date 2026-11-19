import { describe, expect, it } from 'vitest';
import {
  cctPointsToSvgPath,
  computeCctDiagramData,
  computeTi64PhaseFractions
} from '../src/components/Ti64CctDiagram';
import {
  computeMurakamiSnFatigueCurve,
  generateStressStrainCurve,
  inferActiveDefectProfile
} from '../src/components/MechanicalCurvesPanel';

describe('Ti-6Al-4V CCT Diagram, Stress-Strain & Murakami S-N Curves (Phase 3)', () => {
  it('computes CCT trajectories with zero NaNs and transforms phase fractions across cooling rates & post-processing', () => {
    const lpbfQuench = computeCctDiagramData({
      coolingRateKs: 8.5e5,
      betaTransusC: 995,
      preheatTempC: 200,
      postProcessing: 'None'
    });
    expect(lpbfQuench.phases.exceedsCritical410Ks).toBe(true);
    expect(lpbfQuench.phases.alphaPrimePct).toBeGreaterThan(75);
    expect(
      lpbfQuench.phases.alphaPrimePct +
      lpbfQuench.phases.lamellarAlphaPct +
      lpbfQuench.phases.retainedBetaPct
    ).toBeCloseTo(100.0, 1);

    const lpbfHip = computeTi64PhaseFractions(8.5e5, 'HIP');
    expect(lpbfHip.alphaPrimePct).toBe(0);
    expect(lpbfHip.lamellarAlphaPct).toBeGreaterThan(85);

    const bjSlow = computeCctDiagramData({
      coolingRateKs: 0.08,
      betaTransusC: 985,
      preheatTempC: 25,
      postProcessing: 'None'
    });
    expect(bjSlow.phases.crossesDiffusionalNose).toBe(true);
    expect(bjSlow.phases.alphaPrimePct).toBeLessThan(1.0);

    // Zero NaNs in SVG paths even under degenerate zero/negative cooling rate
    const svgPath = cctPointsToSvgPath(lpbfQuench.trajectory, 46, 18, 360, 208);
    expect(svgPath).not.toContain('NaN');
    expect(svgPath).toContain('M');
    const degPath = cctPointsToSvgPath(
      computeCctDiagramData({ coolingRateKs: 0, betaTransusC: Number.NaN, preheatTempC: -50, postProcessing: 'HIP' }).trajectory,
      46, 18, 360, 208
    );
    expect(degPath).not.toContain('NaN');
  });

  it('generates valid Engineering & True Stress-Strain curves with monotonic true stress and zero NaNs', () => {
    const hipSs = generateStressStrainCurve({ yieldStrengthMpa: 896, utsMpa: 977, elongationPct: 15.2 });
    const asBuiltSs = generateStressStrainCurve({ yieldStrengthMpa: 1126, utsMpa: 1205, elongationPct: 6.8 });

    expect(hipSs.points.length).toBeGreaterThan(30);
    expect(hipSs.points[0].engStressMpa).toBe(0);
    expect(Math.max(...hipSs.points.map(p => p.engStressMpa))).toBeCloseTo(977, 0);
    expect(hipSs.points[hipSs.points.length - 1].engStrainPct).toBeCloseTo(15.2, 1);
    expect(asBuiltSs.points[asBuiltSs.points.length - 1].engStrainPct).toBeCloseTo(6.8, 1);

    for (const pt of hipSs.points) {
      expect(Number.isFinite(pt.engStrainPct)).toBe(true);
      expect(Number.isFinite(pt.engStressMpa)).toBe(true);
      expect(Number.isFinite(pt.trueStrainPct)).toBe(true);
      expect(Number.isFinite(pt.trueStressMpa)).toBe(true);
    }
  });

  it('shifts Murakami S-N endurance curve upward for HIP + small defects vs As-Built LOF', () => {
    const hipDefect = inferActiveDefectProfile({
      postProcessing: 'HIP',
      densityPct: 99.98,
      lofIndex: 0.72,
      keyholeRatio: 0.36
    });
    const lofDefect = inferActiveDefectProfile({
      postProcessing: 'None',
      densityPct: 97.5,
      lofIndex: 1.45,
      keyholeRatio: 0.30
    });

    expect(lofDefect.defectType).toBe('lof');
    expect(lofDefect.sqrtAreaUm).toBeGreaterThan(hipDefect.sqrtAreaUm * 3);

    const hipSn = computeMurakamiSnFatigueCurve({
      hv: 335,
      utsMpa: 988,
      surfaceResidualStressMpa: 38,
      defectType: hipDefect.defectType,
      maxDefectSizeUm: hipDefect.maxDefectSizeUm
    });
    const asBuiltLofSn = computeMurakamiSnFatigueCurve({
      hv: 398,
      utsMpa: 1180,
      surfaceResidualStressMpa: 450,
      defectType: lofDefect.defectType,
      maxDefectSizeUm: lofDefect.maxDefectSizeUm
    });

    expect(hipSn.points.length).toBe(33);
    expect(hipSn.enduranceLimitMpa).toBeGreaterThan(asBuiltLofSn.enduranceLimitMpa);
    for (const pt of hipSn.points) {
      expect(Number.isFinite(pt.stressAmplitudeMpa)).toBe(true);
    }
  });
});
