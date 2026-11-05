import React from 'react';
import {
  MeltPoolDiagnostics,
  PRESET_PROFILES,
  ProcessMode,
  ProcessParameters,
} from '../../physics/titaniumPhysics';

interface ProcessParameterPanelProps {
  params: ProcessParameters;
  diagnostics: MeltPoolDiagnostics;
  activePresetId: string | null;
  onChangeParams: (next: Partial<ProcessParameters>) => void;
  onSelectPreset: (presetId: string) => void;
  onResetNominal: () => void;
  onLogCoupon: () => void;
}

interface SliderControlRowProps {
  id: string;
  label: string;
  symbol: string;
  unit: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (val: number) => void;
}

const SliderControlRow: React.FC<SliderControlRowProps> = ({
  id,
  label,
  symbol,
  unit,
  value,
  min,
  max,
  step,
  onChange,
}) => {
  const pct = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={id} className="text-xs font-medium text-[#bcc9cd]">
          {label}{' '}
          <span className="font-mono text-[#4cd7f6] tracking-wider">({symbol})</span>
        </label>
        <div className="flex items-center gap-1">
          <input
            id={id}
            type="number"
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={(e) => {
              const num = Number(e.target.value);
              if (!Number.isNaN(num)) {
                onChange(Math.max(min, Math.min(max, num)));
              }
            }}
            className="w-20 px-2 py-1 text-right text-xs font-mono text-[#dee2f6] bg-[#070b14] border border-[#334155] rounded focus:outline-none focus:border-[#06b6d4]"
          />
          <span className="text-[11px] font-mono text-[#869397] w-9">{unit}</span>
        </div>
      </div>

      {/* Precision Thin Track with Gradient Fill Segment */}
      <div className="relative flex items-center h-4">
        <div
          className="pointer-events-none absolute left-0 h-[2px] rounded-l"
          style={{
            width: `${pct}%`,
            background: 'linear-gradient(90deg, #06b6d4 0%, #14b8a6 100%)',
          }}
        />
        <input
          type="range"
          aria-label={`${label} slider`}
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="titanium-slider relative z-10"
        />
      </div>

      <div className="flex justify-between text-[10px] font-mono text-[#64748b]">
        <span>
          {min} {unit}
        </span>
        <span>
          {max} {unit}
        </span>
      </div>
    </div>
  );
};

export const ProcessParameterPanel: React.FC<ProcessParameterPanelProps> = ({
  params,
  diagnostics,
  activePresetId,
  onChangeParams,
  onSelectPreset,
  onResetNominal,
  onLogCoupon,
}) => {
  const handleModeSwitch = (mode: ProcessMode) => {
    if (mode === 'EBM' && params.preheatTempC < 580) {
      onChangeParams({ mode: 'EBM', preheatTempC: 680, layerThicknessUm: 50 });
    } else if (mode === 'LPBF' && params.preheatTempC > 300) {
      onChangeParams({ mode: 'LPBF', preheatTempC: 120, layerThicknessUm: 30 });
    } else {
      onChangeParams({ mode });
    }
  };

  return (
    <aside className="flex flex-col gap-4" aria-label="Additive Process Variable Controls">
      {/* Process Architecture & Preset Selector Card */}
      <div className="glass-level-1 rounded-lg p-4 space-y-3.5">
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
          <div className="flex items-center gap-2">
            <span className="w-1 h-4 bg-[#06b6d4] inline-block" aria-hidden="true" />
            <h2 className="text-xs font-mono uppercase tracking-wider text-[#dee2f6]">
              Beam & Chamber Architecture
            </h2>
          </div>
          <span className="text-[11px] font-mono text-[#4cd7f6]">{diagnostics.astmStandard}</span>
        </div>

        {/* Calibrated Square Radio Selectors with Inner Diamond Mark */}
        <div role="radiogroup" aria-label="Additive Process Mode" className="grid grid-cols-2 gap-2">
          {(['LPBF', 'EBM'] as ProcessMode[]).map((modeOption) => {
            const selected = params.mode === modeOption;
            return (
              <button
                key={modeOption}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => handleModeSwitch(modeOption)}
                className={`flex items-center gap-2.5 p-2.5 rounded border text-left transition-colors ${
                  selected
                    ? 'bg-[#161b2a] border-[#06b6d4] text-[#dee2f6]'
                    : 'bg-[#090e1c]/80 border-[#334155] text-[#869397] hover:border-[#64748b]'
                }`}
              >
                <span className="w-4 h-4 rounded-[2px] border border-[#06b6d4] flex items-center justify-center shrink-0 bg-[#070b14]">
                  {selected && (
                    <span className="w-2 h-2 bg-[#06b6d4] rotate-45 block" aria-hidden="true" />
                  )}
                </span>
                <div className="min-w-0">
                  <div className="text-xs font-mono font-semibold tracking-wider">
                    {modeOption === 'LPBF' ? 'L-PBF LASER' : 'EBM ELECTRON'}
                  </div>
                  <div className="text-[10px] font-mono text-[#869397] truncate">
                    {modeOption === 'LPBF' ? 'Ar Shield · F2924' : 'Vacuum · F3001'}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Calibrated Reference Presets */}
        <div className="space-y-1.5">
          <div className="text-[11px] font-mono uppercase tracking-wider text-[#869397]">
            METALLURGICAL OPERATING PRESETS
          </div>
          <div className="grid grid-cols-1 gap-1.5">
            {PRESET_PROFILES.map((preset) => {
              const isSelected = activePresetId === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => onSelectPreset(preset.id)}
                  className={`px-2.5 py-2 rounded border text-left transition-colors flex items-center justify-between gap-2 ${
                    isSelected
                      ? 'bg-[#1a1f2e] border-[#06b6d4] text-[#dee2f6]'
                      : 'bg-[#090e1c]/60 border-slate-800 text-[#bcc9cd] hover:border-slate-600'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="text-xs font-medium truncate">{preset.name}</div>
                    <div className="text-[10px] font-mono text-[#869397] truncate">
                      {preset.subtitle}
                    </div>
                  </div>
                  <span className="text-[10px] font-mono text-[#4cd7f6] shrink-0">
                    {preset.params.laserPowerW}W / {preset.params.scanSpeedMmS}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Primary Process Variable Sliders Card */}
      <div className="glass-level-1 rounded-lg p-4 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
          <div className="flex items-center gap-2">
            <span className="w-1 h-4 bg-[#06b6d4] inline-block" aria-hidden="true" />
            <h2 className="text-xs font-mono uppercase tracking-wider text-[#dee2f6]">
              Vector & Energy Parameters
            </h2>
          </div>
          <button
            type="button"
            onClick={onResetNominal}
            className="text-[11px] font-mono text-[#4cd7f6] hover:underline whitespace-nowrap shrink-0"
          >
            Reset Nominal
          </button>
        </div>

        <SliderControlRow
          id="input-laser-power"
          label="Beam Power"
          symbol="P"
          unit="W"
          value={params.laserPowerW}
          min={100}
          max={500}
          step={5}
          onChange={(val) => onChangeParams({ laserPowerW: val })}
        />

        <SliderControlRow
          id="input-scan-speed"
          label="Scan Vector Speed"
          symbol="v"
          unit="mm/s"
          value={params.scanSpeedMmS}
          min={200}
          max={2000}
          step={20}
          onChange={(val) => onChangeParams({ scanSpeedMmS: val })}
        />

        <SliderControlRow
          id="input-hatch-spacing"
          label="Hatch Spacing"
          symbol="h"
          unit="μm"
          value={params.hatchSpacingUm}
          min={50}
          max={180}
          step={5}
          onChange={(val) => onChangeParams({ hatchSpacingUm: val })}
        />

        <SliderControlRow
          id="input-layer-thickness"
          label="Powder Layer Thickness"
          symbol="t"
          unit="μm"
          value={params.layerThicknessUm}
          min={20}
          max={90}
          step={5}
          onChange={(val) => onChangeParams({ layerThicknessUm: val })}
        />

        <SliderControlRow
          id="input-preheat-temp"
          label="Substrate Preheat"
          symbol="T₀"
          unit="°C"
          value={params.preheatTempC}
          min={25}
          max={750}
          step={5}
          onChange={(val) => onChangeParams({ preheatTempC: val })}
        />

        {/* Volumetric Energy Density Readout Well */}
        <div className="bg-[#090e1c] border border-slate-800 rounded p-3 space-y-2">
          <div className="flex items-baseline justify-between">
            <span className="text-[11px] font-mono uppercase tracking-wider text-[#869397]">
              VOLUMETRIC ENERGY (E_v)
            </span>
            <div>
              <span
                data-testid="ved-readout"
                className={`text-xl font-mono font-bold ${
                  diagnostics.regime === 'NOMINAL_CONDUCTION'
                    ? 'text-[#4cd7f6]'
                    : diagnostics.regime === 'KEYHOLE_POROSITY'
                      ? 'text-[#ef4444]'
                      : 'text-[#ffb95f]'
                }`}
              >
                {diagnostics.volumetricEnergyDensity.toFixed(2)}
              </span>
              <span className="text-xs font-mono text-[#869397] ml-1.5">J/mm³</span>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs font-mono text-[#bcc9cd] pt-1 border-t border-slate-800/80">
            <span>LINEAR ENERGY (P/v):</span>
            <span>{diagnostics.linearEnergyDensity.toFixed(3)} J/mm</span>
          </div>
        </div>

        <button
          type="button"
          onClick={onLogCoupon}
          className="w-full py-2 px-4 rounded bg-[#06b6d4] text-[#0a0f1d] text-xs font-mono font-semibold hover:shadow-[0_0_16px_rgba(6,182,212,0.45)] transition-all whitespace-nowrap"
        >
          Record Coupon to Qualification Batch
        </button>
      </div>
    </aside>
  );
};
