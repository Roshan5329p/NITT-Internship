/**
 * NIT Trichy Titanium AM Platform — Live Ti-6Al-4V CCT Diagram & Phase Kinetics
 * Plots active cooling trajectory dT/dt on a log10(time) vs. Temperature CCT diagram
 * calibrated to Ahmed & Rack (1998) & Bontha/Cao Ti-6Al-4V transformation bounds:
 *   - Dynamic T_beta(O2): 975°C -> 1010°C
 *   - Diffusional alpha+beta transformation nose (~410 K/s critical martensite rate)
 *   - Martensite start (Ms = 780°C) & finish (Mf = 575°C)
 */

export interface CctDiagramInput {
  coolingRateKs: number;
  betaTransusC: number;
  preheatTempC: number;
  postProcessing: string;
}

export interface CctCurvePoint {
  timeSec: number;
  logTime: number;
  tempC: number;
}

export interface CctPhaseFractions {
  alphaPrimePct: number;
  lamellarAlphaPct: number;
  retainedBetaPct: number;
  regimeDescription: string;
  crossesDiffusionalNose: boolean;
  exceedsCritical410Ks: boolean;
}

export interface CctDiagramData {
  betaTransusC: number;
  msTempC: number;
  mfTempC: number;
  criticalRateKs: number;
  coolingRateKs: number;
  trajectory: CctCurvePoint[];
  critical410Trajectory: CctCurvePoint[];
  alphaStartNose: CctCurvePoint[];
  alphaFinishNose: CctCurvePoint[];
  phases: CctPhaseFractions;
}

function clampFinite(val: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(val)) return fallback;
  return Math.max(min, Math.min(max, val));
}

/**
 * Computes predicted phase fractions (% alpha' martensite, % lamellar alpha, % retained beta)
 * from solidus/beta-transus cooling rate and post-processing heat treatment decomposition.
 */
export function computeTi64PhaseFractions(
  coolingRateKs: number,
  postProcessing: string = 'None'
): CctPhaseFractions {
  const rate = clampFinite(coolingRateKs, 1e-3, 1e8, 4.8e5);
  const exceedsCritical410Ks = rate >= 410.0;
  const crossesDiffusionalNose = rate < 410.0;

  // As-cooled martensite nucleation potential (sigmoidal across 20 -> 410 -> 2000 K/s)
  const logRate = Math.log10(Math.max(1e-3, rate));
  const quenchAlphaPrimePotential = 90.0 / (1.0 + Math.exp(-2.1 * (logRate - Math.log10(145.0))));

  const post = (postProcessing || 'None').toLowerCase().trim();
  let alphaPrimePct = 0;
  let retainedBetaPct = 6.0;
  let regimeDescription = '';

  if (post === 'hip' || post.includes('anneal')) {
    // Sub-transus HIP (920°C) & Mill Anneal (730°C) fully decompose alpha' into equilibrium alpha+beta
    alphaPrimePct = 0.0;
    retainedBetaPct = post === 'hip' ? 10.5 : 9.5;
    regimeDescription = post === 'hip'
      ? 'Full Equilibrium Widmanstätten α+β (α\' Decomposed)'
      : 'Furnace-Annealed Lamellar α+β Colony';
  } else if (post.includes('stress')) {
    // Stress relief (650°C / 2h) partially decomposes acicular martensite
    alphaPrimePct = Number((quenchAlphaPrimePotential * 0.34).toFixed(1));
    retainedBetaPct = 7.8;
    regimeDescription = alphaPrimePct > 15
      ? 'Partially Decomposed α\' + Tempered α+β'
      : 'Stress-Relieved α+β Colony';
  } else if (post.includes('bi-modal') || post.includes('solution') || post === 'sta') {
    alphaPrimePct = Number((quenchAlphaPrimePotential * 0.14).toFixed(1));
    retainedBetaPct = 9.0;
    regimeDescription = 'Bi-Modal Primary α_p + Fine Secondary α_s';
  } else {
    // As-Built / As-Deposited state governed strictly by cooling rate
    alphaPrimePct = Number(quenchAlphaPrimePotential.toFixed(1));
    retainedBetaPct = rate >= 410 ? 5.5 : 8.5;
    regimeDescription = rate >= 410
      ? 'Diffusionless Martensitic Quench (α\' Needles)'
      : (rate >= 20 ? 'Mixed α\' + Widmanstätten α+β Colony' : 'Diffusional Widmanstätten α+β Basketweave');
  }

  const lamellarAlphaPct = Number(Math.max(0, 100.0 - alphaPrimePct - retainedBetaPct).toFixed(1));
  // Ensure exact 100.0% sum
  const sum = alphaPrimePct + lamellarAlphaPct + retainedBetaPct;
  const adjustedLamellar = Number((lamellarAlphaPct + (100.0 - sum)).toFixed(1));

  return {
    alphaPrimePct,
    lamellarAlphaPct: adjustedLamellar,
    retainedBetaPct,
    regimeDescription,
    crossesDiffusionalNose,
    exceedsCritical410Ks
  };
}

/**
 * Computes full Ti-6Al-4V CCT diagram curves (phase noses, 410 K/s reference, and live T(t) path).
 */
export function computeCctDiagramData(input: CctDiagramInput): CctDiagramData {
  const betaTransusC = clampFinite(input.betaTransusC, 965, 1020, 995.0);
  const preheatTempC = clampFinite(input.preheatTempC, 20, 750, 200.0);
  const coolingRateKs = clampFinite(input.coolingRateKs, 1e-3, 1e8, 4.8e5);
  const msTempC = 780.0;
  const mfTempC = 575.0;
  const criticalRateKs = 410.0;

  // Generate Newton cooling trajectory from T_beta down toward preheatTempC
  const buildCoolingPath = (rateKs: number): CctCurvePoint[] => {
    const safeRate = Math.max(1e-3, rateKs);
    const span = Math.max(50, betaTransusC - preheatTempC);
    const tau = span / safeRate; // characteristic cooling time constant (sec)
    const pts: CctCurvePoint[] = [];
    const steps = 48;
    for (let i = 0; i <= steps; i++) {
      const logTime = -3.0 + (i / steps) * 7.0; // log10(t) in [-3, +4] -> 1 ms to 10,000 s
      const timeSec = Math.pow(10, logTime);
      const ratio = timeSec / Math.max(1e-9, tau);
      const tempC = preheatTempC + span * Math.exp(-Math.min(60, ratio));
      pts.push({
        timeSec,
        logTime: Number(logTime.toFixed(4)),
        tempC: Number(Math.max(200, Math.min(1080, tempC)).toFixed(2))
      });
    }
    return pts;
  };

  // Classic Ti-6Al-4V Ahmed & Rack (1998) diffusional alpha+beta C-curve noses
  // Nose apex sits at T ≈ 825°C, t_start ≈ 0.55 s (right at the 410 K/s boundary from 995->780°C)
  const buildCctNose = (apexLogTime: number, widthScale: number): CctCurvePoint[] => {
    const pts: CctCurvePoint[] = [];
    const tMin = 590.0;
    const tMax = betaTransusC - 8.0;
    const tNose = 825.0;
    const steps = 36;
    for (let i = 0; i <= steps; i++) {
      const frac = i / steps;
      const tempC = tMax - frac * (tMax - tMin);
      const normDelta = (tempC - tNose) / (tMax - tNose);
      const logTime = apexLogTime + widthScale * normDelta * normDelta;
      const clampedLog = Math.max(-2.8, Math.min(3.95, logTime));
      pts.push({
        timeSec: Math.pow(10, clampedLog),
        logTime: Number(clampedLog.toFixed(4)),
        tempC: Number(tempC.toFixed(2))
      });
    }
    return pts;
  };

  return {
    betaTransusC,
    msTempC,
    mfTempC,
    criticalRateKs,
    coolingRateKs,
    trajectory: buildCoolingPath(coolingRateKs),
    critical410Trajectory: buildCoolingPath(criticalRateKs),
    alphaStartNose: buildCctNose(-0.26, 2.35), // t_nose ≈ 0.55 s
    alphaFinishNose: buildCctNose(1.05, 2.25), // t_finish ≈ 11.2 s
    phases: computeTi64PhaseFractions(coolingRateKs, input.postProcessing)
  };
}

/**
 * Generates clean SVG polyline point strings for a CCT curve within a given SVG viewport.
 * Guarded against NaN / Infinity.
 */
export function cctPointsToSvgPath(
  points: readonly CctCurvePoint[],
  padLeft: number,
  padTop: number,
  plotW: number,
  plotH: number
): string {
  if (!points || points.length === 0) return '';
  const logMin = -3.0;
  const logMax = 4.0;
  const tMin = 200.0;
  const tMax = 1100.0;

  return points
    .map((pt, idx) => {
      const u = clampFinite((pt.logTime - logMin) / (logMax - logMin), 0, 1, 0);
      const v = clampFinite((pt.tempC - tMin) / (tMax - tMin), 0, 1, 0);
      const x = padLeft + u * plotW;
      const y = padTop + (1.0 - v) * plotH;
      return `${idx === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}
