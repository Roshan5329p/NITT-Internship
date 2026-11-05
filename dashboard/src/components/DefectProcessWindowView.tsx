import React, { useMemo } from 'react';
import {
  calculateDefectRegime,
  calculateKeyholePowerBoundary,
  calculateLofPowerBoundary,
  DefectAnalysisResult,
} from '../utils/defectPhysics';
import { AlertTriangle, CheckCircle2, ShieldAlert, Sparkles, Sliders, Info, Zap } from 'lucide-react';

interface DefectProcessWindowViewProps {
  alloyId: string;
  alloyName: string;
  laserPowerW: number;
  scanSpeedMmS: number;
  hatchSpacingUm: number;
  layerThicknessUm: number;
  spotDiameterUm: number;
  preheatTempC: number;
  onApplySafeParameters: (power: number, speed: number) => void;
}

export const DefectProcessWindowView: React.FC<DefectProcessWindowViewProps> = ({
  alloyId,
  alloyName,
  laserPowerW,
  scanSpeedMmS,
  hatchSpacingUm,
  layerThicknessUm,
  spotDiameterUm,
  preheatTempC,
  onApplySafeParameters,
}) => {
  const defectData: DefectAnalysisResult = useMemo(() => {
    return calculateDefectRegime(
      alloyId,
      laserPowerW,
      scanSpeedMmS,
      hatchSpacingUm,
      layerThicknessUm,
      spotDiameterUm,
      preheatTempC
    );
  }, [alloyId, laserPowerW, scanSpeedMmS, hatchSpacingUm, layerThicknessUm, spotDiameterUm, preheatTempC]);

  // Dimensions for SVG Map
  const svgWidth = 600;
  const svgHeight = 360;
  const padding = { top: 30, right: 30, bottom: 45, left: 55 };
  const graphWidth = svgWidth - padding.left - padding.right;
  const graphHeight = svgHeight - padding.top - padding.bottom;

  // Domain: Dynamically frames user parameters while preserving standard 200–2200 mm/s & 50–500 W viewport
  const minSpeed = Math.min(200, Math.floor(scanSpeedMmS * 0.8));
  const maxSpeed = Math.max(2200, Math.ceil((scanSpeedMmS * 1.2) / 200) * 200);
  const minPower = Math.min(50, Math.floor(laserPowerW * 0.8));
  const maxPower = Math.max(500, Math.ceil((laserPowerW * 1.2) / 50) * 50);

  const speedTicks = [0.25, 0.5, 0.75, 1.0].map((f) =>
    Math.round((minSpeed + f * (maxSpeed - minSpeed)) / 100) * 100
  );
  const powerTicks = [0.2, 0.4, 0.6, 0.8, 1.0].map((f) =>
    Math.round((minPower + f * (maxPower - minPower)) / 50) * 50
  );

  const scaleX = (speed: number) =>
    padding.left + ((Math.min(maxSpeed, Math.max(minSpeed, speed)) - minSpeed) / (maxSpeed - minSpeed)) * graphWidth;
  const scaleY = (power: number) =>
    padding.top + graphHeight - ((Math.min(maxPower, Math.max(minPower, power)) - minPower) / (maxPower - minPower)) * graphHeight;

  // Current operating point coordinates
  const currentX = scaleX(scanSpeedMmS);
  const currentY = scaleY(laserPowerW);

  // Safe operating target point
  const safePower = Math.round((defectData.parameterBoundaries.minConductionPowerW + defectData.parameterBoundaries.maxConductionPowerW) / 2);
  const safeSpeed = Math.round((defectData.parameterBoundaries.minConductionSpeedMmS + defectData.parameterBoundaries.maxConductionSpeedMmS) / 2);

  // Dynamic 2D Process Window Polygons calibrated to active alloy and beam spot
  const dynamicPolygons = useMemo(() => {
    const ballingSpeed = 1650;
    const effectiveBallingSpeed = Math.min(maxSpeed, ballingSpeed);
    const steps = 14;

    const vSamples: number[] = [];
    for (let i = 0; i <= steps; i++) {
      vSamples.push(minSpeed + (i / steps) * (effectiveBallingSpeed - minSpeed));
    }

    const keyholeCurve = vSamples.map((v) => {
      const pKey = calculateKeyholePowerBoundary(alloyId, spotDiameterUm, preheatTempC, v);
      return [v, Math.max(minPower, Math.min(maxPower, pKey))] as [number, number];
    });

    const lofCurve = vSamples.map((v) => {
      const pLof = calculateLofPowerBoundary(hatchSpacingUm, layerThicknessUm, v);
      return [v, Math.max(minPower, Math.min(maxPower, pLof))] as [number, number];
    });

    // 1. Keyhole Regime: from (minSpeed, maxPower) to (effectiveBallingSpeed, maxPower),
    // down along keyholeCurve in reverse to (minSpeed, pKey(minSpeed))
    const keyholePoints = [
      `${scaleX(minSpeed)},${scaleY(maxPower)}`,
      `${scaleX(effectiveBallingSpeed)},${scaleY(maxPower)}`,
      ...[...keyholeCurve].reverse().map(([v, p]) => `${scaleX(v)},${scaleY(p)}`),
    ].join(' ');

    // 2. Lack of Fusion: along lofCurve to effectiveBallingSpeed, then to maxSpeed,
    // down to (maxSpeed, minPower) and back to (minSpeed, minPower)
    const pLofMaxSpeed = Math.max(minPower, Math.min(maxPower, calculateLofPowerBoundary(hatchSpacingUm, layerThicknessUm, maxSpeed)));
    const lofPoints = [
      `${scaleX(minSpeed)},${scaleY(minPower)}`,
      ...lofCurve.map(([v, p]) => `${scaleX(v)},${scaleY(p)}`),
      `${scaleX(maxSpeed)},${scaleY(pLofMaxSpeed)}`,
      `${scaleX(maxSpeed)},${scaleY(minPower)}`,
    ].join(' ');

    // 3. Balling: from effectiveBallingSpeed to maxSpeed
    const pLofBalling = lofCurve[lofCurve.length - 1][1];
    const ballingPoints = [
      `${scaleX(effectiveBallingSpeed)},${scaleY(pLofBalling)}`,
      `${scaleX(effectiveBallingSpeed)},${scaleY(maxPower)}`,
      `${scaleX(maxSpeed)},${scaleY(maxPower)}`,
      `${scaleX(maxSpeed)},${scaleY(pLofMaxSpeed)}`,
    ].join(' ');

    // 4. Stable Conduction Window: between lofCurve and keyholeCurve
    const conductionPoints = [
      ...lofCurve.map(([v, p]) => `${scaleX(v)},${scaleY(p)}`),
      ...[...keyholeCurve].reverse().map(([v, p]) => `${scaleX(v)},${scaleY(Math.max(p, calculateLofPowerBoundary(hatchSpacingUm, layerThicknessUm, v)))}`),
    ].join(' ');

    const midIdx = Math.floor(steps / 2);
    const midSpeed = vSamples[midIdx];
    const midPKey = keyholeCurve[midIdx][1];
    const midPLof = lofCurve[midIdx][1];

    return {
      keyholePoints,
      lofPoints,
      ballingPoints,
      conductionPoints,
      labelKeyhole: {
        x: scaleX(minSpeed + 0.12 * (effectiveBallingSpeed - minSpeed)),
        y: scaleY(Math.min(maxPower - 15, Math.max(minPower + 80, (keyholeCurve[1][1] + maxPower) / 2))),
      },
      labelConduction: {
        x: scaleX(midSpeed - 100),
        y: scaleY((midPLof + midPKey) / 2),
      },
      labelLof: {
        x: scaleX(midSpeed + 150),
        y: scaleY(Math.max(minPower + 12, midPLof - 28)),
      },
      labelBalling: {
        x: scaleX(Math.min(maxSpeed - 80, effectiveBallingSpeed + 80)),
        y: scaleY((minPower + maxPower) / 2),
      },
    };
  }, [
    alloyId,
    spotDiameterUm,
    preheatTempC,
    hatchSpacingUm,
    layerThicknessUm,
    minSpeed,
    maxSpeed,
    minPower,
    maxPower,
    graphWidth,
    graphHeight,
  ]);

  return (
    <div className="space-y-6">
      {/* Top Banner Alert & Overview */}
      <div
        className="p-5 rounded-xl border flex flex-col md:flex-row items-start md:items-center justify-between gap-4 transition-all"
        style={{
          backgroundColor: `${defectData.regimeColor}12`,
          borderColor: `${defectData.regimeColor}44`,
        }}
      >
        <div className="flex items-start gap-3.5">
          <div
            className="p-2.5 rounded-lg shrink-0 mt-0.5"
            style={{ backgroundColor: `${defectData.regimeColor}25`, color: defectData.regimeColor }}
          >
            {defectData.regime === 'conduction' ? (
              <CheckCircle2 className="w-6 h-6" />
            ) : defectData.regime === 'keyhole' ? (
              <ShieldAlert className="w-6 h-6" />
            ) : (
              <AlertTriangle className="w-6 h-6" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h3 className="text-base font-bold text-white tracking-wide">{defectData.regimeLabel}</h3>
              <span
                className="px-2 py-0.5 text-xs font-semibold rounded-full border uppercase tracking-wider"
                style={{
                  backgroundColor: `${defectData.regimeColor}20`,
                  borderColor: `${defectData.regimeColor}60`,
                  color: defectData.regimeColor,
                }}
              >
                {defectData.regime}
              </span>
              <span className="text-xs text-[#829bb5]">Target: {alloyName}</span>
            </div>
            <p className="text-xs text-[#c4d6eb] mt-1 leading-relaxed max-w-2xl">
              {defectData.regimeDescription}
            </p>
          </div>
        </div>

        {defectData.regime !== 'conduction' && (
          <button
            onClick={() => onApplySafeParameters(safePower, safeSpeed)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#50d8e9] hover:bg-[#3ec4d6] text-[#07131e] font-semibold text-xs transition-all shadow-lg hover:shadow-cyan-500/20 shrink-0 cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
            Auto-Tune to Safe Window
          </button>
        )}
      </div>

      {/* Main Grid: Interactive 2D Map on Left, Metrics & Diagnostics on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: 2D Process Window Map (7 Cols) */}
        <div className="lg:col-span-7 bg-[#0b1017] border border-[#1d2736] rounded-xl p-5 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
              <div className="min-w-0 pr-2">
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-[#50d8e9] shrink-0" />
                  <span>2D Defect Process Window (King's Enthalpy Criterion)</span>
                </h4>
                <p className="text-[11px] text-[#7891aa] mt-0.5 leading-relaxed">
                  Regimes dynamically calibrated for {alloyName} with melt pool depth-to-width ratio &amp; enthalpy criteria
                </p>
              </div>
              <div className="shrink-0 self-start sm:self-center">
                <span className="text-[11px] font-mono font-semibold text-[#50d8e9] bg-[#0c1622] px-3 py-1.5 rounded-lg border border-[#1b344d] whitespace-nowrap shadow-sm inline-flex items-center gap-2">
                  <span>P = {laserPowerW} W</span>
                  <span className="text-[#3b597a]">•</span>
                  <span>v = {scanSpeedMmS} mm/s</span>
                </span>
              </div>
            </div>

            {/* SVG Process Map */}
            <div className="relative w-full aspect-[600/360] bg-[#070b10] rounded-lg border border-[#182332] overflow-hidden">
              <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full h-full select-none">
                <defs>
                  <linearGradient id="keyholeGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ef4444" stopOpacity="0.45" />
                    <stop offset="100%" stopColor="#ef4444" stopOpacity="0.10" />
                  </linearGradient>
                  <linearGradient id="lofGrad" x1="0" y1="1" x2="1" y2="0">
                    <stop offset="0%" stopColor="#f97316" stopOpacity="0.45" />
                    <stop offset="100%" stopColor="#f97316" stopOpacity="0.08" />
                  </linearGradient>
                  <linearGradient id="conductionGrad" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity="0.35" />
                    <stop offset="100%" stopColor="#10b981" stopOpacity="0.15" />
                  </linearGradient>
                  <linearGradient id="ballingGrad" x1="1" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#eab308" stopOpacity="0.45" />
                    <stop offset="100%" stopColor="#eab308" stopOpacity="0.08" />
                  </linearGradient>
                </defs>

                {/* Grid Lines */}
                {[500, 1000, 1500, 2000].map((spd) => (
                  <line
                    key={`gx-${spd}`}
                    x1={scaleX(spd)}
                    y1={padding.top}
                    x2={scaleX(spd)}
                    y2={padding.top + graphHeight}
                    stroke="#16202c"
                    strokeDasharray="3 3"
                  />
                ))}
                {[100, 200, 300, 400].map((pwr) => (
                  <line
                    key={`gy-${pwr}`}
                    x1={padding.left}
                    y1={scaleY(pwr)}
                    x2={padding.left + graphWidth}
                    y2={scaleY(pwr)}
                    stroke="#16202c"
                    strokeDasharray="3 3"
                  />
                ))}

                {/* Zone 1: Keyhole Regime (High Power, Low to Moderate Speed) */}
                <polygon
                  points={dynamicPolygons.keyholePoints}
                  fill="url(#keyholeGrad)"
                  stroke="#ef4444"
                  strokeWidth="1"
                  strokeOpacity="0.6"
                />

                {/* Zone 2: Lack of Fusion (Low Power, High Speed) */}
                <polygon
                  points={dynamicPolygons.lofPoints}
                  fill="url(#lofGrad)"
                  stroke="#f97316"
                  strokeWidth="1"
                  strokeOpacity="0.6"
                />

                {/* Zone 3: Balling (Extreme Speed) */}
                <polygon
                  points={dynamicPolygons.ballingPoints}
                  fill="url(#ballingGrad)"
                  stroke="#eab308"
                  strokeWidth="1"
                  strokeOpacity="0.5"
                />

                {/* Zone 4: Stable Conduction Window */}
                <polygon
                  points={dynamicPolygons.conductionPoints}
                  fill="url(#conductionGrad)"
                  stroke="#10b981"
                  strokeWidth="1.5"
                  strokeOpacity="0.8"
                />

                {/* Zone Labels (Dynamically positioned inside each physics zone) */}
                <text x={dynamicPolygons.labelKeyhole.x} y={dynamicPolygons.labelKeyhole.y} fill="#f87171" fontSize="11" fontWeight="bold">
                  KEYHOLING REGIME
                </text>
                <text x={dynamicPolygons.labelConduction.x} y={dynamicPolygons.labelConduction.y} fill="#34d399" fontSize="11" fontWeight="bold">
                  STABLE CONDUCTION WINDOW
                </text>
                <text x={dynamicPolygons.labelLof.x} y={dynamicPolygons.labelLof.y} fill="#fb923c" fontSize="10" fontWeight="bold">
                  LACK OF FUSION
                </text>
                <text x={dynamicPolygons.labelBalling.x} y={dynamicPolygons.labelBalling.y} fill="#facc15" fontSize="10" fontWeight="bold">
                  BALLING
                </text>

                {/* Axes */}
                <line
                  x1={padding.left}
                  y1={padding.top + graphHeight}
                  x2={padding.left + graphWidth}
                  y2={padding.top + graphHeight}
                  stroke="#334155"
                  strokeWidth="1.5"
                />
                <line
                  x1={padding.left}
                  y1={padding.top}
                  x2={padding.left}
                  y2={padding.top + graphHeight}
                  stroke="#334155"
                  strokeWidth="1.5"
                />

                {/* X-Axis Ticks */}
                {speedTicks.map((spd) => (
                  <g key={`tx-${spd}`} transform={`translate(${scaleX(spd)}, ${padding.top + graphHeight + 14})`}>
                    <text fill="#64748b" fontSize="9" textAnchor="middle" fontFamily="monospace">
                      {spd}
                    </text>
                  </g>
                ))}
                <text
                  x={padding.left + graphWidth / 2}
                  y={padding.top + graphHeight + 35}
                  fill="#94a3b8"
                  fontSize="10"
                  textAnchor="middle"
                  fontWeight="600"
                >
                  Scan Speed v (mm/s)
                </text>

                {/* Y-Axis Ticks */}
                {powerTicks.map((pwr) => (
                  <g key={`ty-${pwr}`} transform={`translate(${padding.left - 8}, ${scaleY(pwr) + 3})`}>
                    <text fill="#64748b" fontSize="9" textAnchor="end" fontFamily="monospace">
                      {pwr}
                    </text>
                  </g>
                ))}
                <text
                  x={-padding.top - graphHeight / 2}
                  y={18}
                  transform="rotate(-90)"
                  fill="#94a3b8"
                  fontSize="10"
                  textAnchor="middle"
                  fontWeight="600"
                >
                  Laser Power P (W)
                </text>

                {/* Active Operating Cursor with Crosshairs */}
                <line
                  x1={currentX}
                  y1={padding.top}
                  x2={currentX}
                  y2={padding.top + graphHeight}
                  stroke="#50d8e9"
                  strokeWidth="1"
                  strokeDasharray="2 2"
                  strokeOpacity="0.7"
                />
                <line
                  x1={padding.left}
                  y1={currentY}
                  x2={padding.left + graphWidth}
                  y2={currentY}
                  stroke="#50d8e9"
                  strokeWidth="1"
                  strokeDasharray="2 2"
                  strokeOpacity="0.7"
                />

                {/* Pulsing Target Marker */}
                <circle cx={currentX} cy={currentY} r="9" fill={defectData.regimeColor} fillOpacity="0.25">
                  <animate attributeName="r" values="7;13;7" dur="2s" repeatCount="indefinite" />
                  <animate attributeName="fill-opacity" values="0.35;0.1;0.35" dur="2s" repeatCount="indefinite" />
                </circle>
                <circle cx={currentX} cy={currentY} r="4.5" fill="#ffffff" stroke={defectData.regimeColor} strokeWidth="2.5" />
              </svg>
            </div>
          </div>

          {/* Map Footnote Legend */}
          <div className="mt-3 flex items-center justify-between text-[11px] text-[#7189a3] pt-2 border-t border-[#192330]">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#10b981]" /> Conduction Mode
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#ef4444]" /> Keyhole Regime
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#f97316]" /> Lack of Fusion
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#eab308]" /> Balling
              </span>
            </div>
            <span className="font-mono text-[#50d8e9] whitespace-nowrap">Target: {laserPowerW} W @ {scanSpeedMmS} mm/s</span>
          </div>
        </div>

        {/* Right: Defect Risk Gauges & Physics Prescriptions (5 Cols) */}
        <div className="lg:col-span-5 space-y-4">
          {/* Defect Probability Metrics */}
          <div className="bg-[#0b1017] border border-[#1d2736] rounded-xl p-5 shadow-xl space-y-4">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Zap className="w-4 h-4 text-[#50d8e9]" />
              Real-Time Defect Probability Telemetry
            </h4>

            {/* Total Porosity Risk Scorecard */}
            <div className="p-3.5 rounded-lg bg-[#0e1724] border border-[#1e2f42] flex items-center justify-between">
              <div>
                <div className="text-[10px] text-[#7994b0] uppercase tracking-wider">Overall Porosity Risk</div>
                <div className="text-2xl font-extrabold font-mono text-white mt-0.5">
                  {defectData.overallPorosityRiskPct}%
                </div>
              </div>
              <div className="text-right">
                <div className="text-[10px] text-[#7994b0] uppercase tracking-wider">Aspect Ratio (d/w)</div>
                <div className="text-lg font-bold font-mono text-[#50d8e9] mt-0.5">
                  {defectData.aspectRatio}
                </div>
              </div>
            </div>

            {/* Progress Bars for Individual Defect Modes */}
            <div className="space-y-3 pt-1">
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-[#9ab1ca]">Keyhole Vapor Collapse Risk:</span>
                  <span className="font-mono font-bold" style={{ color: defectData.keyholeRiskPct > 40 ? '#ef4444' : '#64748b' }}>
                    {defectData.keyholeRiskPct}%
                  </span>
                </div>
                <div className="h-2 w-full bg-[#141d29] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-red-600 to-red-400 transition-all duration-500 rounded-full"
                    style={{ width: `${defectData.keyholeRiskPct}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-[#9ab1ca]">Lack-of-Fusion Un-melted Void Risk:</span>
                  <span className="font-mono font-bold" style={{ color: defectData.lackOfFusionRiskPct > 40 ? '#f97316' : '#64748b' }}>
                    {defectData.lackOfFusionRiskPct}%
                  </span>
                </div>
                <div className="h-2 w-full bg-[#141d29] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-amber-600 to-amber-400 transition-all duration-500 rounded-full"
                    style={{ width: `${defectData.lackOfFusionRiskPct}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-[#9ab1ca]">Plateau-Rayleigh Balling Instability:</span>
                  <span className="font-mono font-bold" style={{ color: defectData.ballingRiskPct > 40 ? '#eab308' : '#64748b' }}>
                    {defectData.ballingRiskPct}%
                  </span>
                </div>
                <div className="h-2 w-full bg-[#141d29] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-yellow-600 to-yellow-400 transition-all duration-500 rounded-full"
                    style={{ width: `${defectData.ballingRiskPct}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Normalized Enthalpy Badge */}
            <div className="pt-2 border-t border-[#192433] flex items-center justify-between text-xs">
              <span className="text-[#7891aa]">Normalized Enthalpy (ΔH/h<sub>s</sub>):</span>
              <span className="font-mono font-semibold text-white bg-[#131e2b] px-2 py-0.5 rounded border border-[#22354a]">
                H = {defectData.normalizedEnthalpy} (Safe: 8.0 – 26.0)
              </span>
            </div>
          </div>

          {/* Actionable Engineering Recommendation Card */}
          <div className="bg-[#0b1017] border border-[#1d2736] rounded-xl p-5 shadow-xl space-y-3">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Info className="w-4 h-4 text-[#50d8e9]" />
              Metallurgical Action Plan
            </h4>

            <p className="text-xs text-[#b8cde3] leading-relaxed bg-[#0c1420] p-3.5 rounded-lg border border-[#182738]">
              {defectData.recommendedFix}
            </p>

            <div className="grid grid-cols-2 gap-2 text-center text-xs">
              <div className="bg-[#0f1724] border border-[#1b2b3d] p-2.5 rounded-lg">
                <div className="text-[10px] text-[#718aa3] uppercase">Conduction Speed Range</div>
                <div className="text-xs font-mono font-bold text-emerald-400 mt-0.5">
                  {defectData.parameterBoundaries.minConductionSpeedMmS} – {defectData.parameterBoundaries.maxConductionSpeedMmS} mm/s
                </div>
              </div>
              <div className="bg-[#0f1724] border border-[#1b2b3d] p-2.5 rounded-lg">
                <div className="text-[10px] text-[#718aa3] uppercase">Conduction Power Range</div>
                <div className="text-xs font-mono font-bold text-emerald-400 mt-0.5">
                  {defectData.parameterBoundaries.minConductionPowerW} – {defectData.parameterBoundaries.maxConductionPowerW} W
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
