import React, { useEffect, useRef } from 'react';
import {
  HeatTreatmentMode,
  MeltPoolDiagnostics,
  ProcessParameters,
  TI64_CONSTANTS,
} from '../../physics/titaniumPhysics';

interface PhaseKineticsScreenProps {
  params: ProcessParameters;
  diagnostics: MeltPoolDiagnostics;
  onChangeHeatTreatment: (ht: HeatTreatmentMode) => void;
  onChangePreheat: (tempC: number) => void;
}

export const PhaseKineticsScreen: React.FC<PhaseKineticsScreenProps> = ({
  params,
  diagnostics,
  onChangeHeatTreatment,
  onChangePreheat,
}) => {
  const microCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Render Synthetic Optical / EBSD Metallography Microstructure based on phase fractions
  useEffect(() => {
    const canvas = microCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    ctx.fillStyle = '#090e1c';
    ctx.fillRect(0, 0, width, height);

    // Draw Prior-Beta Columnar Grain Boundaries
    const grainW = Math.max(55, Math.min(140, diagnostics.phases.priorBetaGrainWidthUm * 0.85));
    ctx.strokeStyle = 'rgba(76, 215, 246, 0.45)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 3]);
    for (let gx = grainW; gx < width; gx += grainW) {
      ctx.beginPath();
      ctx.moveTo(gx, 0);
      ctx.lineTo(gx - 12, height / 2);
      ctx.lineTo(gx + 8, height);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    const martensiteFrac = diagnostics.phases.alphaPrimeMartensitePct / 100;
    const lathThickPx = Math.max(1.2, diagnostics.phases.alphaLathThicknessUm * 2.1);

    // Deterministic 2D Weyl quasi-random crystallographic needle / lath rendering across entire micrograph
    for (let i = 0; i < 220; i++) {
      const cx = (((i + 1) * 0.7548776662466927) % 1) * (width - 24) + 12;
      const cy = (((i + 1) * 0.5698402909980532) % 1) * (height - 24) + 12;
      // 60 degree Burgers orientation variants in HCP Ti-6Al-4V
      const variantAngles = [Math.PI / 6, -Math.PI / 6, Math.PI / 2.2, -Math.PI / 3.2, Math.PI / 4];
      const angle = variantAngles[i % variantAngles.length];
      const length = martensiteFrac > 0.4 ? 38 + (i % 24) : 26 + (i % 16);

      const x1 = cx - Math.cos(angle) * (length / 2);
      const y1 = cy - Math.sin(angle) * (length / 2);
      const x2 = cx + Math.cos(angle) * (length / 2);
      const y2 = cy + Math.sin(angle) * (length / 2);

      if (i / 165 < martensiteFrac) {
        // Fine acicular alpha'-martensite needles (Molten Amber)
        ctx.strokeStyle = 'rgba(245, 158, 11, 0.72)';
        ctx.lineWidth = 1.1;
      } else if (i % 7 === 0) {
        // Retained BCC beta ribs (Precision Emerald)
        ctx.strokeStyle = 'rgba(16, 185, 129, 0.78)';
        ctx.lineWidth = 1.6;
      } else {
        // Equilibrium HCP alpha Widmanstätten laths (Laser Cyan)
        ctx.strokeStyle = 'rgba(6, 182, 212, 0.7)';
        ctx.lineWidth = lathThickPx;
      }

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }

    // Scale bar overlay (50 um)
    ctx.fillStyle = 'rgba(9, 14, 28, 0.88)';
    ctx.fillRect(width - 135, height - 38, 122, 26);
    ctx.strokeStyle = '#06b6d4';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(width - 122, height - 21);
    ctx.lineTo(width - 62, height - 21);
    ctx.stroke();
    ctx.fillStyle = '#dee2f6';
    ctx.font = '600 10px "JetBrains Mono", monospace';
    ctx.fillText('50 μm', width - 54, height - 18);
  }, [diagnostics]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Left 7 Columns: Continuous Cooling Transformation (CCT) Diagram */}
      <div className="lg:col-span-7 glass-level-2 rounded-lg p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
          <div className="flex items-center gap-2.5">
            <span className="w-1 h-4 bg-[#06b6d4] inline-block" aria-hidden="true" />
            <div>
              <h2 className="text-base font-semibold text-[#dee2f6] tracking-tight">
                Continuous Cooling Transformation (CCT) &amp; β → α/α&apos; Kinetics
              </h2>
              <p className="text-xs font-mono text-[#869397]">
                CRITICAL MARTENSITIC COOLING THRESHOLD: 410 K/s · ACTIVE dT/dt:{' '}
                {(diagnostics.coolingRateKs / 1000).toFixed(1)} × 10³ K/s
              </p>
            </div>
          </div>
          <span className="text-xs font-mono text-[#4cd7f6]">
            T₀ = {params.preheatTempC} °C ({params.preheatTempC + 273} K)
          </span>
        </div>

        <div className="bg-[#090e1c] rounded border border-slate-800 p-2">
          <svg
            viewBox="0 0 680 340"
            className="w-full h-[310px] block"
            role="img"
            aria-label="Ti-6Al-4V Continuous Cooling Transformation Diagram"
          >
            {/* Beta-Transus 995 C (1268 K) Line */}
            <line
              x1="60"
              y1="75"
              x2="650"
              y2="75"
              stroke="#06b6d4"
              strokeWidth="1.5"
              strokeDasharray="5 4"
            />
            <text x="68" y="68" fill="#4cd7f6" fontSize="10" fontFamily="JetBrains Mono" fontWeight="600">
              β-TRANSUS = {TI64_CONSTANTS.BETA_TRANSUS_K} K (995 °C) — ALLOTROPIC BCC β FIELD ABOVE
            </text>

            {/* Martensite Start Ms 575 C (848 K) Line */}
            <line
              x1="60"
              y1="205"
              x2="650"
              y2="205"
              stroke="#f59e0b"
              strokeWidth="1.5"
              strokeDasharray="4 3"
            />
            <text x="68" y="198" fill="#ffb95f" fontSize="10" fontFamily="JetBrains Mono" fontWeight="600">
              M_s MARTENSITE START = {TI64_CONSTANTS.MARTENSITE_START_K} K (575 °C) — DIFFUSIONLESS α&apos; BELOW
            </text>

            {/* Diffusional Alpha + Beta Transformation Nose */}
            <path
              d="M 650 82 C 340 86, 265 135, 310 198 L 650 202 Z"
              fill="rgba(16, 185, 129, 0.14)"
              stroke="#10b981"
              strokeWidth="1.75"
            />
            <text x="415" y="140" fill="#4edea3" fontSize="11" fontFamily="JetBrains Mono" fontWeight="700">
              DIFFUSIONAL α + β WIDMANSTÄTTEN COLONY FIELD
            </text>
            <text x="415" y="156" fill="#bcc9cd" fontSize="10" fontFamily="JetBrains Mono">
              Equilibrium HCP α + BCC β (dT/dt &lt; 410 K/s or HIP)
            </text>

            {/* Acicular Martensite Quench Region (Left of Nose, Below Ms) */}
            <rect
              x="60"
              y="205"
              width="255"
              height="95"
              fill="rgba(245, 158, 11, 0.12)"
              stroke="rgba(245, 158, 11, 0.35)"
            />
            <text x="74" y="232" fill="#ffb95f" fontSize="11" fontFamily="JetBrains Mono" fontWeight="700">
              ACICULAR α&apos;-MARTENSITE QUENCH ZONE
            </text>
            <text x="74" y="248" fill="#bcc9cd" fontSize="10" fontFamily="JetBrains Mono">
              High UTS, Reduced Ductility (&lt;8% Elongation)
            </text>

            {/* Active Cooling Curve & Post-Heat-Treatment Trajectory */}
            {(() => {
              const isHighPreheat = params.preheatTempC >= 575 || params.mode === 'EBM';
              const preheatY = Math.min(285, Math.max(95, 290 - (params.preheatTempC / 1100) * 215));
              const quenchX = isHighPreheat ? 395 : 175;
              return (
                <>
                  <path
                    d={`M 85 30 Q ${quenchX * 0.65} 120, ${quenchX} ${preheatY} L 635 ${
                      params.heatTreatment === 'AS_BUILT' ? preheatY : 138
                    }`}
                    fill="none"
                    stroke="#06b6d4"
                    strokeWidth="2.5"
                  />
                  <circle cx="85" cy="30" r="4.5" fill="#ffb95f" />
                  <circle
                    cx="635"
                    cy={params.heatTreatment === 'AS_BUILT' ? preheatY : 138}
                    r="5"
                    fill="#4edea3"
                  />
                </>
              );
            })()}

            {/* Log-Time Horizontal Axis Labels */}
            {[
              { x: 90, label: '10⁻³ s' },
              { x: 200, label: '10⁻² s' },
              { x: 310, label: '10⁻¹ s' },
              { x: 420, label: '10⁰ s' },
              { x: 530, label: '10² s' },
              { x: 630, label: '10⁴ s (HIP)' },
            ].map((tick) => (
              <text
                key={tick.label}
                x={tick.x}
                y="324"
                textAnchor="middle"
                fill="#869397"
                fontSize="10"
                fontFamily="JetBrains Mono"
              >
                {tick.label}
              </text>
            ))}
          </svg>
        </div>

        {/* Interactive Thermal Conditioning Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
          <div className="bg-[#090e1c] border border-slate-800 rounded p-3 space-y-2">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-[#869397]">CHAMBER PREHEAT (T₀)</span>
              <span className="text-[#4cd7f6] font-semibold">{params.preheatTempC} °C</span>
            </div>
            <input
              type="range"
              aria-label="Chamber Preheat Temperature"
              min={25}
              max={750}
              step={15}
              value={params.preheatTempC}
              onChange={(e) => onChangePreheat(Number(e.target.value))}
              className="titanium-slider"
            />
            <div className="text-[11px] font-mono text-[#869397]">
              {params.preheatTempC >= 575
                ? 'Above M_s (575 °C): In-situ decomposition to ductile α+β'
                : 'Below M_s (575 °C): Rapid quench forms acicular α\'-martensite'}
            </div>
          </div>

          <div className="bg-[#090e1c] border border-slate-800 rounded p-3 space-y-2">
            <div className="text-xs font-mono text-[#869397] uppercase">
              POST-BUILD THERMAL / HIP CYCLE
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {(
                [
                  { id: 'AS_BUILT', label: 'As-Built' },
                  { id: 'STRESS_RELIEVED_650C', label: '650 °C Anneal' },
                  { id: 'SUB_TRANSUS_920C', label: '920 °C α+β' },
                  { id: 'HIP_900C_100MPA', label: 'HIP 900 °C' },
                ] as { id: HeatTreatmentMode; label: string }[]
              ).map((ht) => (
                <button
                  key={ht.id}
                  type="button"
                  onClick={() => onChangeHeatTreatment(ht.id)}
                  className={`px-2.5 py-1.5 rounded text-xs font-mono border transition-colors whitespace-nowrap ${
                    params.heatTreatment === ht.id
                      ? 'bg-[#06b6d4] text-[#0a0f1d] border-[#06b6d4] font-semibold'
                      : 'bg-[#0f172a] text-[#cbd5e1] border-slate-700 hover:border-slate-500'
                  }`}
                >
                  {ht.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Right 5 Columns: Synthetic Microstructure Metallography Visualizer & Crystallography */}
      <div className="lg:col-span-5 glass-level-1 rounded-lg p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
          <div className="flex items-center gap-2">
            <span className="w-1 h-4 bg-[#06b6d4] inline-block" aria-hidden="true" />
            <div>
              <h3 className="text-sm font-semibold text-[#dee2f6]">
                Synthetic Metallography &amp; Lath Morphology
              </h3>
              <p className="text-[11px] font-mono text-[#869397]">
                BURGERS ORIENTATION: &#123;0001&#125;_α ∥ &#123;110&#125;_β · ⟨112̄0⟩_α ∥ ⟨111⟩_β
              </p>
            </div>
          </div>
        </div>

        <div className="rounded border border-slate-800 overflow-hidden bg-[#090e1c]">
          <canvas
            ref={microCanvasRef}
            width={440}
            height={250}
            className="w-full h-[240px] block"
          />
        </div>

        <div className="grid grid-cols-3 gap-2 font-mono text-center">
          <div className="bg-[#090e1c] border border-slate-800 rounded p-2.5">
            <div className="text-[10px] text-[#869397]">HCP α-LAMELLAR</div>
            <div className="text-lg font-bold text-[#4cd7f6] mt-0.5">
              {diagnostics.phases.alphaLamellarPct}%
            </div>
          </div>
          <div className="bg-[#090e1c] border border-slate-800 rounded p-2.5">
            <div className="text-[10px] text-[#869397]">α&apos;-MARTENSITE</div>
            <div className="text-lg font-bold text-[#ffb95f] mt-0.5">
              {diagnostics.phases.alphaPrimeMartensitePct}%
            </div>
          </div>
          <div className="bg-[#090e1c] border border-slate-800 rounded p-2.5">
            <div className="text-[10px] text-[#869397]">BCC β-RETAINED</div>
            <div className="text-lg font-bold text-[#4edea3] mt-0.5">
              {diagnostics.phases.betaRetainedPct}%
            </div>
          </div>
        </div>

        <div className="bg-[#090e1c] border border-slate-800 rounded p-3 text-xs font-mono text-[#bcc9cd] space-y-1.5">
          <div className="text-[#dee2f6] font-semibold">
            METALLURGICAL PHASE SYNTHESIS REPORT:
          </div>
          <p className="leading-relaxed">
            {diagnostics.phases.alphaPrimeMartensitePct > 40
              ? `High solidification cooling rate (${(diagnostics.coolingRateKs / 1000).toFixed(0)}×10³ K/s) suppresses vanadium diffusion, producing ${diagnostics.phases.alphaPrimeMartensitePct}% acicular α'-martensite within ${diagnostics.phases.priorBetaGrainWidthUm} μm columnar prior-β grains. Recommend 900 °C HIP or 920 °C sub-transus anneal to restore ≥10% aerospace elongation.`
              : `Equilibrium α+β lamellar colony structure (${diagnostics.phases.alphaLamellarPct}% α, ${diagnostics.phases.betaRetainedPct}% β) with ${diagnostics.phases.alphaLathThicknessUm} μm average lath width satisfies ${diagnostics.astmStandard} ductility and tensile toughness requirements.`}
          </p>
        </div>
      </div>
    </div>
  );
};
