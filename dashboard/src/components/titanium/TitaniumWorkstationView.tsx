import React, { useMemo, useState } from 'react';
import {
  computeMeltPoolDiagnostics,
  HeatTreatmentMode,
  INITIAL_COUPONS,
  PRESET_PROFILES,
  ProcessParameters,
  QualificationCoupon,
} from '../../physics/titaniumPhysics';
import { ProcessParameterPanel } from './ProcessParameterPanel';
import { MeltPoolPyrometryCanvas } from './MeltPoolPyrometryCanvas';
import { PhaseDiagnosticsPanel } from './PhaseDiagnosticsPanel';
import { ProcessWindowScreen } from './ProcessWindowScreen';
import { PhaseKineticsScreen } from './PhaseKineticsScreen';
import { QualificationLogScreen } from './QualificationLogScreen';
import { Flame, Compass, Activity, FileCheck2, RefreshCw, ShieldAlert, Sparkles, AlertCircle } from 'lucide-react';

export type TitaniumActiveScreen =
  | 'MELT_POOL'
  | 'PROCESS_WINDOW'
  | 'PHASE_KINETICS'
  | 'QUALIFICATION_LOG';

const NAV_ITEMS: { id: TitaniumActiveScreen; label: string; icon: React.ReactNode }[] = [
  { id: 'MELT_POOL', label: 'Melt Pool Simulation & Pyrometry', icon: <Flame className="w-4 h-4 text-[#4cd7f6]" /> },
  { id: 'PROCESS_WINDOW', label: 'Process Window & Defect Regimes', icon: <Compass className="w-4 h-4 text-amber-400" /> },
  { id: 'PHASE_KINETICS', label: 'Phase & CCT Kinetics', icon: <Activity className="w-4 h-4 text-emerald-400" /> },
  { id: 'QUALIFICATION_LOG', label: 'ASTM Qualification Ledger', icon: <FileCheck2 className="w-4 h-4 text-cyan-400" /> },
];

export interface TitaniumWorkstationViewProps {
  initialPower?: number;
  initialSpeed?: number;
  initialPreheat?: number;
  onNavigateParentSection?: (sectionId: string) => void;
}

export const TitaniumWorkstationView: React.FC<TitaniumWorkstationViewProps> = ({
  initialPower,
  initialSpeed,
  initialPreheat,
}) => {
  const [activeScreen, setActiveScreen] = useState<TitaniumActiveScreen>('MELT_POOL');
  const [params, setParams] = useState<ProcessParameters>(() => {
    const base = { ...PRESET_PROFILES[0].params };
    if (typeof initialPower === 'number') base.laserPowerW = initialPower;
    if (typeof initialSpeed === 'number') base.scanSpeedMmS = initialSpeed;
    if (typeof initialPreheat === 'number') base.preheatTempC = initialPreheat;
    return base;
  });
  const [activePresetId, setActivePresetId] = useState<string | null>(PRESET_PROFILES[0].id);
  const [isSimulating, setIsSimulating] = useState<boolean>(true);
  const [isAborted, setIsAborted] = useState<boolean>(false);
  const [coupons, setCoupons] = useState<QualificationCoupon[]>(INITIAL_COUPONS);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const diagnostics = useMemo(() => computeMeltPoolDiagnostics(params), [params]);

  const handleUpdateParams = (next: Partial<ProcessParameters>) => {
    setParams((prev) => ({ ...prev, ...next }));
    setActivePresetId(null);
  };

  const handleSelectPreset = (presetId: string) => {
    const found = PRESET_PROFILES.find((p) => p.id === presetId);
    if (found) {
      setParams(found.params);
      setActivePresetId(found.id);
      setIsAborted(false);
      setStatusMessage(`Loaded preset profile: ${found.name}`);
    }
  };

  const handleResetNominal = () => {
    setParams(PRESET_PROFILES[0].params);
    setActivePresetId(PRESET_PROFILES[0].id);
    setIsAborted(false);
    setStatusMessage('Calibrated to Nominal Aerospace Grade-5 Conduction Window (280W, 1200 mm/s)');
  };

  const handleLogCurrentCoupon = () => {
    const nextNumber = 1042 + coupons.length;
    const suffixChar = String.fromCharCode(65 + (coupons.length % 26));
    const newCoupon: QualificationCoupon = {
      id: `TI64-${nextNumber}${suffixChar}`,
      batchCode: 'B26-AERO-LIVE',
      timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC',
      mode: params.mode,
      laserPowerW: params.laserPowerW,
      scanSpeedMmS: params.scanSpeedMmS,
      hatchSpacingUm: params.hatchSpacingUm,
      layerThicknessUm: params.layerThicknessUm,
      preheatTempC: params.preheatTempC,
      heatTreatment: params.heatTreatment,
      vedJmm3: diagnostics.volumetricEnergyDensity,
      relativeDensityPct: diagnostics.relativeDensityPct,
      utsMpa: diagnostics.tensileUtsMpa,
      ysMpa: diagnostics.yieldStrengthMpa,
      elongationPct: diagnostics.elongationPct,
      regime: diagnostics.regime,
      astmCompliant: diagnostics.astmCompliant,
    };

    setCoupons((prev) => [newCoupon, ...prev]);
    setStatusMessage(
      `Recorded Coupon ${newCoupon.id} (${newCoupon.vedJmm3.toFixed(2)} J/mm³, ${newCoupon.relativeDensityPct.toFixed(2)}% dense) to ASTM Qualification Ledger`
    );
  };

  const handleLoadCouponToSimulator = (coupon: QualificationCoupon) => {
    setParams({
      mode: coupon.mode,
      laserPowerW: coupon.laserPowerW,
      scanSpeedMmS: coupon.scanSpeedMmS,
      hatchSpacingUm: coupon.hatchSpacingUm,
      layerThicknessUm: coupon.layerThicknessUm,
      preheatTempC: coupon.preheatTempC,
      heatTreatment: coupon.heatTreatment,
    });
    setActivePresetId(null);
    setIsAborted(false);
    setActiveScreen('MELT_POOL');
    setStatusMessage(`Loaded Coupon ${coupon.id} parameters into Melt Pool Pyrometry Simulator`);
  };

  return (
    <div className="w-full bg-[#0a0f1d] border border-[#1e293b] rounded-2xl overflow-hidden shadow-2xl text-[#dee2f6]">
      {/* Workstation Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-4 border-b border-slate-800/80 bg-[#090e1c]/95">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#00f7ff]/20 to-[#6366f1]/20 border border-[#00f7ff]/40 flex items-center justify-center shadow-[0_0_15px_rgba(0,247,255,0.2)]">
            <Flame className="w-5 h-5 text-[#00f7ff]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-bold tracking-tight text-white font-mono">
                Titanium Additive Physics Workstation
              </h2>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#00f7ff]/10 text-[#00f7ff] border border-[#00f7ff]/30 font-bold">
                Ti-6Al-4V L-PBF &amp; EBM
              </span>
            </div>
            <p className="text-xs text-[#869397]">
              Precision thermal pyrometry, melt pool fluid dynamics, and ASTM F2924/F3001 metallurgical phase diagnostics
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleResetNominal}
            className="px-3 py-1.5 rounded-lg border border-slate-700 hover:border-slate-500 bg-slate-800/40 hover:bg-slate-800 text-xs text-[#cbd5e1] font-mono flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Nominal Preset</span>
          </button>

          <button
            type="button"
            onClick={handleLogCurrentCoupon}
            className="px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-emerald-500/20 to-teal-500/20 border border-emerald-500/40 hover:border-emerald-500 text-emerald-300 hover:text-white text-xs font-mono font-bold flex items-center gap-1.5 transition-all shadow-[0_0_12px_rgba(16,185,129,0.15)] cursor-pointer"
          >
            <FileCheck2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Log ASTM Coupon</span>
          </button>
        </div>
      </div>

      {/* 4 Interactive Navigation Tabs */}
      <div className="flex items-center gap-1 px-6 pt-3 border-b border-slate-800/80 bg-[#090e1c] overflow-x-auto no-scrollbar">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setActiveScreen(item.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-mono font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeScreen === item.id
                ? 'border-[#00f7ff] text-[#00f7ff] bg-white/[0.04]'
                : 'border-transparent text-[#869397] hover:text-[#dee2f6] hover:bg-white/[0.02]'
            }`}
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        ))}
      </div>

      {/* Live System Notification Banner */}
      {statusMessage && (
        <div className="px-6 py-2.5 bg-[#0e172a] border-b border-slate-800 flex items-center justify-between text-xs font-mono text-[#cbd5e1]">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#00f7ff] animate-ping" />
            <span>{statusMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setStatusMessage(null)}
            className="text-slate-500 hover:text-slate-300 ml-4 font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* Screen Views */}
      <div className="p-6">
        {activeScreen === 'MELT_POOL' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* 3 Columns: Process Variable Controls */}
            <div className="lg:col-span-3">
              <ProcessParameterPanel
                params={params}
                diagnostics={diagnostics}
                activePresetId={activePresetId}
                onChangeParams={handleUpdateParams}
                onSelectPreset={handleSelectPreset}
                onResetNominal={handleResetNominal}
                onLogCoupon={handleLogCurrentCoupon}
              />
            </div>

            {/* 6 Columns: 3D/2D Melt Pool Thermal Pyrometry & Solidification Viewport */}
            <div className="lg:col-span-6">
              <MeltPoolPyrometryCanvas
                params={params}
                diagnostics={diagnostics}
                isSimulating={isSimulating}
                isAborted={isAborted}
                onToggleSimulation={() => setIsSimulating((s) => !s)}
                onEmergencyAbort={() => {
                  setIsAborted(true);
                  setStatusMessage('Emergency Beam Abort triggered: Optical emitter quenched to substrate preheat.');
                }}
                onResetBeam={() => {
                  setIsAborted(false);
                  setStatusMessage('Optical emitter re-armed: Thermal melt pool restored.');
                }}
              />
            </div>

            {/* 3 Columns: Real-Time ASTM Compliance & Metallurgical Phase Evolution Diagnostics */}
            <div className="lg:col-span-3">
              <PhaseDiagnosticsPanel
                params={params}
                diagnostics={diagnostics}
                onChangeHeatTreatment={(ht: HeatTreatmentMode) =>
                  handleUpdateParams({ heatTreatment: ht })
                }
              />
            </div>
          </div>
        )}

        {activeScreen === 'PROCESS_WINDOW' && (
          <ProcessWindowScreen
            params={params}
            diagnostics={diagnostics}
            coupons={coupons}
            onUpdatePowerSpeed={(powerW, speedMmS) => {
              handleUpdateParams({ laserPowerW: powerW, scanSpeedMmS: speedMmS });
              setStatusMessage(`Recalibrated operating point on P–v map: P = ${powerW} W, v = ${speedMmS} mm/s`);
            }}
            onLoadCouponToSimulator={handleLoadCouponToSimulator}
            onJumpToSimulator={() => setActiveScreen('MELT_POOL')}
          />
        )}

        {activeScreen === 'PHASE_KINETICS' && (
          <PhaseKineticsScreen
            params={params}
            diagnostics={diagnostics}
            onChangeHeatTreatment={(ht) => handleUpdateParams({ heatTreatment: ht })}
            onChangePreheat={(tempC) => handleUpdateParams({ preheatTempC: tempC })}
          />
        )}

        {activeScreen === 'QUALIFICATION_LOG' && (
          <QualificationLogScreen
            params={params}
            diagnostics={diagnostics}
            coupons={coupons}
            onLogCurrentCoupon={handleLogCurrentCoupon}
            onLoadCoupon={handleLoadCouponToSimulator}
          />
        )}
      </div>

      {/* Laboratory Footnote */}
      <div className="border-t border-slate-800/80 bg-[#090e1c] px-6 py-3.5 flex flex-wrap items-center justify-between gap-4 text-[11px] font-mono text-[#869397]">
        <div>
          TITANIUM ADDITIVE PHYSICS WORKSTATION · GRADE-5 Ti-6Al-4V (UNS R56400) · ASTM F2924 / F3001 AEROSPACE SPECIFICATION
        </div>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={handleResetNominal}
            className="hover:text-[#4cd7f6] transition-colors cursor-pointer"
          >
            Restore Nominal Calibration
          </button>
          <span>·</span>
          <button
            type="button"
            onClick={() => setActiveScreen('QUALIFICATION_LOG')}
            className="hover:text-[#4cd7f6] transition-colors cursor-pointer"
          >
            Ledger Coupons ({coupons.length})
          </button>
        </div>
      </div>
    </div>
  );
};
