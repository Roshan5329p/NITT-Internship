/**
 * NIT Trichy Titanium AM Platform — Part Geometry to Physics Prediction Coupling
 * Translates loaded CAD part features (Z build height, A(z) slice thermal resistance,
 * overhang concentration, thin-wall cooling, sharp corners, and open mesh/cavity risks)
 * into clean, bounded physical adjustments for the dashboard's main Ti-6Al-4V predictors.
 */

import type { CadGeometryReport } from './geometry-analyzer';
import type { MachineProcessType } from './machine-presets';

export interface CadPredictionModifiers {
  partLabel: string;
  interlayerPreheatShiftC: number;  // Added to effective local preheat T0 (°C)
  coolingRateMultiplier: number;    // Modifies dT/dt from thermal accumulation / thin walls
  stressConcentrationFactor: number;// Thermal stress / corner notch multiplier (>= 1.0)
  densityPenaltyPct: number;        // Extra porosity risk from thin/unsupported zones
  elongationMultiplier: number;     // Ductility adjustment from surface/corner defects
  partSpecificRisks: string[];
}

/**
 * Computes physical property modifiers driven strictly by the active uploaded CAD file.
 */
export function computeCadPredictionModifiers(
  geo: CadGeometryReport,
  fileName: string,
  processId: MachineProcessType | string = 'lpbf'
): CadPredictionModifiers {
  const heightMm = geo.boundingBox.size[2];
  const minFootprintMm = Math.max(1, Math.min(geo.boundingBox.size[0], geo.boundingBox.size[1]));
  const slendernessZ = heightMm / minFootprintMm;

  // Compact cross-sections with fast layer turnarounds & overhang thermal insulating powder raise T0_eff
  const areaSmallFactor = Math.max(0, Math.min(1, 1.0 - geo.meanSliceAreaMm2 / 4000));
  const jumpHeatFactor = Math.min(1.0, geo.abruptAreaJumpCount * 0.12);
  const overhangInsul = Math.min(1.0, geo.overhangFractionPct / 25.0);
  const procScale = processId === 'waam' ? 1.6 : (processId === 'ded-laser' ? 1.3 : 1.0);

  const interlayerPreheatShiftC = Number(
    Math.min(180, (18 * areaSmallFactor + 25 * jumpHeatFactor + 22 * overhangInsul) * procScale).toFixed(1)
  );

  // Higher effective T0 & bulk volume gently reduce cooling rate; sub-millimeter thin walls quench faster
  const thinQuenchBoost = geo.minWallThicknessMm < 1.5 ? 1.18 : 1.0;
  const bulkSlowdown = Math.max(0.65, 1.0 - interlayerPreheatShiftC / 450.0);
  const coolingRateMultiplier = Number((thinQuenchBoost * bulkSlowdown).toFixed(3));

  // Stress concentration grows with tall slender Z height, abrupt A(z) transitions, and sharp concave corners
  const cornerPenalty = Math.min(0.28, geo.sharpConcaveCornerCount * 0.035);
  const slenderPenalty = Math.min(0.22, Math.max(0, slendernessZ - 1.2) * 0.08);
  const jumpPenalty = Math.min(0.18, geo.abruptAreaJumpCount * 0.04);
  const stressConcentrationFactor = Number((1.0 + cornerPenalty + slenderPenalty + jumpPenalty).toFixed(3));

  const densityPenaltyPct = Number(
    Math.min(1.5, (geo.thinWallFractionPct * 0.015) + (geo.overhangFractionPct * 0.01)).toFixed(2)
  );
  const elongationMultiplier = Number(
    Math.max(0.75, 1.0 - (geo.sharpConcaveCornerCount * 0.015) - (geo.overhangFractionPct * 0.004)).toFixed(3)
  );

  const partSpecificRisks: string[] = [];
  if (geo.overhangFractionPct > 5) {
    partSpecificRisks.push(`Overhang down-skin (${geo.overhangFractionPct}%) insulates melt pool & elevates roughness.`);
  }
  if (geo.sharpConcaveCornerCount > 0) {
    partSpecificRisks.push(`${geo.sharpConcaveCornerCount} sharp concave corners act as local thermal stress risers (×${stressConcentrationFactor}).`);
  }
  if (geo.abruptAreaJumpCount > 0) {
    partSpecificRisks.push(`${geo.abruptAreaJumpCount} abrupt cross-section A(z) jumps shift local heat-sink ratio & preheat (+${interlayerPreheatShiftC}°C).`);
  }
  if (geo.enclosedCavityCount > 0) {
    partSpecificRisks.push(`${geo.enclosedCavityCount} trapped-powder cavity(s) risk incomplete fusion/inspection blockage.`);
  }

  return {
    partLabel: fileName || 'Uploaded CAD Part',
    interlayerPreheatShiftC,
    coolingRateMultiplier,
    stressConcentrationFactor,
    densityPenaltyPct,
    elongationMultiplier,
    partSpecificRisks
  };
}
