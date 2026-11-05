import React, { useState } from 'react';
import {
  MeltPoolDiagnostics,
  ProcessParameters,
  QualificationCoupon,
} from '../../physics/titaniumPhysics';

interface QualificationLogScreenProps {
  params: ProcessParameters;
  diagnostics: MeltPoolDiagnostics;
  coupons: QualificationCoupon[];
  onLogCurrentCoupon: () => void;
  onLoadCoupon: (coupon: QualificationCoupon) => void;
}

const STOICHIOMETRY_SPECS = [
  { element: 'Ti (Titanium)', symbol: 'Ti', measured: '89.64', limit: 'Balance', status: 'NOMINAL' },
  { element: 'Al (Aluminum)', symbol: 'Al', measured: '6.18', limit: '5.50 – 6.75 wt%', status: 'NOMINAL' },
  { element: 'V (Vanadium)', symbol: 'V', measured: '4.02', limit: '3.50 – 4.50 wt%', status: 'NOMINAL' },
  { element: 'O (Interstitial Oxygen)', symbol: 'O', measured: '0.142', limit: '≤ 0.20 wt%', status: 'NOMINAL' },
  { element: 'Fe (Iron)', symbol: 'Fe', measured: '0.16', limit: '≤ 0.30 wt%', status: 'NOMINAL' },
  { element: 'N (Nitrogen)', symbol: 'N', measured: '0.018', limit: '≤ 0.05 wt%', status: 'NOMINAL' },
];

export const QualificationLogScreen: React.FC<QualificationLogScreenProps> = ({
  params,
  diagnostics,
  coupons,
  onLogCurrentCoupon,
  onLoadCoupon,
}) => {
  const [filterMode, setFilterMode] = useState<'ALL' | 'COMPLIANT' | 'DEFECT'>('ALL');

  const filteredCoupons = coupons.filter((c) => {
    if (filterMode === 'COMPLIANT') return c.astmCompliant;
    if (filterMode === 'DEFECT') return !c.astmCompliant;
    return true;
  });

  const handleExportCsv = () => {
    const header =
      'CouponID,Batch,Timestamp,Mode,Power_W,Speed_mm_s,Hatch_um,Layer_um,Preheat_C,VED_J_mm3,Density_Pct,UTS_MPa,YS_MPa,Elongation_Pct,Regime,ASTM_Compliant\n';
    const rows = coupons
      .map(
        (c) =>
          `${c.id},${c.batchCode},"${c.timestamp}",${c.mode},${c.laserPowerW},${c.scanSpeedMmS},${c.hatchSpacingUm},${c.layerThicknessUm},${c.preheatTempC},${c.vedJmm3},${c.relativeDensityPct},${c.utsMpa},${c.ysMpa},${c.elongationPct},${c.regime},${c.astmCompliant}`
      )
      .join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ti6al4v_astm_qualification_${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Top Row: Stoichiometric Verification + Tensile Stress-Strain Envelope */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* 6 Columns: ASTM F2924 / F3001 Chemical Composition Matrix */}
        <div className="lg:col-span-6 glass-level-1 rounded-lg p-5 space-y-3.5">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
            <div className="flex items-center gap-2">
              <span className="w-1 h-4 bg-[#06b6d4] inline-block" aria-hidden="true" />
              <div>
                <h2 className="text-sm font-semibold text-[#dee2f6]">
                  Powder Feedstock &amp; Build Stoichiometry (ICP-OES / LECO)
                </h2>
                <p className="text-[11px] font-mono text-[#869397]">
                  PLASMA-ATOMIZED GRADE 5 Ti-6Al-4V · PSD D₁₀=19 μm, D₅₀=32 μm, D₉₀=46 μm
                </p>
              </div>
            </div>
            <span className="text-xs font-mono text-[#4edea3]">● CERTIFIED LOT</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse font-mono text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-[#869397] text-[11px]">
                  <th className="py-2 pr-3">ELEMENT</th>
                  <th className="py-2 px-3 text-right">MEASURED (wt%)</th>
                  <th className="py-2 px-3 text-right">ASTM SPEC LIMIT</th>
                  <th className="py-2 pl-3 text-right">STATUS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {STOICHIOMETRY_SPECS.map((item) => (
                  <tr key={item.symbol} className="text-[#dee2f6]">
                    <td className="py-2 pr-3 font-medium">{item.element}</td>
                    <td className="py-2 px-3 text-right text-[#4cd7f6] font-semibold">
                      {item.measured}
                    </td>
                    <td className="py-2 px-3 text-right text-[#bcc9cd]">{item.limit}</td>
                    <td className="py-2 pl-3 text-right text-[#4edea3]">● PASS</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 6 Columns: Simulated ASTM E8 Stress-Strain Curve */}
        <div className="lg:col-span-6 glass-level-1 rounded-lg p-5 space-y-3.5">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
            <div className="flex items-center gap-2">
              <span className="w-1 h-4 bg-[#06b6d4] inline-block" aria-hidden="true" />
              <div>
                <h2 className="text-sm font-semibold text-[#dee2f6]">
                  ASTM E8 Uniaxial Tensile Stress–Strain Response
                </h2>
                <p className="text-[11px] font-mono text-[#869397]">
                  E = 114 GPa · UTS = {diagnostics.tensileUtsMpa} MPa · YS ={' '}
                  {diagnostics.yieldStrengthMpa} MPa · ε_f = {diagnostics.elongationPct.toFixed(1)}%
                </p>
              </div>
            </div>
            <span className="text-xs font-mono text-[#4cd7f6]">{diagnostics.astmStandard}</span>
          </div>

          <div className="bg-[#090e1c] rounded border border-slate-800 p-2">
            <svg
              viewBox="0 0 560 205"
              className="w-full h-[185px] block"
              role="img"
              aria-label="Simulated Stress-Strain Tensile Curve"
            >
              {/* Minimum ASTM UTS (895 MPa) & Elongation (10%) Reference Lines */}
              <line
                x1="50"
                y1="62"
                x2="530"
                y2="62"
                stroke="#10b981"
                strokeWidth="1"
                strokeDasharray="4 4"
              />
              <text x="56" y="56" fill="#4edea3" fontSize="9.5" fontFamily="JetBrains Mono">
                MIN ASTM UTS = 895 MPa
              </text>

              <line
                x1="315"
                y1="20"
                x2="315"
                y2="175"
                stroke="#10b981"
                strokeWidth="1"
                strokeDasharray="4 4"
              />
              <text x="320" y="168" fill="#4edea3" fontSize="9.5" fontFamily="JetBrains Mono">
                MIN ε_f = 10.0%
              </text>

              {/* Stress-Strain Curve for Active Coupon */}
              {(() => {
                const yieldY = Math.max(24, 175 - (diagnostics.yieldStrengthMpa / 1350) * 145);
                const utsY = Math.max(18, 175 - (diagnostics.tensileUtsMpa / 1350) * 145);
                const fractureX = Math.min(520, 50 + (diagnostics.elongationPct / 18) * 470);
                const curveColor = diagnostics.astmCompliant ? '#06b6d4' : '#f59e0b';

                return (
                  <>
                    <path
                      d={`M 50 175 L 92 ${yieldY} Q ${(92 + fractureX) / 2} ${utsY - 10}, ${fractureX} ${utsY + 8}`}
                      fill="none"
                      stroke={curveColor}
                      strokeWidth="2.5"
                    />
                    <circle cx="92" cy={yieldY} r="3.5" fill="#4cd7f6" />
                    <circle cx={fractureX} cy={utsY + 8} r="4.5" fill="#ffb95f" />
                    <text
                      x={Math.min(430, fractureX - 30)}
                      y={Math.max(28, utsY - 6)}
                      fill="#dee2f6"
                      fontSize="10"
                      fontFamily="JetBrains Mono"
                    >
                      FRACTURE ({diagnostics.elongationPct.toFixed(1)}%)
                    </text>
                  </>
                );
              })()}

              <text x="290" y="196" textAnchor="middle" fill="#869397" fontSize="10" fontFamily="JetBrains Mono">
                ENGINEERING STRAIN ε (%)
              </text>
            </svg>
          </div>
        </div>
      </div>

      {/* Bottom Row: Qualification Coupon Batch Table */}
      <div className="glass-level-2 rounded-lg p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
          <div className="flex items-center gap-2.5">
            <span className="w-1 h-4 bg-[#06b6d4] inline-block" aria-hidden="true" />
            <div>
              <h2 className="text-base font-semibold text-[#dee2f6]">
                Aerospace Coupon Qualification Batch Ledger
              </h2>
              <p className="text-xs font-mono text-[#869397]">
                ACTIVE PARAMETERS: P={params.laserPowerW}W · v={params.scanSpeedMmS}mm/s · E_v=
                {diagnostics.volumetricEnergyDensity.toFixed(2)} J/mm³
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Filter Controls */}
            <div className="flex items-center gap-1 bg-[#090e1c] p-1 rounded border border-slate-800 font-mono text-xs">
              {(['ALL', 'COMPLIANT', 'DEFECT'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setFilterMode(mode)}
                  className={`px-2.5 py-1 rounded transition-colors whitespace-nowrap shrink-0 ${
                    filterMode === mode
                      ? 'bg-[#06b6d4] text-[#0a0f1d] font-semibold'
                      : 'text-[#bcc9cd] hover:text-white'
                  }`}
                >
                  {mode === 'ALL'
                    ? `All (${coupons.length})`
                    : mode === 'COMPLIANT'
                      ? 'ASTM Verified'
                      : 'Non-Compliant'}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={onLogCurrentCoupon}
              className="px-3.5 py-1.5 rounded bg-[#06b6d4] text-[#0a0f1d] text-xs font-mono font-semibold hover:shadow-[0_0_16px_rgba(6,182,212,0.45)] transition-all whitespace-nowrap shrink-0"
            >
              Log Current Parameters to Batch
            </button>

            <button
              type="button"
              onClick={handleExportCsv}
              className="px-3.5 py-1.5 rounded bg-[#0f172a] border border-[#475569] text-[#cbd5e1] text-xs font-mono hover:border-[#94a3b8] hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              Download CSV
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table
            data-testid="qualification-coupon-table"
            className="w-full text-left border-collapse font-mono text-xs"
          >
            <thead>
              <tr className="border-b border-slate-800 text-[#869397] text-[11px]">
                <th className="py-2.5 pr-3">COUPON ID</th>
                <th className="py-2.5 px-3">MODE</th>
                <th className="py-2.5 px-3 text-right">P (W)</th>
                <th className="py-2.5 px-3 text-right">v (mm/s)</th>
                <th className="py-2.5 px-3 text-right">E_v (J/mm³)</th>
                <th className="py-2.5 px-3 text-right">DENSITY (%)</th>
                <th className="py-2.5 px-3 text-right">UTS / YS (MPa)</th>
                <th className="py-2.5 px-3 text-right">ε_f (%)</th>
                <th className="py-2.5 px-3">CERTIFICATION STATUS</th>
                <th className="py-2.5 pl-3 text-right">ACTION</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {filteredCoupons.map((c) => (
                <tr key={c.id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="py-2.5 pr-3 font-semibold text-[#dee2f6]">{c.id}</td>
                  <td className="py-2.5 px-3 text-[#4cd7f6]">{c.mode}</td>
                  <td className="py-2.5 px-3 text-right">{c.laserPowerW}</td>
                  <td className="py-2.5 px-3 text-right">{c.scanSpeedMmS}</td>
                  <td className="py-2.5 px-3 text-right font-semibold">{c.vedJmm3.toFixed(2)}</td>
                  <td className="py-2.5 px-3 text-right">{c.relativeDensityPct.toFixed(2)}%</td>
                  <td className="py-2.5 px-3 text-right">
                    {c.utsMpa} / {c.ysMpa}
                  </td>
                  <td className="py-2.5 px-3 text-right">{c.elongationPct.toFixed(1)}%</td>
                  <td className="py-2.5 px-3">
                    {c.astmCompliant ? (
                      <span className="text-[#4edea3] font-semibold">
                        ● {c.mode === 'LPBF' ? 'ASTM F2924' : 'ASTM F3001'} PASS
                      </span>
                    ) : (
                      <span className="text-[#ffb95f]">
                        ▲ {c.regime.replace(/_/g, ' ')}
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 pl-3 text-right">
                    <button
                      type="button"
                      onClick={() => onLoadCoupon(c)}
                      className="px-2.5 py-1 rounded bg-[#0f172a] border border-slate-700 text-[#cbd5e1] hover:border-[#06b6d4] hover:text-white transition-colors whitespace-nowrap"
                    >
                      Load Parameters
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
