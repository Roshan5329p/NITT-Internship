/**
 * NIT Trichy Titanium AM Platform (Ti-6Al-4V)
 * Process-Specific Melt-Pool & Consolidation Regime Classifier
 *
 * Centralizes regime classification across LPBF, L-DED, WAAM, and Binder Jetting
 * so that Both the Sidebar Solver, the Middle Regime Status Banner, and the
 * Rosenthal Thermal Canvas Callout derive their labels, severities, and CTAs
 * from a single reactive source of truth.
 */

export type CanonicalProcessId = 'lpbf' | 'lded' | 'waam' | 'binder_jetting';

export type RegimeSeverity = 'optimal' | 'warning' | 'danger';

export type RegimeCode =
  | 'conduction'
  | 'lof'
  | 'transition_lof'
  | 'transition'
  | 'keyhole'
  | 'overheating'
  | 'balling'
  | 'sintering'
  | 'under_sinter'
  | 'over_sinter'
  | 'cold';

export interface RegimeParameterInput {
  /** Laser / Arc / Curing Power (W) */
  P: number;
  /** Scan / Travel / Traverse Speed (mm/s) */
  v: number;
  /** Hatch / Step-over Spacing (µm) */
  h: number;
  /** Layer Thickness / Height (µm) */
  t: number;
  /** Build Plate / Interpass / Bed Preheat Temperature (°C) */
  T0?: number;
  /** Beam / Arc Spot Diameter (µm) */
  db?: number;
}

export interface RegimeMetricsInput {
  ved?: number;
  heatInput?: number;
  lofIndex?: number;
  keyholeRatio?: number;
  ballingRatio?: number;
  normalizedEnthalpy?: number;
  aspectRatio?: number;
  binderSaturationPct?: number;
  sinteringTempC?: number;
}

export interface ProcessRegimeClassification {
  processId: CanonicalProcessId;
  code: RegimeCode;
  severity: RegimeSeverity;
  /** Full banner tag title (#regimeBadge) */
  regimeLabel: string;
  /** Concise regime label for Rosenthal canvas callout & badges */
  shortLabel: string;
  /** Regime label for Sidebar Solver (#sol_regime) */
  solverRegimeLabel: string;
  /** Validation copy for Sidebar Solver (#vedWindowValidation) */
  solverWindowMessage: string;
  /** Detailed description for Middle Regime Status Banner (#regimeDesc) */
  bannerDescription: string;
  /** Action heading in #regimeTweakPanel */
  remediationHeading: string;
  /** Primary CTA button label in #regimeTweakPanel */
  tweakCtaLabel: string;
  /** Top KPI Energy card badge (#kpi_ved_badge) */
  kpiBadgeLabel: string;
  /** Governing physical parameter name */
  governingMetricLabel: string;
  /** Formatted governing physical parameter value */
  governingMetricValue: string;
  /** Volumetric Energy Density (J/mm³) */
  ved: number;
  /** Linear Heat Input HI = P / v (J/mm) */
  heatInput: number;
}

export interface RosenthalAspectCallout {
  aspectText: string;
  subLabel: string;
  fullText: string;
  color: string;
  borderColor: string;
  bgColor: string;
  tooltip: string;
}

export interface MeltPoolPresetSpec {
  id: '200w' | '300w' | 'ded' | 'waam';
  buttonId: string;
  label: string;
  processId: CanonicalProcessId;
  P: number;
  v: number;
}

const MELT_POOL_PRESETS: readonly MeltPoolPresetSpec[] = [
  { id: '200w', buttonId: 'btnMpPreset200', label: 'KU Leuven (200W)', processId: 'lpbf', P: 200, v: 950 },
  { id: '300w', buttonId: 'btnMpPreset300', label: 'Concept Laser M2 (300W)', processId: 'lpbf', P: 300, v: 1050 },
  { id: 'ded',  buttonId: 'btnMpPresetDed', label: 'L-DED (1.6 kW)', processId: 'lded', P: 1600, v: 15 },
  { id: 'waam', buttonId: 'btnMpPresetWaam', label: 'WAAM CMT (2.4 kW)', processId: 'waam', P: 2400, v: 8 }
] as const;

/**
 * Normalizes any UI process key to its canonical identifier.
 */
export function normalizeCanonicalProcessId(rawProcessId?: string | null): CanonicalProcessId {
  const norm = String(rawProcessId || 'lpbf').toLowerCase().trim();
  if (norm === 'waam') return 'waam';
  if (norm === 'lded' || norm === 'ded-laser' || norm === 'ded' || norm === 'l-ded') return 'lded';
  if (norm === 'binder_jetting' || norm === 'binder-jetting' || norm === 'bj' || norm === 'bjt') {
    return 'binder_jetting';
  }
  return 'lpbf';
}

/**
 * Central process-specific regime classifier consumed by both the Sidebar Solver
 * and the Middle Regime Status Banner.
 */
export function classifyProcessRegime(
  processIdInput: string,
  params: RegimeParameterInput,
  metrics: RegimeMetricsInput = {}
): ProcessRegimeClassification {
  const processId = normalizeCanonicalProcessId(processIdInput);
  const P = Number.isFinite(Number(params.P)) ? Number(params.P) : 280;
  const v = Number.isFinite(Number(params.v)) ? Math.max(0.1, Number(params.v)) : 960;
  const h = Number.isFinite(Number(params.h)) ? Math.max(1, Number(params.h)) : 110;
  const t = Number.isFinite(Number(params.t)) ? Math.max(1, Number(params.t)) : 40;
  const T0 = Number.isFinite(Number(params.T0)) ? Number(params.T0) : 200;

  const computedVed = (P * 1e6) / Math.max(1e-3, v * h * t);
  const ved = Number.isFinite(Number(metrics.ved)) ? Number(metrics.ved) : Number(computedVed.toFixed(1));
  const computedHi = P / Math.max(0.1, v);
  const heatInput = Number.isFinite(Number(metrics.heatInput)) ? Number(metrics.heatInput) : Number(computedHi.toFixed(1));

  // 1. BINDER JETTING: Governed strictly by sintering temperature & binder saturation bounds
  if (processId === 'binder_jetting') {
    const sinteringTempC = Number.isFinite(Number(metrics.sinteringTempC)) ? Number(metrics.sinteringTempC) : 1250;
    const binderSat = Number.isFinite(Number(metrics.binderSaturationPct))
      ? Number(metrics.binderSaturationPct)
      : Number(((P / 120.0) * 65.0).toFixed(1));

    if (P < 70 || T0 < 80 || binderSat < 40 || sinteringTempC < 1180) {
      return {
        processId,
        code: 'under_sinter',
        severity: 'warning',
        regimeLabel: 'Under-Sintered / Low Binder Saturation',
        shortLabel: 'Low Binder Saturation',
        solverRegimeLabel: 'Low Binder Saturation',
        solverWindowMessage: `Low binder saturation (${binderSat.toFixed(0)}%) or curing temperature (${T0}°C) risks green-body fragility.`,
        bannerDescription: '— Binder saturation or bed drying temperature is below optimal bounds, risking fragile green parts or incomplete neck growth during vacuum sintering (1250°C).',
        remediationHeading: 'Low binder saturation / under-cure active! Adjust green-state curing into nominal bounds:',
        tweakCtaLabel: 'Auto-Tweak to Nominal Sinter Window',
        kpiBadgeLabel: 'Low Saturation',
        governingMetricLabel: 'Binder Saturation & Sinter Temp',
        governingMetricValue: `${binderSat.toFixed(0)}% Sat · ${sinteringTempC}°C`,
        ved,
        heatInput
      };
    }

    if (P > 200 || T0 > 210 || binderSat > 110 || sinteringTempC > 1350) {
      return {
        processId,
        code: 'over_sinter',
        severity: 'danger',
        regimeLabel: 'Excess Binder Saturation / Slumping Distortion Risk',
        shortLabel: 'Excess Saturation / Slumping',
        solverRegimeLabel: 'Slumping / Excess Binder',
        solverWindowMessage: `Excessive binder saturation (${binderSat.toFixed(0)}%) or curing temperature (${T0}°C) risks green-part bleeding and slumping distortion.`,
        bannerDescription: '— Excessive binder saturation or curing heat causes powder bed bleeding, residual carbon contamination, and dimensional slumping during vacuum sintering.',
        remediationHeading: 'Excess binder saturation active! Reduce binder energy / bed drying temp below limit:',
        tweakCtaLabel: 'Auto-Tweak to Nominal Sinter Window',
        kpiBadgeLabel: 'High (Slumping)',
        governingMetricLabel: 'Binder Saturation & Sinter Temp',
        governingMetricValue: `${binderSat.toFixed(0)}% Sat · ${sinteringTempC}°C`,
        ved,
        heatInput
      };
    }

    return {
      processId,
      code: 'sintering',
      severity: 'optimal',
      regimeLabel: 'Solid-State Sintering Mode (No Melt Pool)',
      shortLabel: 'Solid-State Sintering',
      solverRegimeLabel: 'Optimal Sintering',
      solverWindowMessage: `Within validated Binder Jetting saturation (${binderSat.toFixed(0)}%) & vacuum sintering window (${sinteringTempC}°C).`,
      bannerDescription: '— Binder Jetting utilizes room-temperature liquid binder deposition followed by vacuum sintering (1250°C). Melt pool physics and laser keyholing are non-applicable.',
      remediationHeading: 'Binder Jetting Solid-State Sintering: Room-temperature inkjet print bed with subsequent vacuum sintering furnace (1250°C). Hydrodynamic melt defects (LoF, Keyhole, Balling) do not apply.',
      tweakCtaLabel: 'Auto-Tweak to Nominal Sinter Window',
      kpiBadgeLabel: 'Optimal (Sinter)',
      governingMetricLabel: 'Binder Saturation & Sinter Temp',
      governingMetricValue: `${binderSat.toFixed(0)}% Sat · ${sinteringTempC}°C`,
      ved,
      heatInput
    };
  }

  // Edge Case: Emitter / Arc Off (Cold State P <= 0)
  if (P <= 0) {
    const isWaam = processId === 'waam';
    return {
      processId,
      code: 'cold',
      severity: 'warning',
      regimeLabel: isWaam ? 'Cold Ambient State (Arc Off / P=0)' : 'Cold Ambient State (Laser Off / P=0)',
      shortLabel: 'Emitter Off (0 W)',
      solverRegimeLabel: 'Cold State (0 W)',
      solverWindowMessage: 'Zero power input. Substrate remains at preheat temperature with no melting.',
      bannerDescription: '— Power input is zero. Substrate remains at preheat temperature with no melting.',
      remediationHeading: 'Emitter Off (0 W): Zero power input. Turn on power slider or auto-tune to nominal operating window.',
      tweakCtaLabel: isWaam ? 'Auto-Tweak to Nominal Heat Input' : 'Auto-Tweak to Conduction',
      kpiBadgeLabel: 'Cold (0 W)',
      governingMetricLabel: isWaam ? 'Linear Heat Input (HI)' : 'Volumetric Energy Density (VED)',
      governingMetricValue: isWaam ? '0 J/mm' : '0.0 J/mm³',
      ved: 0,
      heatInput: 0
    };
  }

  // 2. WAAM: Governed strictly by Linear Heat Input (HI = P / v in J/mm)
  // Never emits LPBF "Keyhole active!", ">110 J/mm³", or "Auto-Tweak to Conduction".
  if (processId === 'waam') {
    const hiRounded = Math.round(heatInput);
    if (heatInput < 120.0) {
      return {
        processId,
        code: 'lof',
        severity: 'warning',
        regimeLabel: 'Lack of Fusion / Cold Lap',
        shortLabel: 'Lack of Fusion / Cold Lap',
        solverRegimeLabel: 'Lack of Fusion / Cold Lap',
        solverWindowMessage: `Lack of Fusion / Cold Lap (<120 J/mm): Linear heat input (${hiRounded} J/mm) is below optimal WAAM arc window (120–600 J/mm).`,
        bannerDescription: `— Linear heat input (${hiRounded} J/mm < 120 J/mm) is too low to wet and fuse into the substrate or previous wire-arc bead. Increase arc power or reduce travel speed.`,
        remediationHeading: 'Lack of Fusion / Cold Lap active! Increase Linear Heat Input into 120–600 J/mm:',
        tweakCtaLabel: 'Auto-Tweak to Nominal Heat Input',
        kpiBadgeLabel: 'Low (Cold Lap)',
        governingMetricLabel: 'Linear Heat Input (HI)',
        governingMetricValue: `${hiRounded} J/mm`,
        ved,
        heatInput
      };
    }

    if (heatInput > 600.0) {
      return {
        processId,
        code: 'overheating',
        severity: 'danger',
        regimeLabel: 'Overheating / Coarse-β Instability',
        shortLabel: 'Overheating / Coarse-β Instability',
        solverRegimeLabel: 'Overheating / Coarse-β Instability',
        solverWindowMessage: 'Excessive arc linear heat input (>600 J/mm) causes remelt sag, heavy residual stress, and coarse prior-β grains.',
        bannerDescription: '— Excessive arc linear heat input (>600 J/mm) causes remelt sag, heavy residual stress, and coarse prior-β grains.',
        remediationHeading: 'Overheating active! Reduce Linear Heat Input below 600 J/mm:',
        tweakCtaLabel: 'Auto-Tweak to Nominal Heat Input',
        kpiBadgeLabel: 'High (Overheat)',
        governingMetricLabel: 'Linear Heat Input (HI)',
        governingMetricValue: `${hiRounded} J/mm`,
        ved,
        heatInput
      };
    }

    return {
      processId,
      code: 'conduction',
      severity: 'optimal',
      regimeLabel: 'Optimal Arc Deposition',
      shortLabel: 'Optimal Arc Deposition',
      solverRegimeLabel: 'Optimal Arc Deposition',
      solverWindowMessage: `Within validated WAAM Optimal Arc Deposition window (120–600 J/mm, HI = ${hiRounded} J/mm).`,
      bannerDescription: `— Balanced wire-arc heat input (${hiRounded} J/mm within 120–600 J/mm) with uniform bead tie-in and minimal distortion.`,
      remediationHeading: `Optimal Operating Window: Stable WAAM arc deposition active (HI = ${hiRounded} J/mm within 120–600 J/mm). Melt pool wetting and inter-pass tie-in are balanced.`,
      tweakCtaLabel: 'Auto-Tweak to Nominal Heat Input',
      kpiBadgeLabel: 'Optimal',
      governingMetricLabel: 'Linear Heat Input (HI)',
      governingMetricValue: `${hiRounded} J/mm`,
      ved,
      heatInput
    };
  }

  // 3. L-DED: Governed by VED, Linear Heat Input & Keyhole Ratio
  if (processId === 'lded') {
    const lofIndex = Number.isFinite(Number(metrics.lofIndex)) ? Number(metrics.lofIndex) : (75.0 / Math.max(1.0, heatInput));
    const keyholeRatio = Number.isFinite(Number(metrics.keyholeRatio)) ? Number(metrics.keyholeRatio) : (heatInput / 240.0);
    const aspectRatio = Number.isFinite(Number(metrics.aspectRatio)) ? Number(metrics.aspectRatio) : 0.45;
    const normalizedEnthalpy = Number.isFinite(Number(metrics.normalizedEnthalpy)) ? Number(metrics.normalizedEnthalpy) : 3.5;
    const ballingRatio = Number.isFinite(Number(metrics.ballingRatio)) ? Number(metrics.ballingRatio) : 0.65;

    if (heatInput < 75.0 || lofIndex > 1.05) {
      return {
        processId,
        code: 'lof',
        severity: 'danger',
        regimeLabel: 'Lack of Fusion (LoF) detected',
        shortLabel: 'Lack of Fusion',
        solverRegimeLabel: 'Lack of Fusion',
        solverWindowMessage: `Lack of Fusion risk (<75 J/mm): Linear heat input (${Math.round(heatInput)} J/mm) insufficient for L-DED substrate dilution.`,
        bannerDescription: '— Linear heat input or penetration is too low to wet and fuse into the substrate/previous bead. Increase power or reduce travel speed.',
        remediationHeading: 'Lack of Fusion active! Melt depth < layer thickness:',
        tweakCtaLabel: 'Auto-Tweak to Conduction',
        kpiBadgeLabel: 'Low (LOF)',
        governingMetricLabel: 'Linear Heat Input & VED',
        governingMetricValue: `${Math.round(heatInput)} J/mm · ${ved.toFixed(1)} J/mm³`,
        ved,
        heatInput
      };
    }

    if (heatInput > 240.0 || keyholeRatio > 1.0 || aspectRatio >= 0.80) {
      return {
        processId,
        code: 'keyhole',
        severity: 'danger',
        regimeLabel: 'Over-dilution / Keyhole risk',
        shortLabel: 'Over-dilution / Keyhole',
        solverRegimeLabel: 'Keyhole mode',
        solverWindowMessage: `Over-dilution / Keyhole risk (>240 J/mm): Excessive L-DED heat input (${Math.round(heatInput)} J/mm).`,
        bannerDescription: '— Excessive localized energy or linear heat input deepens penetration excessively and increases gas pore entrapment.',
        remediationHeading: 'Keyhole active! Tweaks to prevent gas pore entrapment:',
        tweakCtaLabel: 'Auto-Tweak to Conduction',
        kpiBadgeLabel: 'High (Keyhole)',
        governingMetricLabel: 'Linear Heat Input & VED',
        governingMetricValue: `${Math.round(heatInput)} J/mm · ${ved.toFixed(1)} J/mm³`,
        ved,
        heatInput
      };
    }

    if (normalizedEnthalpy >= 5.5 || aspectRatio >= 0.58) {
      return {
        processId,
        code: 'transition',
        severity: 'warning',
        regimeLabel: 'DED Transition mode',
        shortLabel: 'DED Transition',
        solverRegimeLabel: 'Transition mode',
        solverWindowMessage: 'Operating in L-DED transition / high-dilution window.',
        bannerDescription: `— Normalized enthalpy (ΔH/hs ~ ${normalizedEnthalpy.toFixed(1)}) marks the boundary between conduction and incipient keyhole vapor cavity formation.`,
        remediationHeading: 'Recommended parameter tweaks to return to Normal Conduction Mode:',
        tweakCtaLabel: 'Auto-Tweak to Conduction',
        kpiBadgeLabel: 'Transition',
        governingMetricLabel: 'Linear Heat Input & VED',
        governingMetricValue: `${Math.round(heatInput)} J/mm · ${ved.toFixed(1)} J/mm³`,
        ved,
        heatInput
      };
    }

    if (ballingRatio > 1.05) {
      return {
        processId,
        code: 'balling',
        severity: 'danger',
        regimeLabel: 'Plateau-Rayleigh Balling instability',
        shortLabel: 'Balling Instability',
        solverRegimeLabel: 'Balling mode',
        solverWindowMessage: 'Plateau-Rayleigh Balling instability (L/W > π).',
        bannerDescription: '— Elongated melt pool breaks into discrete molten beads. Reduce speed or widen beam spot diameter.',
        remediationHeading: 'Balling instability! Length/Width ratio > π:',
        tweakCtaLabel: 'Auto-Tweak to Conduction',
        kpiBadgeLabel: 'Balling Risk',
        governingMetricLabel: 'Linear Heat Input & VED',
        governingMetricValue: `${Math.round(heatInput)} J/mm · ${ved.toFixed(1)} J/mm³`,
        ved,
        heatInput
      };
    }

    return {
      processId,
      code: 'conduction',
      severity: 'optimal',
      regimeLabel: 'Conduction-dilution mode — fully dense',
      shortLabel: 'Conduction Mode',
      solverRegimeLabel: 'Conduction mode',
      solverWindowMessage: `Within validated L-DED conduction-dilution processing window (75–240 J/mm, HI = ${Math.round(heatInput)} J/mm).`,
      bannerDescription: '— Controlled substrate dilution and full metallurgical bonding without vapor cavity porosity.',
      remediationHeading: `Optimal Operating Window: Stable L-DED conduction-dilution melting active (HI = ${Math.round(heatInput)} J/mm · VED = ${ved.toFixed(1)} J/mm³).`,
      tweakCtaLabel: 'Auto-Tweak to Conduction',
      kpiBadgeLabel: 'Optimal',
      governingMetricLabel: 'Linear Heat Input & VED',
      governingMetricValue: `${Math.round(heatInput)} J/mm · ${ved.toFixed(1)} J/mm³`,
      ved,
      heatInput
    };
  }

  // 4. LPBF: Governed by VED (< 40, 40-55, 55-85, 85-110, > 110 J/mm³) & Keyhole Ratio
  const lofIndex = Number.isFinite(Number(metrics.lofIndex)) ? Number(metrics.lofIndex) : 0.72;
  const aspectRatio = Number.isFinite(Number(metrics.aspectRatio)) ? Number(metrics.aspectRatio) : 0.51;
  const normalizedEnthalpy = Number.isFinite(Number(metrics.normalizedEnthalpy)) ? Number(metrics.normalizedEnthalpy) : 4.8;
  const ballingRatio = Number.isFinite(Number(metrics.ballingRatio)) ? Number(metrics.ballingRatio) : 0.74;

  if (ved < 40.0 || lofIndex > 1.35) {
    return {
      processId: 'lpbf',
      code: 'lof',
      severity: 'danger',
      regimeLabel: 'Severe Lack-of-Fusion (LOF) [Ev < 40 J/mm³]',
      shortLabel: 'Lack of Fusion',
      solverRegimeLabel: 'Lack of Fusion',
      solverWindowMessage: 'Severe Lack-of-Fusion risk (<40 J/mm³).',
      bannerDescription: '— Severe lack-of-fusion detected with unmelted powder particles. Melt pool depth is insufficient to penetrate underlying layer. Increase laser power or decrease scan speed.',
      remediationHeading: 'Lack of Fusion active! Melt depth < layer thickness:',
      tweakCtaLabel: 'Auto-Tweak to Conduction',
      kpiBadgeLabel: 'Low (LOF)',
      governingMetricLabel: 'Volumetric Energy Density (VED)',
      governingMetricValue: `${ved.toFixed(1)} J/mm³`,
      ved,
      heatInput
    };
  }

  if (ved < 55.0 || lofIndex > 1.05) {
    return {
      processId: 'lpbf',
      code: 'transition_lof',
      severity: 'warning',
      regimeLabel: 'Sub-optimal / Transition LOF [40 ≤ Ev < 55 J/mm³]',
      shortLabel: 'Transition LOF',
      solverRegimeLabel: 'Lack of Fusion',
      solverWindowMessage: 'Sub-optimal / Transition LOF window (40–55 J/mm³).',
      bannerDescription: '— Operating in the sub-optimal transition zone. Marginal layer penetration risks un-fused void formation. Parameter adjustment to Ev ≥ 55 J/mm³ recommended.',
      remediationHeading: 'Lack of Fusion active! Melt depth < layer thickness:',
      tweakCtaLabel: 'Auto-Tweak to Conduction',
      kpiBadgeLabel: 'Low (LOF)',
      governingMetricLabel: 'Volumetric Energy Density (VED)',
      governingMetricValue: `${ved.toFixed(1)} J/mm³`,
      ved,
      heatInput
    };
  }

  if (ved > 110.0 || aspectRatio >= 0.85) {
    return {
      processId: 'lpbf',
      code: 'keyhole',
      severity: 'danger',
      regimeLabel: 'Severe Keyhole / Vaporization Instability [Ev > 110 J/mm³]',
      shortLabel: 'Keyhole Mode',
      solverRegimeLabel: 'Keyhole mode',
      solverWindowMessage: 'Severe Keyhole / Vaporization Instability (>110 J/mm³).',
      bannerDescription: '— Deep recoil vapor cavity formation active. Severe risk of trapped gas pores and aluminium vaporization loss. Reduce laser power or increase scan speed.',
      remediationHeading: 'Keyhole active! Tweaks to prevent gas pore entrapment:',
      tweakCtaLabel: 'Auto-Tweak to Conduction',
      kpiBadgeLabel: 'High (Keyhole)',
      governingMetricLabel: 'Volumetric Energy Density (VED)',
      governingMetricValue: `${ved.toFixed(1)} J/mm³`,
      ved,
      heatInput
    };
  }

  if (ved > 85.0 || normalizedEnthalpy >= 5.5 || aspectRatio >= 0.60) {
    return {
      processId: 'lpbf',
      code: 'transition',
      severity: 'warning',
      regimeLabel: 'Transition / Mild Keyhole [85 < Ev ≤ 110 J/mm³]',
      shortLabel: 'Transition Keyhole',
      solverRegimeLabel: 'Transition Keyhole',
      solverWindowMessage: 'Transition / Mild Keyhole window (85–110 J/mm³).',
      bannerDescription: `— Normalized enthalpy (ΔH/hs ~ ${normalizedEnthalpy.toFixed(1)}) marks incipient keyhole vapor depression. Incipient vapor depression monitored.`,
      remediationHeading: 'Recommended parameter tweaks to return to Normal Conduction Mode:',
      tweakCtaLabel: 'Auto-Tweak to Conduction',
      kpiBadgeLabel: 'High (Keyhole)',
      governingMetricLabel: 'Volumetric Energy Density (VED)',
      governingMetricValue: `${ved.toFixed(1)} J/mm³`,
      ved,
      heatInput
    };
  }

  if (ballingRatio > 1.05) {
    return {
      processId: 'lpbf',
      code: 'balling',
      severity: 'danger',
      regimeLabel: 'Plateau-Rayleigh Balling instability',
      shortLabel: 'Balling Instability',
      solverRegimeLabel: 'Balling mode',
      solverWindowMessage: 'Plateau-Rayleigh Balling instability (L/W > π).',
      bannerDescription: '— Elongated melt pool breaks into discrete molten beads. Reduce speed or widen beam spot diameter.',
      remediationHeading: 'Balling instability! Length/Width ratio > π:',
      tweakCtaLabel: 'Auto-Tweak to Conduction',
      kpiBadgeLabel: 'Balling Risk',
      governingMetricLabel: 'Volumetric Energy Density (VED)',
      governingMetricValue: `${ved.toFixed(1)} J/mm³`,
      ved,
      heatInput
    };
  }

  return {
    processId: 'lpbf',
    code: 'conduction',
    severity: 'optimal',
    regimeLabel: 'Optimal Conduction Window [55 ≤ Ev ≤ 85 J/mm³]',
    shortLabel: 'Conduction Mode',
    solverRegimeLabel: 'Conduction mode',
    solverWindowMessage: 'Within validated conduction processing window (55–85 J/mm³).',
    bannerDescription: '— Stable, optimal melt pool dynamics producing fully dense material (>99.8%) with minimal defect risk.',
    remediationHeading: `Optimal Operating Window: Stable conduction melting active (ΔH/hs = ${normalizedEnthalpy.toFixed(1)} < 5.5 · VED = ${ved.toFixed(1)} J/mm³). Melt pool depth/width is balanced with full interlayer fusion.`,
    tweakCtaLabel: 'Auto-Tweak to Conduction',
    kpiBadgeLabel: 'Optimal',
    governingMetricLabel: 'Volumetric Energy Density (VED)',
    governingMetricValue: `${ved.toFixed(1)} J/mm³`,
    ved,
    heatInput
  };
}

/**
 * Formats the Melt Pool Aspect Ratio (d/W) callout badge on the Rosenthal Thermal Canvas
 * and in the Aspect Ratio metric card so it stays synchronized with the unified regime.
 */
export function formatRosenthalAspectCallout(
  aspectRatio: number | string,
  regime: ProcessRegimeClassification,
  mpModel: 'rosenthal' | 'coen' | string = 'rosenthal'
): RosenthalAspectCallout {
  const aspectNum = typeof aspectRatio === 'number' ? aspectRatio : parseFloat(String(aspectRatio));
  const aspectText = Number.isFinite(aspectNum) ? aspectNum.toFixed(2) : String(aspectRatio);
  const isPointSourceModel = String(mpModel).toLowerCase() === 'rosenthal' || regime.processId === 'waam';

  if (regime.severity === 'optimal') {
    const subLabel = 'Conduction / Stable Pool';
    return {
      aspectText,
      subLabel,
      fullText: `${aspectText} — ${subLabel}`,
      color: '#10b981',
      borderColor: 'rgba(16, 185, 129, 0.45)',
      bgColor: '#070c14',
      tooltip: 'Validated conduction / stable melt pool geometry with uniform depth-to-width ratio.'
    };
  }

  if (regime.severity === 'danger') {
    if (isPointSourceModel || aspectNum <= 0.65) {
      const subLabel = `Point-Source Bound (${regime.shortLabel})`;
      return {
        aspectText,
        subLabel,
        fullText: `${aspectText} — ${subLabel}`,
        color: '#f43f5e',
        borderColor: 'rgba(244, 63, 94, 0.55)',
        bgColor: '#190a12',
        tooltip: 'Classic Rosenthal (1946) assumes conduction-mode point-source geometry in a semi-infinite medium (~0.50–0.55 d/W) and underpredicts depth/sag at high heat inputs.'
      };
    }
    const subLabel = regime.shortLabel;
    return {
      aspectText,
      subLabel,
      fullText: `${aspectText} — ${subLabel}`,
      color: '#f43f5e',
      borderColor: 'rgba(244, 63, 94, 0.55)',
      bgColor: '#190a12',
      tooltip: regime.bannerDescription
    };
  }

  // severity === 'warning'
  const subLabel = isPointSourceModel
    ? `Point-Source Bound (${regime.shortLabel})`
    : regime.shortLabel;
  return {
    aspectText,
    subLabel,
    fullText: `${aspectText} — ${subLabel}`,
    color: '#fbbf24',
    borderColor: 'rgba(251, 191, 36, 0.5)',
    bgColor: '#171208',
    tooltip: 'Classic Rosenthal (1946) assumes conduction-mode point-source geometry and does not directly model boundary transition defects.'
  };
}

/**
 * Returns the process-aware X-axis label for the Rosenthal Thermal Field plot.
 */
export function getHeatSourceLongitudinalLabel(processIdInput: string): string {
  const proc = normalizeCanonicalProcessId(processIdInput);
  if (proc === 'waam') {
    return 'Longitudinal Distance from Arc Center x (µm / mm)';
  }
  return 'Longitudinal Distance from Laser Center x (µm / mm)';
}

/**
 * Checks whether the active (processId, P, v) matches one of the Rosenthal preset bar buttons
 * within a ±1% tolerance. Returns the matching preset ID or null if sliders diverged.
 */
export function getActiveMeltPoolPresetId(
  processIdInput: string,
  P: number,
  v: number,
  tolerance = 0.01
): '200w' | '300w' | 'ded' | 'waam' | null {
  const proc = normalizeCanonicalProcessId(processIdInput);
  const pNum = Number(P);
  const vNum = Number(v);
  if (!Number.isFinite(pNum) || !Number.isFinite(vNum)) return null;

  for (const preset of MELT_POOL_PRESETS) {
    if (preset.processId !== proc) continue;
    const pDiff = Math.abs(pNum - preset.P) / Math.max(1e-6, preset.P);
    const vDiff = Math.abs(vNum - preset.v) / Math.max(1e-6, preset.v);
    if (pDiff <= tolerance && vDiff <= tolerance) {
      return preset.id;
    }
  }
  return null;
}
