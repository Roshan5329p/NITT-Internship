import React from 'react';
import {
  MeltPoolDiagnostics,
  ProcessParameters,
  QualificationCoupon,
} from '../../physics/titaniumPhysics';

interface ProcessWindowScreenProps {
  params: ProcessParameters;
  diagnostics: MeltPoolDiagnostics;
  coupons: QualificationCoupon[];
  onUpdatePowerSpeed: (powerW: number, speedMmS: number) => void;
  onLoadCouponToSimulator: (coupon: QualificationCoupon) => void;
  onJumpToSimulator: () => void;
}

export const ProcessWindowScreen: React.FC<ProcessWindowScreenProps> = ({
  params,
  diagnostics,
  coupons,
  onUpdatePowerSpeed,
  onLoadCouponToSimulator,
  onJumpToSimulator,
}) => {
  // SVG coordinate helpers: v in [200, 2000] -> x in [70, 740], P in [100, 500] -> y in [340, 35]
  const vToX = (v: number) => 70 + ((v - 200) / 1800) * 670;
  const pToY = (p: number) => 340 - ((p - 100) / 400) * 305;

  const handleSvgClick = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / rect.width) * 780;
    const relY = ((e.clientY - rect.top) / rect.height) * 390;

    if (relX < 70 || relX > 740 || relY < 35 || relY > 340) return;

    const rawV = 200 + ((relX - 70) / 670) * 1800;
    const rawP = 100 + ((340 - relY) / 305) * 400;

    const snappedV = Math.round(rawV / 20) * 20;
    const snappedP = Math.round(rawP / 5) * 5;
    onUpdatePowerSpeed(
      Math.max(100, Math.min(500, snappedP)),
      Math.max(200, Math.min(2000, snappedV))
    );
  };

  // Generate iso-energy density curve points for a given E_v target: P = E_v * v * h * t
  const buildIsoVedPath = (targetVed: number) => {
    const hMm = params.hatchSpacingUm / 1000;
    const tMm = params.layerThicknessUm / 1000;
    const pts: string[] = [];
    for (let v = 200; v <= 2000; v += 40) {
      const p = targetVed * v * hMm * tMm;
      if (p >= 100 && p <= 500) {
        pts.push(`${pts.length === 0 ? 'M' : 'L'} ${vToX(v).toFixed(1)} ${pToY(p).toFixed(1)}`);
      }
    }
    return pts.join(' ');
  };

  const activeX = vToX(params.scanSpeedMmS);
  const activeY = pToY(params.laserPowerW);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Left 8 Columns: Interactive P-v Printability Map */}
      <div className="lg:col-span-8 glass-level-2 rounded-lg p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
          <div className="flex items-center gap-2.5">
            <span className="w-1 h-4 bg-[#06b6d4] inline-block" aria-hidden="true" />
            <div>
              <h2 className="text-base font-semibold text-[#dee2f6] tracking-tight">
                Ti-6Al-4V Process Window &amp; Defect Regime Map (P–v Space)
              </h2>
              <p className="text-xs font-mono text-[#869397]">
                CLICK ANY COORDINATE TO RECALIBRATE BEAM POWER (P) &amp; SCAN VELOCITY (v) · h ={' '}
                {params.hatchSpacingUm} μm, t = {params.layerThicknessUm} μm
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onJumpToSimulator}
            className="px-3.5 py-1.5 rounded bg-[#06b6d4] text-[#0a0f1d] text-xs font-mono font-semibold hover:shadow-[0_0_16px_rgba(6,182,212,0.45)] transition-all whitespace-nowrap shrink-0"
          >
            Inspect Live Melt Pool
          </button>
        </div>

        <div className="relative bg-[#090e1c] rounded border border-slate-800 overflow-hidden">
          <svg
            viewBox="0 0 780 390"
            onClick={handleSvgClick}
            data-testid="pv-map-svg"
            className="w-full h-[360px] sm:h-[400px] block cursor-crosshair select-none"
            role="img"
            aria-label="Laser Power versus Scan Speed Process Window Map"
          >
            {/* Background Regime Zones */}
            {/* 1. Keyhole Porosity Zone (Top-Left: High Power, Low Velocity) */}
            <polygon
              points="70,35 410,35 240,245 70,285"
              fill="rgba(239, 68, 68, 0.12)"
              stroke="rgba(239, 68, 68, 0.3)"
              strokeWidth="1"
            />
            <text x="86" y="64" fill="#ffb4ab" fontSize="11" fontFamily="JetBrains Mono" fontWeight="600">
              KEYHOLE VAPOR POROSITY
            </text>
            <text x="86" y="80" fill="#869397" fontSize="10" fontFamily="JetBrains Mono">
              E_v &gt; 100 J/mm³ (D/W &gt; 0.85)
            </text>

            {/* 2. Nominal Conduction Equilibrium Window (Center Diagonal Corridor) */}
            <polygon
              points="70,285 240,245 410,35 615,35 560,210 210,340 70,340"
              fill="rgba(16, 185, 129, 0.11)"
              stroke="rgba(16, 185, 129, 0.35)"
              strokeWidth="1"
            />
            <text x="275" y="165" fill="#4edea3" fontSize="12" fontFamily="JetBrains Mono" fontWeight="700">
              ASTM NOMINAL CONDUCTION WINDOW
            </text>
            <text x="275" y="182" fill="#bcc9cd" fontSize="10" fontFamily="JetBrains Mono">
              Relative Density ≥ 99.70% (50–90 J/mm³)
            </text>

            {/* 3. Plateau-Rayleigh Balling Regime (Top-Right: High Power, High Velocity) */}
            <polygon
              points="615,35 740,35 740,185 560,210"
              fill="rgba(245, 158, 11, 0.13)"
              stroke="rgba(245, 158, 11, 0.35)"
              strokeWidth="1"
            />
            <text x="585" y="68" fill="#ffb95f" fontSize="11" fontFamily="JetBrains Mono" fontWeight="600">
              BALLING INSTABILITY
            </text>
            <text x="585" y="84" fill="#869397" fontSize="10" fontFamily="JetBrains Mono">
              L/W &gt; 4.0 Capillary Breakup
            </text>

            {/* 4. Lack of Fusion Zone (Bottom-Right: Low Power, High Velocity) */}
            <polygon
              points="210,340 560,210 740,185 740,340"
              fill="rgba(245, 158, 11, 0.08)"
              stroke="rgba(148, 163, 184, 0.25)"
              strokeWidth="1"
            />
            <text x="505" y="305" fill="#ffb95f" fontSize="11" fontFamily="JetBrains Mono" fontWeight="600">
              LACK OF FUSION (UNMELTED CAVITIES)
            </text>
            <text x="505" y="321" fill="#869397" fontSize="10" fontFamily="JetBrains Mono">
              E_v &lt; 44 J/mm³ (D/t &lt; 1.3)
            </text>

            {/* Coordinate Grid Lines */}
            {[200, 500, 800, 1100, 1400, 1700, 2000].map((vTick) => {
              const x = vToX(vTick);
              return (
                <g key={vTick}>
                  <line x1={x} y1="35" x2={x} y2="340" stroke="rgba(148,163,184,0.12)" />
                  <text
                    x={x}
                    y="360"
                    textAnchor="middle"
                    fill="#869397"
                    fontSize="10"
                    fontFamily="JetBrains Mono"
                  >
                    {vTick}
                  </text>
                </g>
              );
            })}

            {[100, 200, 300, 400, 500].map((pTick) => {
              const y = pToY(pTick);
              return (
                <g key={pTick}>
                  <line x1="70" y1={y} x2="740" y2={y} stroke="rgba(148,163,184,0.12)" />
                  <text
                    x="60"
                    y={y + 4}
                    textAnchor="end"
                    fill="#869397"
                    fontSize="10"
                    fontFamily="JetBrains Mono"
                  >
                    {pTick}W
                  </text>
                </g>
              );
            })}

            {/* Iso-Energy Density Contours (45, 70, 100 J/mm^3) */}
            <path
              d={buildIsoVedPath(45)}
              fill="none"
              stroke="#ffb95f"
              strokeWidth="1.2"
              strokeDasharray="4 4"
            />
            <path
              d={buildIsoVedPath(70)}
              fill="none"
              stroke="#10b981"
              strokeWidth="1.5"
              strokeDasharray="6 3"
            />
            <path
              d={buildIsoVedPath(100)}
              fill="none"
              stroke="#ef4444"
              strokeWidth="1.2"
              strokeDasharray="4 4"
            />

            {/* Plotted Historical Coupons */}
            {coupons.map((c) => {
              const cx = vToX(c.scanSpeedMmS);
              const cy = pToY(c.laserPowerW);
              return (
                <g key={c.id}>
                  <rect
                    x={cx - 4}
                    y={cy - 4}
                    width="8"
                    height="8"
                    fill={c.astmCompliant ? '#10b981' : '#f59e0b'}
                    stroke="#090e1c"
                    strokeWidth="1.5"
                  />
                  <text
                    x={cx + 7}
                    y={cy + 3}
                    fill="#cbd5e1"
                    fontSize="9"
                    fontFamily="JetBrains Mono"
                  >
                    {c.id}
                  </text>
                </g>
              );
            })}

            {/* Active Operating Point Crosshair */}
            <line
              x1={activeX}
              y1="35"
              x2={activeX}
              y2="340"
              stroke="#06b6d4"
              strokeWidth="1"
              strokeDasharray="3 3"
            />
            <line
              x1="70"
              y1={activeY}
              x2="740"
              y2={activeY}
              stroke="#06b6d4"
              strokeWidth="1"
              strokeDasharray="3 3"
            />
            <circle
              cx={activeX}
              cy={activeY}
              r="7"
              fill="#06b6d4"
              stroke="#0a0f1d"
              strokeWidth="2"
            />
            <rect
              x={Math.min(580, activeX + 10)}
              y={Math.max(40, activeY - 28)}
              width="155"
              height="24"
              rx="2"
              fill="#090e1c"
              stroke="#06b6d4"
            />
            <text
              x={Math.min(580, activeX + 10) + 8}
              y={Math.max(40, activeY - 28) + 15}
              fill="#4cd7f6"
              fontSize="10"
              fontFamily="JetBrains Mono"
              fontWeight="600"
            >
              ACTIVE: {params.laserPowerW}W · {params.scanSpeedMmS}mm/s
            </text>

            {/* Axis Titles */}
            <text
              x="405"
              y="382"
              textAnchor="middle"
              fill="#bcc9cd"
              fontSize="11"
              fontFamily="JetBrains Mono"
            >
              SCAN VECTOR VELOCITY v (mm/s)
            </text>
            <text
              x="18"
              y="190"
              textAnchor="middle"
              fill="#bcc9cd"
              fontSize="11"
              fontFamily="JetBrains Mono"
              transform="rotate(-90 18 190)"
            >
              BEAM POWER P (W)
            </text>
          </svg>
        </div>
      </div>

      {/* Right 4 Columns: Active Operating Point Telemetry & Empirical Reference Coupons */}
      <div className="lg:col-span-4 flex flex-col gap-4">
        <div className="glass-level-1 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
            <div className="flex items-center gap-2">
              <span className="w-1 h-4 bg-[#06b6d4] inline-block" aria-hidden="true" />
              <h3 className="text-xs font-mono uppercase tracking-wider text-[#dee2f6]">
                Selected Coordinate Telemetry
              </h3>
            </div>
            <span className="text-xs font-mono text-[#4cd7f6]">
              {diagnostics.volumetricEnergyDensity.toFixed(1)} J/mm³
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2.5 font-mono">
            <div className="bg-[#090e1c] border border-slate-800 rounded p-2.5">
              <div className="text-[10px] text-[#869397] uppercase">BEAM POWER (P)</div>
              <div className="text-lg font-bold text-[#dee2f6] mt-0.5">{params.laserPowerW} W</div>
            </div>
            <div className="bg-[#090e1c] border border-slate-800 rounded p-2.5">
              <div className="text-[10px] text-[#869397] uppercase">SCAN SPEED (v)</div>
              <div className="text-lg font-bold text-[#dee2f6] mt-0.5">
                {params.scanSpeedMmS} mm/s
              </div>
            </div>
            <div className="bg-[#090e1c] border border-slate-800 rounded p-2.5">
              <div className="text-[10px] text-[#869397] uppercase">PREDICTED DENSITY</div>
              <div className="text-lg font-bold text-[#4edea3] mt-0.5">
                {diagnostics.relativeDensityPct.toFixed(2)}%
              </div>
            </div>
            <div className="bg-[#090e1c] border border-slate-800 rounded p-2.5">
              <div className="text-[10px] text-[#869397] uppercase">REGIME STATE</div>
              <div className="text-xs font-bold text-[#ffb95f] mt-1 truncate">
                {diagnostics.regime.replace(/_/g, ' ')}
              </div>
            </div>
          </div>
        </div>

        {/* Empirical Coupon Library List */}
        <div className="glass-level-1 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
            <div className="flex items-center gap-2">
              <span className="w-1 h-4 bg-[#06b6d4] inline-block" aria-hidden="true" />
              <h3 className="text-xs font-mono uppercase tracking-wider text-[#dee2f6]">
                Calibrated Coupon Reference Points
              </h3>
            </div>
            <span className="text-[11px] font-mono text-[#869397]">{coupons.length} RUNS</span>
          </div>

          <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
            {coupons.map((coupon) => (
              <div
                key={coupon.id}
                className="bg-[#090e1c] border border-slate-800 rounded p-2.5 flex items-center justify-between gap-2"
              >
                <div className="min-w-0 font-mono">
                  <div className="flex items-center gap-2 text-xs font-semibold text-[#dee2f6]">
                    <span>{coupon.id}</span>
                    <span className="text-[#869397]">·</span>
                    <span className={coupon.astmCompliant ? 'text-[#4edea3]' : 'text-[#ffb95f]'}>
                      {coupon.relativeDensityPct.toFixed(2)}%
                    </span>
                  </div>
                  <div className="text-[11px] text-[#869397] truncate">
                    P {coupon.laserPowerW}W · v {coupon.scanSpeedMmS}mm/s · E_v{' '}
                    {coupon.vedJmm3.toFixed(1)} J/mm³
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onLoadCouponToSimulator(coupon)}
                  className="px-2.5 py-1 rounded bg-[#0f172a] border border-[#475569] text-xs font-mono text-[#cbd5e1] hover:border-[#06b6d4] hover:text-white transition-colors whitespace-nowrap shrink-0"
                >
                  Load Point
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
