import React, { useState } from 'react';
import {
  HeatTreatmentMode,
  MeltPoolDiagnostics,
  ProcessParameters,
} from '../../physics/titaniumPhysics';

interface PhaseDiagnosticsPanelProps {
  params: ProcessParameters;
  diagnostics: MeltPoolDiagnostics;
  onChangeHeatTreatment: (ht: HeatTreatmentMode) => void;
}

const HEAT_TREATMENT_OPTIONS: { id: HeatTreatmentMode; label: string; spec: string }[] = [
  { id: 'AS_BUILT', label: 'As-Built State', spec: 'Rapid Solidification' },
  { id: 'STRESS_RELIEVED_650C', label: '650 °C Stress Relief', spec: '2h Vacuum Anneal' },
  { id: 'SUB_TRANSUS_920C', label: '920 °C Sub-Transus', spec: 'α+β Coarsening' },
  { id: 'HIP_900C_100MPA', label: 'HIP 900 °C @ 100 MPa', spec: 'Pore Closure + α+β' },
];

export const PhaseDiagnosticsPanel: React.FC<PhaseDiagnosticsPanelProps> = ({
  params,
  diagnostics,
  onChangeHeatTreatment,
}) => {
  const [hoveredPhase, setHoveredPhase] = useState<'ALPHA' | 'ALPHA_PRIME' | 'BETA' | null>(null);

  const regimeBadge = (() => {
    switch (diagnostics.regime) {
      case 'NOMINAL_CONDUCTION':
        return {
          title: `${diagnostics.astmStandard} VERIFIED`,
          subtitle: 'STABLE CONDUCTION EQUILIBRIUM',
          toneClass:
            'bg-[#10b981]/15 border-[#10b981]/50 text-[#4edea3]',
          glyph: '●',
        };
      case 'KEYHOLE_POROSITY':
        return {
          title: 'KEYHOLE DEFECT HAZARD',
          subtitle: 'VAPOR CAVITY COLLAPSE & ROOT POROSITY',
          toneClass:
            'bg-[#ef4444]/15 border-[#ef4444]/60 text-[#ffb4ab]',
          glyph: '▲',
        };
      case 'BALLING_INSTABILITY':
        return {
          title: 'BALLING INSTABILITY',
          subtitle: 'PLATEAU-RAYLEIGH CAPILLARY BREAKUP',
          toneClass:
            'bg-[#f59e0b]/15 border-[#f59e0b]/50 text-[#ffb95f]',
          glyph: '▲',
        };
      case 'LACK_OF_FUSION':
        return {
          title: 'LACK OF FUSION HAZARD',
          subtitle: 'INSUFFICIENT INTER-LAYER PENETRATION',
          toneClass:
            'bg-[#f59e0b]/15 border-[#f59e0b]/50 text-[#ffb95f]',
          glyph: '✖',
        };
    }
  })();

  return (
    <aside className="flex flex-col gap-4" aria-label="ASTM Compliance and Phase Evolution">
      {/* 1. ASTM F2924 / F3001 Qualification Status Card */}
      <div
        className={`rounded-lg p-4 ${
          diagnostics.astmCompliant ? 'glass-level-1' : 'glass-level-3-amber'
        } space-y-3`}
      >
        <div className="flex items-center justify-between gap-2 border-b border-slate-800/80 pb-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-1 h-4 bg-[#06b6d4] inline-block shrink-0" aria-hidden="true" />
            <h2 className="text-xs font-mono uppercase tracking-wider text-[#dee2f6] whitespace-nowrap truncate">
              Aerospace Certification
            </h2>
          </div>
          <span className="text-[11px] font-mono text-[#869397] whitespace-nowrap shrink-0">
            Ti-6Al-4V
          </span>
        </div>

        {/* Calibrated Square-Corner Status Readout */}
        <div
          data-testid="compliance-status-banner"
          className={`p-3 rounded border font-mono ${regimeBadge.toneClass}`}
        >
          <div className="flex items-center justify-between text-xs font-bold tracking-wider">
            <span>
              {regimeBadge.glyph} {regimeBadge.title}
            </span>
            <span>{diagnostics.relativeDensityPct.toFixed(2)}% DENSE</span>
          </div>
          <div className="text-[11px] opacity-90 mt-1">{regimeBadge.subtitle}</div>
        </div>

        {/* Diagnostic Criteria Breakdown */}
        <ul className="space-y-1.5 text-xs font-mono text-[#bcc9cd]">
          {diagnostics.complianceReasons.map((reason, idx) => (
            <li key={idx} className="flex items-start gap-2">
              <span
                className={
                  diagnostics.astmCompliant ? 'text-[#10b981]' : 'text-[#ffb95f]'
                }
                aria-hidden="true"
              >
                {diagnostics.astmCompliant ? '✓' : '▪'}
              </span>
              <span>{reason}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* 2. Specialized Laboratory Component: Microstructure Phase Ratio Gauges */}
      <div className="glass-level-1 rounded-lg p-4 space-y-3.5">
        <div className="flex items-center justify-between gap-2 border-b border-slate-800/80 pb-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-1 h-4 bg-[#06b6d4] inline-block shrink-0" aria-hidden="true" />
            <h2 className="text-xs font-mono uppercase tracking-wider text-[#dee2f6] whitespace-nowrap truncate">
              Allotropic Phase Ratio
            </h2>
          </div>
          <span className="text-[11px] font-mono text-[#4cd7f6] whitespace-nowrap shrink-0">
            α / α&apos; / β
          </span>
        </div>

        {/* Interactive Segmented Volume Fraction Bar */}
        <div className="space-y-2">
          <div
            className="h-6 w-full rounded bg-[#090e1c] border border-slate-800 p-0.5 flex gap-0.5 overflow-hidden"
            role="img"
            aria-label={`Phase volume fractions: ${diagnostics.phases.alphaLamellarPct}% alpha lamellar, ${diagnostics.phases.alphaPrimeMartensitePct}% alpha-prime martensite, ${diagnostics.phases.betaRetainedPct}% retained beta`}
          >
            {diagnostics.phases.alphaLamellarPct > 0 && (
              <div
                onMouseEnter={() => setHoveredPhase('ALPHA')}
                onMouseLeave={() => setHoveredPhase(null)}
                style={{ width: `${diagnostics.phases.alphaLamellarPct}%` }}
                className="h-full bg-[#06b6d4] transition-all duration-200 flex items-center justify-center text-[10px] font-mono font-bold text-[#0a0f1d] overflow-hidden cursor-pointer"
                title={`Equilibrium HCP α-Lamellar: ${diagnostics.phases.alphaLamellarPct}%`}
              >
                {diagnostics.phases.alphaLamellarPct >= 16 &&
                  `α ${diagnostics.phases.alphaLamellarPct}%`}
              </div>
            )}
            {diagnostics.phases.alphaPrimeMartensitePct > 0 && (
              <div
                onMouseEnter={() => setHoveredPhase('ALPHA_PRIME')}
                onMouseLeave={() => setHoveredPhase(null)}
                style={{ width: `${diagnostics.phases.alphaPrimeMartensitePct}%` }}
                className="h-full bg-[#f59e0b] transition-all duration-200 flex items-center justify-center text-[10px] font-mono font-bold text-[#0a0f1d] overflow-hidden cursor-pointer"
                title={`Acicular α'-Martensite: ${diagnostics.phases.alphaPrimeMartensitePct}%`}
              >
                {diagnostics.phases.alphaPrimeMartensitePct >= 16 &&
                  `α' ${diagnostics.phases.alphaPrimeMartensitePct}%`}
              </div>
            )}
            {diagnostics.phases.betaRetainedPct > 0 && (
              <div
                onMouseEnter={() => setHoveredPhase('BETA')}
                onMouseLeave={() => setHoveredPhase(null)}
                style={{ width: `${diagnostics.phases.betaRetainedPct}%` }}
                className="h-full bg-[#10b981] transition-all duration-200 flex items-center justify-center text-[10px] font-mono font-bold text-[#0a0f1d] overflow-hidden cursor-pointer"
                title={`Retained BCC β-Phase: ${diagnostics.phases.betaRetainedPct}%`}
              >
                {diagnostics.phases.betaRetainedPct >= 12 &&
                  `β ${diagnostics.phases.betaRetainedPct}%`}
              </div>
            )}
          </div>

          {/* Interactive Crystallographic Coordinate Readout */}
          <div className="bg-[#090e1c] border border-slate-800/90 rounded p-2.5 text-[11px] font-mono text-[#bcc9cd]">
            {hoveredPhase === 'ALPHA' && (
              <div>
                <span className="text-[#4cd7f6] font-semibold">HCP α-LAMELLAR (P6₃/mmc):</span>{' '}
                a = 0.295 nm, c = 0.468 nm · Ductile Widmanstätten colonies ({diagnostics.phases.alphaLamellarPct}%)
              </div>
            )}
            {hoveredPhase === 'ALPHA_PRIME' && (
              <div>
                <span className="text-[#ffb95f] font-semibold">ACICULAR α&apos;-MARTENSITE:</span>{' '}
                Supersaturated vanadium needle plates formed at dT/dt &gt; 410 K/s ({diagnostics.phases.alphaPrimeMartensitePct}%)
              </div>
            )}
            {hoveredPhase === 'BETA' && (
              <div>
                <span className="text-[#4edea3] font-semibold">BCC β-RETENTION (Im3m):</span>{' '}
                a = 0.331 nm · Vanadium-stabilized interfacial ribs ({diagnostics.phases.betaRetainedPct}%)
              </div>
            )}
            {!hoveredPhase && (
              <div className="flex items-center justify-between text-[#869397] whitespace-nowrap">
                <span className="text-[#4cd7f6]">α-HCP: {diagnostics.phases.alphaLamellarPct}%</span>
                <span aria-hidden="true">·</span>
                <span className="text-[#ffb95f]">α&apos;: {diagnostics.phases.alphaPrimeMartensitePct}%</span>
                <span aria-hidden="true">·</span>
                <span className="text-[#4edea3]">β-BCC: {diagnostics.phases.betaRetainedPct}%</span>
              </div>
            )}
          </div>
        </div>

        {/* Post-Process Thermal / HIP Selector */}
        <div className="space-y-1.5 pt-1">
          <div className="text-[11px] font-mono uppercase tracking-wider text-[#869397]">
            POST-PROCESS THERMAL CONDITION
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {HEAT_TREATMENT_OPTIONS.map((opt) => {
              const active = params.heatTreatment === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => onChangeHeatTreatment(opt.id)}
                  className={`p-2 rounded border text-left transition-colors ${
                    active
                      ? 'bg-[#1a1f2e] border-[#06b6d4] text-[#dee2f6]'
                      : 'bg-[#090e1c]/70 border-slate-800 text-[#869397] hover:border-slate-600'
                  }`}
                >
                  <div className="text-[11px] font-mono font-semibold truncate">{opt.label}</div>
                  <div className="text-[10px] font-mono opacity-75 truncate">{opt.spec}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Grain & Lath Dimension Readouts */}
        <div className="grid grid-cols-2 gap-2 pt-1">
          <div className="bg-[#090e1c] border border-slate-800 rounded p-2.5">
            <div className="text-[10px] font-mono text-[#869397]">PRIOR-β COLUMN WIDTH</div>
            <div className="mt-0.5">
              <span className="text-lg font-mono font-semibold text-[#dee2f6]">
                {diagnostics.phases.priorBetaGrainWidthUm}
              </span>
              <span className="text-xs font-mono text-[#869397] ml-1">μm</span>
            </div>
          </div>
          <div className="bg-[#090e1c] border border-slate-800 rounded p-2.5">
            <div className="text-[10px] font-mono text-[#869397]">α-LATH THICKNESS</div>
            <div className="mt-0.5">
              <span className="text-lg font-mono font-semibold text-[#4cd7f6]">
                {diagnostics.phases.alphaLathThicknessUm}
              </span>
              <span className="text-xs font-mono text-[#869397] ml-1">μm</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Predicted Tensile & Densification Telemetry Card */}
      <div className="glass-level-1 rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between gap-2 border-b border-slate-800/80 pb-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-1 h-4 bg-[#06b6d4] inline-block shrink-0" aria-hidden="true" />
            <h2 className="text-xs font-mono uppercase tracking-wider text-[#dee2f6] whitespace-nowrap truncate">
              Mechanical Metrics
            </h2>
          </div>
          <span className="text-[11px] font-mono text-[#869397] whitespace-nowrap shrink-0">
            ASTM E8
          </span>
        </div>

        <div className="space-y-2.5 font-mono">
          <div className="flex items-baseline justify-between">
            <span className="text-xs text-[#bcc9cd]">ULTIMATE TENSILE (UTS)</span>
            <div>
              <span className="text-lg font-bold text-[#dee2f6]">{diagnostics.tensileUtsMpa}</span>
              <span className="text-xs text-[#869397] ml-1">MPa</span>
              <span className="text-[10px] text-[#4edea3] ml-2">(≥895)</span>
            </div>
          </div>

          <div className="flex items-baseline justify-between">
            <span className="text-xs text-[#bcc9cd]">0.2% YIELD STRENGTH</span>
            <div>
              <span className="text-lg font-bold text-[#dee2f6]">{diagnostics.yieldStrengthMpa}</span>
              <span className="text-xs text-[#869397] ml-1">MPa</span>
              <span className="text-[10px] text-[#4edea3] ml-2">(≥825)</span>
            </div>
          </div>

          <div className="flex items-baseline justify-between">
            <span className="text-xs text-[#bcc9cd]">ELONGATION AT BREAK</span>
            <div>
              <span
                className={`text-lg font-bold ${
                  diagnostics.elongationPct >= 10.0 ? 'text-[#4edea3]' : 'text-[#ffb95f]'
                }`}
              >
                {diagnostics.elongationPct.toFixed(1)}
              </span>
              <span className="text-xs text-[#869397] ml-1">%</span>
              <span className="text-[10px] text-[#869397] ml-2">(≥10.0%)</span>
            </div>
          </div>

          <div className="flex items-baseline justify-between pt-1 border-t border-slate-800/80">
            <span className="text-xs text-[#bcc9cd]">POOL ASPECT RATIO (D/W)</span>
            <div>
              <span
                className={`text-base font-bold ${
                  diagnostics.aspectRatioDW > 0.85 ? 'text-[#ef4444]' : 'text-[#4cd7f6]'
                }`}
              >
                {diagnostics.aspectRatioDW.toFixed(2)}
              </span>
              <span className="text-[10px] text-[#869397] ml-2">KEYHOLE &gt;0.85</span>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
};
