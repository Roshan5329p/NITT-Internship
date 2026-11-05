import React, { useState } from 'react';
import { X, Trash2, Plus, Download, Check, Sparkles, SlidersHorizontal, ArrowRight } from 'lucide-react';
import { MaterialItem, ProcessVariant } from '../data/materialsData';
import { exportProcessComparisonToPdf, generateProcessComparisonCsv } from '../utils/alloyExporter';

interface ProcessCompareModalProps {
  isOpen: boolean;
  onClose: () => void;
  material: MaterialItem;
  selectedVariantIds: string[];
  onToggleVariant: (variantId: string) => void;
  onClearVariants: () => void;
  onSelectVariantForInspector?: (variantIndex: number) => void;
}

const MAX_COMPARE_PROCESSES = 5;

// Helper to extract first float number from strings like "950 MPa", "14.2%", "0.08 Ra"
function extractNumericValue(valStr?: string): number | null {
  if (!valStr) return null;
  const match = valStr.match(/[-+]?[0-9]*\.?[0-9]+/);
  if (!match) return null;
  const n = parseFloat(match[0]);
  return isNaN(n) ? null : n;
}

export function ProcessCompareModal({
  isOpen,
  onClose,
  material,
  selectedVariantIds,
  onToggleVariant,
  onClearVariants,
  onSelectVariantForInspector,
}: ProcessCompareModalProps) {
  const [exportFormat, setExportFormat] = useState<'csv' | 'pdf' | 'json'>('csv');
  const [dropdownOpen, setDropdownOpen] = useState(false);

  if (!isOpen || !material) return null;

  // Selected variants array (strictly up to 5)
  const comparedVariants: ProcessVariant[] = selectedVariantIds
    .map((id) => material.processRoutes.find((r) => r.id === id))
    .filter((r): r is ProcessVariant => !!r)
    .slice(0, MAX_COMPARE_PROCESSES);

  // Unselected variants for adding to comparison
  const availableToAdd = material.processRoutes.filter(
    (r) => !selectedVariantIds.includes(r.id)
  );

  const handleAddVariant = (id: string) => {
    if (comparedVariants.length >= MAX_COMPARE_PROCESSES) return;
    onToggleVariant(id);
    setDropdownOpen(false);
  };

  const handleSelectFirst5 = () => {
    onClearVariants();
    const first5 = material.processRoutes.slice(0, MAX_COMPARE_PROCESSES);
    first5.forEach((r) => onToggleVariant(r.id));
  };

  // Export comparison table to CSV, PDF or JSON
  const handleExport = async () => {
    if (exportFormat === 'pdf') {
      await exportProcessComparisonToPdf(material, comparedVariants);
      return;
    }

    if (exportFormat === 'json') {
      const exportData = {
        material: {
          id: material.id,
          name: material.name,
          formula: material.formula,
          crystalStructure: material.crystalStructure,
          standardCode: material.standardCode,
        },
        comparedProcessesCount: comparedVariants.length,
        processes: comparedVariants,
      };
      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(exportData, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', dataStr);
      downloadAnchor.setAttribute('download', `${material.id}-process-comparison.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      return;
    }

    if (exportFormat === 'csv') {
      const csvContent = generateProcessComparisonCsv(material, comparedVariants);
      const blob = new Blob(['\uFEFF', csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', url);
      downloadAnchor.setAttribute('download', `${material.id}-process-comparison.csv`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      URL.revokeObjectURL(url);
      return;
    }
  };

  // Helper to determine best value for highlighting
  const getHighlightClass = (
    values: (string | undefined)[],
    currentVal: string | undefined,
    direction: 'higher' | 'lower'
  ): string => {
    if (!currentVal || values.length <= 1) return 'text-white';
    const nums = values.map((v) => extractNumericValue(v));
    const currentNum = extractNumericValue(currentVal);
    if (currentNum === null) return 'text-white';

    const validNums = nums.filter((n): n is number => n !== null);
    if (validNums.length <= 1) return 'text-white';

    const target = direction === 'higher' ? Math.max(...validNums) : Math.min(...validNums);
    if (Math.abs(currentNum - target) < 0.0001) {
      return 'text-[#50d8e9] font-bold bg-[#50d8e9]/10 px-1.5 py-0.5 rounded';
    }
    return 'text-[#e5e2e3]';
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-7xl bg-[#0d0e0f] border border-[#232426] rounded-xl p-5 sm:p-7 shadow-2xl text-[#e5e2e3] inner-glow max-h-[92vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-[#232426] shrink-0">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono-data text-[11px] text-[#50d8e9] uppercase tracking-wider bg-[#50d8e9]/10 border border-[#50d8e9]/25 px-2 py-0.5 rounded">
                Same-Alloy Process Comparison
              </span>
              <span className="text-xs font-mono-data text-[#9A9DA3]">
                {material.formula} · {material.crystalStructure}
              </span>
            </div>
            <h3 className="font-h3 text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
              <span>{material.name}</span>
              <span className="text-xs font-mono-data text-[#9A9DA3] font-normal">
                ({comparedVariants.length} of {MAX_COMPARE_PROCESSES} processes selected)
              </span>
            </h3>
            <p className="text-xs text-[#9A9DA3] mt-0.5">
              Side-by-side synthesis parameters, mechanical strength, and AM quality comparison for {material.name} across up to 5 process variants.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {comparedVariants.length > 0 && (
              <>
                <div className="flex items-center rounded border border-[#232426] bg-[#101112] p-0.5 text-[10px] font-mono-data">
                  {(['csv', 'pdf', 'json'] as const).map((fmt) => (
                    <button
                      key={fmt}
                      onClick={() => setExportFormat(fmt)}
                      className={`px-2 py-0.5 rounded transition-colors ${
                        exportFormat === fmt
                          ? 'bg-[#50d8e9] text-[#070708] font-bold shadow-sm'
                          : 'text-[#9A9DA3] hover:text-white'
                      }`}
                    >
                      {fmt.toUpperCase()}
                    </button>
                  ))}
                </div>

                <button
                  onClick={handleExport}
                  className="px-3 py-1.5 text-xs font-mono-data bg-[#16181b] border border-[#232426] hover:border-[#50d8e9] text-[#50d8e9] rounded flex items-center gap-1.5 transition-colors"
                  title={`Export comparison matrix as ${exportFormat.toUpperCase()}`}
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export {exportFormat.toUpperCase()}</span>
                </button>

                <button
                  onClick={onClearVariants}
                  className="px-3 py-1.5 text-xs font-mono-data text-[#ffb4ab] border border-[#ffb4ab]/30 rounded hover:bg-[#ffb4ab]/10 transition-colors flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Clear All</span>
                </button>
              </>
            )}
            <button
              onClick={onClose}
              className="p-2 text-[#9A9DA3] hover:text-white border border-[#232426] rounded hover:bg-[#1a1b1d] transition-colors"
              aria-label="Close process comparison"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Selected Processes Chip Bar & Add Selector */}
        <div className="py-3 px-1 border-b border-[#232426] shrink-0 flex flex-wrap items-center justify-between gap-3 bg-[#0a0a0c]/50">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-mono-data text-[#9A9DA3]">Active Processes:</span>
            {comparedVariants.map((v, i) => (
              <div
                key={v.id}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#14161a] border border-[#50d8e9]/40 text-xs font-mono-data text-white"
              >
                <span className="text-[#50d8e9] font-bold">#{i + 1}</span>
                <span className="max-w-[180px] truncate" title={v.name}>{v.name}</span>
                <button
                  onClick={() => onToggleVariant(v.id)}
                  className="text-[#9A9DA3] hover:text-[#ffb4ab] p-0.5"
                  title="Remove from comparison"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}

            {comparedVariants.length < MAX_COMPARE_PROCESSES && (
              <div className="relative">
                <button
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="px-2.5 py-1 rounded border border-dashed border-[#50d8e9]/60 hover:border-[#50d8e9] text-[#50d8e9] text-xs font-mono-data flex items-center gap-1 transition-colors bg-[#50d8e9]/5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Process ({MAX_COMPARE_PROCESSES - comparedVariants.length} slots left)</span>
                </button>

                {dropdownOpen && (
                  <div className="absolute left-0 top-full mt-2 w-80 max-h-72 overflow-y-auto bg-[#141518] border border-[#232426] rounded-lg shadow-2xl p-2 z-50">
                    <div className="text-[10px] font-mono-data uppercase text-[#9A9DA3] px-2 py-1 border-b border-[#232426] mb-1">
                      Available routes for {material.name}
                    </div>
                    {availableToAdd.length === 0 ? (
                      <div className="p-3 text-xs text-[#9A9DA3] text-center">
                        All process variants are currently selected.
                      </div>
                    ) : (
                      availableToAdd.map((route) => (
                        <button
                          key={route.id}
                          onClick={() => handleAddVariant(route.id)}
                          className="w-full text-left px-2.5 py-1.5 rounded hover:bg-[#232428] text-xs font-mono-data text-[#e5e2e3] flex flex-col gap-0.5 border-b border-[#1b1c1e] last:border-b-0"
                        >
                          <span className="font-semibold text-white truncate">{route.name}</span>
                          <span className="text-[10px] text-[#50d8e9] truncate">
                            {route.processCategory} · {route.temperOrGrade}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {comparedVariants.length < 2 && material.processRoutes.length >= 2 && (
            <button
              onClick={handleSelectFirst5}
              className="px-3 py-1 text-xs font-mono-data bg-[#5E6BFF] text-white rounded hover:bg-[#4d5aec] transition-colors flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Auto-Select Top {Math.min(5, material.processRoutes.length)} Routes</span>
            </button>
          )}
        </div>

        {/* Modal Main Content: Empty State or Comparison Table */}
        {comparedVariants.length === 0 ? (
          <div className="py-16 text-center space-y-4 my-auto">
            <SlidersHorizontal className="w-12 h-12 text-[#50d8e9] mx-auto opacity-70" />
            <h4 className="font-h4 text-lg font-bold text-white">
              No Process Routes Selected
            </h4>
            <p className="text-xs text-[#9A9DA3] max-w-md mx-auto">
              Select up to 5 process variants to view a side-by-side metallurgical, mechanical, thermal, and dimensional comparison for <strong className="text-white">{material.name}</strong>.
            </p>
            <div className="pt-2">
              <button
                onClick={handleSelectFirst5}
                className="px-4 py-2 bg-[#5E6BFF] text-white text-xs font-mono-data font-semibold rounded hover:bg-[#4d5aec] transition-colors shadow-[0_0_15px_rgba(94,107,255,0.3)]"
              >
                Auto-Select First {Math.min(5, material.processRoutes.length)} Processes
              </button>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto overflow-x-auto pt-2 pb-6">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#232426]">
                  <th className="py-3 px-4 font-mono-data text-[#9A9DA3] uppercase w-56 sticky left-0 bg-[#0d0e0f] z-10 border-r border-[#232426]">
                    Parameter / Metric
                  </th>
                  {comparedVariants.map((v, i) => (
                    <th key={v.id} className="py-3 px-4 min-w-[210px] bg-[#121316]/70 border-r border-[#232426]/60 last:border-r-0">
                      <div className="flex justify-between items-start gap-2">
                        <div className="space-y-1">
                          <div className="font-mono-data text-[10px] text-[#50d8e9] font-bold">
                            ROUTE #{i + 1}
                          </div>
                          <div className="font-h4 text-sm font-bold text-white leading-tight">
                            {v.name}
                          </div>
                          <div className="font-mono-data text-[10px] text-[#bec2ff]">
                            {v.processCategory}
                          </div>
                          <div className="font-mono-data text-[10px] text-[#9A9DA3]">
                            {v.temperOrGrade}
                          </div>
                        </div>
                        <button
                          onClick={() => onToggleVariant(v.id)}
                          className="text-[#9A9DA3] hover:text-[#ffb4ab] p-1"
                          title="Remove this route"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody className="divide-y divide-[#1B1C1E] font-mono-data">
                {/* 1. PROCESS SYNTHESIS PARAMETERS */}
                <tr className="bg-[#141518]/90 font-bold text-[#50d8e9]">
                  <td colSpan={comparedVariants.length + 1} className="py-2 px-4 uppercase tracking-wider text-[11px] sticky left-0">
                    1. Creation Parameters &amp; Synthesis Vectors
                  </td>
                </tr>
                <tr>
                  <td className="py-2.5 px-4 text-[#9A9DA3] sticky left-0 bg-[#0d0e0f] border-r border-[#232426]">
                    ISO/ASTM AM Process
                  </td>
                  {comparedVariants.map((v) => (
                    <td key={v.id} className="py-2.5 px-4 text-[#38bdf8] font-semibold border-r border-[#232426]/40 last:border-r-0">
                      {v.processCategory}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-2.5 px-4 text-[#9A9DA3] sticky left-0 bg-[#0d0e0f] border-r border-[#232426]">
                    Subprocess Method
                  </td>
                  {comparedVariants.map((v) => (
                    <td key={v.id} className="py-2.5 px-4 text-white border-r border-[#232426]/40 last:border-r-0">
                      {v.subprocess}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-2.5 px-4 text-[#9A9DA3] sticky left-0 bg-[#0d0e0f] border-r border-[#232426]">
                    Post-Processing Condition
                  </td>
                  {comparedVariants.map((v) => (
                    <td key={v.id} className="py-2.5 px-4 text-[#bec2ff] border-r border-[#232426]/40 last:border-r-0">
                      {v.postProcessingCondition}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-2.5 px-4 text-[#9A9DA3] sticky left-0 bg-[#0d0e0f] border-r border-[#232426]">
                    Peak Process Temperature
                  </td>
                  {comparedVariants.map((v) => (
                    <td key={v.id} className="py-2.5 px-4 text-white tabular-nums border-r border-[#232426]/40 last:border-r-0">
                      {v.peakTempC} °C
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-2.5 px-4 text-[#9A9DA3] sticky left-0 bg-[#0d0e0f] border-r border-[#232426]">
                    Total Hold Duration
                  </td>
                  {comparedVariants.map((v) => (
                    <td key={v.id} className="py-2.5 px-4 text-white tabular-nums border-r border-[#232426]/40 last:border-r-0">
                      {v.holdTimeMin} min
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-2.5 px-4 text-[#9A9DA3] sticky left-0 bg-[#0d0e0f] border-r border-[#232426]">
                    Cooling / Quench Vector
                  </td>
                  {comparedVariants.map((v) => (
                    <td key={v.id} className="py-2.5 px-4 text-[#e5e2e3] border-r border-[#232426]/40 last:border-r-0">
                      {v.coolingRate}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-2.5 px-4 text-[#9A9DA3] sticky left-0 bg-[#0d0e0f] border-r border-[#232426]">
                    Process Atmosphere
                  </td>
                  {comparedVariants.map((v) => (
                    <td key={v.id} className="py-2.5 px-4 text-[#ffb689] border-r border-[#232426]/40 last:border-r-0">
                      {v.atmosphere}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-2.5 px-4 text-[#9A9DA3] sticky left-0 bg-[#0d0e0f] border-r border-[#232426]">
                    Yield Strength Change (%)
                  </td>
                  {comparedVariants.map((v) => (
                    <td key={v.id} className="py-2.5 px-4 text-[#E5FD17] font-semibold tabular-nums border-r border-[#232426]/40 last:border-r-0">
                      {v.yieldChangePct}
                    </td>
                  ))}
                </tr>

                {/* 2. MECHANICAL TELEMETRY */}
                <tr className="bg-[#141518]/90 font-bold text-[#50d8e9]">
                  <td colSpan={comparedVariants.length + 1} className="py-2 px-4 uppercase tracking-wider text-[11px] sticky left-0">
                    2. Mechanical Telemetry (Calibrated)
                  </td>
                </tr>
                <tr>
                  <td className="py-2.5 px-4 text-[#9A9DA3] sticky left-0 bg-[#0d0e0f] border-r border-[#232426]">
                    Tensile Strength (UTS)
                  </td>
                  {comparedVariants.map((v) => (
                    <td
                      key={v.id}
                      className={`py-2.5 px-4 tabular-nums border-r border-[#232426]/40 last:border-r-0 ${getHighlightClass(
                        comparedVariants.map((x) => x.propertyOverrides?.tensileStrengthMPa),
                        v.propertyOverrides?.tensileStrengthMPa,
                        'higher'
                      )}`}
                    >
                      {v.propertyOverrides?.tensileStrengthMPa || 'N/A'}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-2.5 px-4 text-[#9A9DA3] sticky left-0 bg-[#0d0e0f] border-r border-[#232426]">
                    Yield Strength (0.2% Offset)
                  </td>
                  {comparedVariants.map((v) => (
                    <td
                      key={v.id}
                      className={`py-2.5 px-4 tabular-nums border-r border-[#232426]/40 last:border-r-0 ${getHighlightClass(
                        comparedVariants.map((x) => x.propertyOverrides?.yieldStrengthMPa),
                        v.propertyOverrides?.yieldStrengthMPa,
                        'higher'
                      )}`}
                    >
                      {v.propertyOverrides?.yieldStrengthMPa || 'N/A'}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-2.5 px-4 text-[#9A9DA3] sticky left-0 bg-[#0d0e0f] border-r border-[#232426]">
                    Elastic Modulus (E)
                  </td>
                  {comparedVariants.map((v) => (
                    <td key={v.id} className="py-2.5 px-4 text-white tabular-nums border-r border-[#232426]/40 last:border-r-0">
                      {v.propertyOverrides?.elasticModulusGPa || 'N/A'}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-2.5 px-4 text-[#9A9DA3] sticky left-0 bg-[#0d0e0f] border-r border-[#232426]">
                    Elongation at Break
                  </td>
                  {comparedVariants.map((v) => (
                    <td
                      key={v.id}
                      className={`py-2.5 px-4 tabular-nums border-r border-[#232426]/40 last:border-r-0 ${getHighlightClass(
                        comparedVariants.map((x) => x.propertyOverrides?.elongationPct),
                        v.propertyOverrides?.elongationPct,
                        'higher'
                      )}`}
                    >
                      {v.propertyOverrides?.elongationPct || 'N/A'}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-2.5 px-4 text-[#9A9DA3] sticky left-0 bg-[#0d0e0f] border-r border-[#232426]">
                    Vickers Hardness
                  </td>
                  {comparedVariants.map((v) => (
                    <td
                      key={v.id}
                      className={`py-2.5 px-4 tabular-nums border-r border-[#232426]/40 last:border-r-0 ${getHighlightClass(
                        comparedVariants.map((x) => x.propertyOverrides?.hardnessHV),
                        v.propertyOverrides?.hardnessHV,
                        'higher'
                      )}`}
                    >
                      {v.propertyOverrides?.hardnessHV || 'N/A'}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-2.5 px-4 text-[#9A9DA3] sticky left-0 bg-[#0d0e0f] border-r border-[#232426]">
                    Fracture Toughness (K₁c)
                  </td>
                  {comparedVariants.map((v) => (
                    <td
                      key={v.id}
                      className={`py-2.5 px-4 tabular-nums border-r border-[#232426]/40 last:border-r-0 ${getHighlightClass(
                        comparedVariants.map((x) => x.propertyOverrides?.fractureToughness),
                        v.propertyOverrides?.fractureToughness,
                        'higher'
                      )}`}
                    >
                      {v.propertyOverrides?.fractureToughness || 'N/A'}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-2.5 px-4 text-[#9A9DA3] sticky left-0 bg-[#0d0e0f] border-r border-[#232426]">
                    Fatigue Strength (10⁷)
                  </td>
                  {comparedVariants.map((v) => (
                    <td
                      key={v.id}
                      className={`py-2.5 px-4 tabular-nums border-r border-[#232426]/40 last:border-r-0 ${getHighlightClass(
                        comparedVariants.map((x) => x.propertyOverrides?.fatigueStrengthMPa),
                        v.propertyOverrides?.fatigueStrengthMPa,
                        'higher'
                      )}`}
                    >
                      {v.propertyOverrides?.fatigueStrengthMPa || 'N/A'}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-2.5 px-4 text-[#9A9DA3] sticky left-0 bg-[#0d0e0f] border-r border-[#232426]">
                    Charpy Impact Energy
                  </td>
                  {comparedVariants.map((v) => (
                    <td
                      key={v.id}
                      className={`py-2.5 px-4 tabular-nums border-r border-[#232426]/40 last:border-r-0 ${getHighlightClass(
                        comparedVariants.map((x) => x.propertyOverrides?.charpyImpactEnergyJ),
                        v.propertyOverrides?.charpyImpactEnergyJ,
                        'higher'
                      )}`}
                    >
                      {v.propertyOverrides?.charpyImpactEnergyJ || 'N/A'}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-2.5 px-4 text-[#9A9DA3] sticky left-0 bg-[#0d0e0f] border-r border-[#232426]">
                    Poisson's Ratio
                  </td>
                  {comparedVariants.map((v) => (
                    <td key={v.id} className="py-2.5 px-4 text-white tabular-nums border-r border-[#232426]/40 last:border-r-0">
                      {v.propertyOverrides?.poissonsRatio || 'N/A'}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-2.5 px-4 text-[#9A9DA3] sticky left-0 bg-[#0d0e0f] border-r border-[#232426]">
                    Damping Loss Factor
                  </td>
                  {comparedVariants.map((v) => (
                    <td key={v.id} className="py-2.5 px-4 text-white tabular-nums border-r border-[#232426]/40 last:border-r-0">
                      {v.propertyOverrides?.dampingLossFactor || 'N/A'}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-2.5 px-4 text-[#9A9DA3] sticky left-0 bg-[#0d0e0f] border-r border-[#232426]">
                    Ultrasonic Wave Speed
                  </td>
                  {comparedVariants.map((v) => (
                    <td key={v.id} className="py-2.5 px-4 text-white tabular-nums border-r border-[#232426]/40 last:border-r-0">
                      {v.propertyOverrides?.waveSpeedMs || 'N/A'}
                    </td>
                  ))}
                </tr>

                {/* 3. AM PROCESS QUALITY & PRECISION */}
                <tr className="bg-[#141518]/90 font-bold text-[#50d8e9]">
                  <td colSpan={comparedVariants.length + 1} className="py-2 px-4 uppercase tracking-wider text-[11px] sticky left-0">
                    3. AM Process Quality &amp; Precision
                  </td>
                </tr>
                <tr>
                  <td className="py-2.5 px-4 text-[#9A9DA3] sticky left-0 bg-[#0d0e0f] border-r border-[#232426]">
                    Relative Density
                  </td>
                  {comparedVariants.map((v) => (
                    <td
                      key={v.id}
                      className={`py-2.5 px-4 tabular-nums border-r border-[#232426]/40 last:border-r-0 ${getHighlightClass(
                        comparedVariants.map((x) => x.propertyOverrides?.relativeDensityPct),
                        v.propertyOverrides?.relativeDensityPct,
                        'higher'
                      )}`}
                    >
                      {v.propertyOverrides?.relativeDensityPct || 'N/A'}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-2.5 px-4 text-[#9A9DA3] sticky left-0 bg-[#0d0e0f] border-r border-[#232426]">
                    Internal Porosity
                  </td>
                  {comparedVariants.map((v) => (
                    <td
                      key={v.id}
                      className={`py-2.5 px-4 tabular-nums border-r border-[#232426]/40 last:border-r-0 ${getHighlightClass(
                        comparedVariants.map((x) => x.propertyOverrides?.porosityPct),
                        v.propertyOverrides?.porosityPct,
                        'lower'
                      )}`}
                    >
                      {v.propertyOverrides?.porosityPct || 'N/A'}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-2.5 px-4 text-[#9A9DA3] sticky left-0 bg-[#0d0e0f] border-r border-[#232426]">
                    Surface Roughness (Ra)
                  </td>
                  {comparedVariants.map((v) => (
                    <td
                      key={v.id}
                      className={`py-2.5 px-4 tabular-nums border-r border-[#232426]/40 last:border-r-0 ${getHighlightClass(
                        comparedVariants.map((x) => x.propertyOverrides?.surfaceRoughnessRa),
                        v.propertyOverrides?.surfaceRoughnessRa,
                        'lower'
                      )}`}
                    >
                      {v.propertyOverrides?.surfaceRoughnessRa || 'N/A'}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-2.5 px-4 text-[#9A9DA3] sticky left-0 bg-[#0d0e0f] border-r border-[#232426]">
                    Peak Residual Stress
                  </td>
                  {comparedVariants.map((v) => (
                    <td
                      key={v.id}
                      className={`py-2.5 px-4 tabular-nums border-r border-[#232426]/40 last:border-r-0 ${getHighlightClass(
                        comparedVariants.map((x) => x.propertyOverrides?.residualStressMax),
                        v.propertyOverrides?.residualStressMax,
                        'lower'
                      )}`}
                    >
                      {v.propertyOverrides?.residualStressMax || 'N/A'}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-2.5 px-4 text-[#9A9DA3] sticky left-0 bg-[#0d0e0f] border-r border-[#232426]">
                    Volumetric Build Rate
                  </td>
                  {comparedVariants.map((v) => (
                    <td
                      key={v.id}
                      className={`py-2.5 px-4 tabular-nums border-r border-[#232426]/40 last:border-r-0 ${getHighlightClass(
                        comparedVariants.map((x) => x.propertyOverrides?.buildRate),
                        v.propertyOverrides?.buildRate,
                        'higher'
                      )}`}
                    >
                      {v.propertyOverrides?.buildRate || 'N/A'}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-2.5 px-4 text-[#9A9DA3] sticky left-0 bg-[#0d0e0f] border-r border-[#232426]">
                    Mechanical Anisotropy (Z/XY)
                  </td>
                  {comparedVariants.map((v) => (
                    <td key={v.id} className="py-2.5 px-4 text-white tabular-nums border-r border-[#232426]/40 last:border-r-0">
                      {v.propertyOverrides?.anisotropy || 'N/A'}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-2.5 px-4 text-[#9A9DA3] sticky left-0 bg-[#0d0e0f] border-r border-[#232426]">
                    Min Feature Size
                  </td>
                  {comparedVariants.map((v) => (
                    <td
                      key={v.id}
                      className={`py-2.5 px-4 tabular-nums border-r border-[#232426]/40 last:border-r-0 ${getHighlightClass(
                        comparedVariants.map((x) => x.propertyOverrides?.minFeatureSize),
                        v.propertyOverrides?.minFeatureSize,
                        'lower'
                      )}`}
                    >
                      {v.propertyOverrides?.minFeatureSize || 'N/A'}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-2.5 px-4 text-[#9A9DA3] sticky left-0 bg-[#0d0e0f] border-r border-[#232426]">
                    Dimensional Accuracy
                  </td>
                  {comparedVariants.map((v) => (
                    <td key={v.id} className="py-2.5 px-4 text-white tabular-nums border-r border-[#232426]/40 last:border-r-0">
                      {v.propertyOverrides?.accuracy || 'N/A'}
                    </td>
                  ))}
                </tr>

                {/* 4. THERMAL TELEMETRY */}
                <tr className="bg-[#141518]/90 font-bold text-[#50d8e9]">
                  <td colSpan={comparedVariants.length + 1} className="py-2 px-4 uppercase tracking-wider text-[11px] sticky left-0">
                    4. Thermal Telemetry
                  </td>
                </tr>
                <tr>
                  <td className="py-2.5 px-4 text-[#9A9DA3] sticky left-0 bg-[#0d0e0f] border-r border-[#232426]">
                    Liquidus / Melt Point
                  </td>
                  {comparedVariants.map((v) => (
                    <td key={v.id} className="py-2.5 px-4 text-white tabular-nums border-r border-[#232426]/40 last:border-r-0">
                      {v.propertyOverrides?.liquidusC || 'N/A'}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-2.5 px-4 text-[#9A9DA3] sticky left-0 bg-[#0d0e0f] border-r border-[#232426]">
                    Beta Transus Temperature
                  </td>
                  {comparedVariants.map((v) => (
                    <td key={v.id} className="py-2.5 px-4 text-white tabular-nums border-r border-[#232426]/40 last:border-r-0">
                      {v.propertyOverrides?.betaTransusC || 'N/A'}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-2.5 px-4 text-[#9A9DA3] sticky left-0 bg-[#0d0e0f] border-r border-[#232426]">
                    Max Service Temperature
                  </td>
                  {comparedVariants.map((v) => (
                    <td
                      key={v.id}
                      className={`py-2.5 px-4 tabular-nums border-r border-[#232426]/40 last:border-r-0 ${getHighlightClass(
                        comparedVariants.map((x) => x.propertyOverrides?.maxServiceTempC),
                        v.propertyOverrides?.maxServiceTempC,
                        'higher'
                      )}`}
                    >
                      {v.propertyOverrides?.maxServiceTempC || 'N/A'}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-2.5 px-4 text-[#9A9DA3] sticky left-0 bg-[#0d0e0f] border-r border-[#232426]">
                    Thermal Conductivity
                  </td>
                  {comparedVariants.map((v) => (
                    <td key={v.id} className="py-2.5 px-4 text-white tabular-nums border-r border-[#232426]/40 last:border-r-0">
                      {v.propertyOverrides?.thermalConductivity || 'N/A'}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-2.5 px-4 text-[#9A9DA3] sticky left-0 bg-[#0d0e0f] border-r border-[#232426]">
                    Thermal Expansion (CTE)
                  </td>
                  {comparedVariants.map((v) => (
                    <td key={v.id} className="py-2.5 px-4 text-white tabular-nums border-r border-[#232426]/40 last:border-r-0">
                      {v.propertyOverrides?.thermalExpansionCTE || 'N/A'}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-2.5 px-4 text-[#9A9DA3] sticky left-0 bg-[#0d0e0f] border-r border-[#232426]">
                    Specific Heat Capacity
                  </td>
                  {comparedVariants.map((v) => (
                    <td key={v.id} className="py-2.5 px-4 text-white tabular-nums border-r border-[#232426]/40 last:border-r-0">
                      {v.propertyOverrides?.specificHeat || 'N/A'}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-2.5 px-4 text-[#9A9DA3] sticky left-0 bg-[#0d0e0f] border-r border-[#232426]">
                    Thermal Emissivity
                  </td>
                  {comparedVariants.map((v) => (
                    <td key={v.id} className="py-2.5 px-4 text-white tabular-nums border-r border-[#232426]/40 last:border-r-0">
                      {v.propertyOverrides?.emissivity || 'N/A'}
                    </td>
                  ))}
                </tr>

                {/* 5. CHEMICAL, OPTICAL & PHYSICAL */}
                <tr className="bg-[#141518]/90 font-bold text-[#50d8e9]">
                  <td colSpan={comparedVariants.length + 1} className="py-2 px-4 uppercase tracking-wider text-[11px] sticky left-0">
                    5. Density, Chemical &amp; Optical Properties
                  </td>
                </tr>
                <tr>
                  <td className="py-2.5 px-4 text-[#9A9DA3] sticky left-0 bg-[#0d0e0f] border-r border-[#232426]">
                    Density (g/cm³)
                  </td>
                  {comparedVariants.map((v) => (
                    <td key={v.id} className="py-2.5 px-4 text-white tabular-nums border-r border-[#232426]/40 last:border-r-0">
                      {v.propertyOverrides?.densityGcm3 || 'N/A'}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-2.5 px-4 text-[#9A9DA3] sticky left-0 bg-[#0d0e0f] border-r border-[#232426]">
                    Oxygen Content (wt. %)
                  </td>
                  {comparedVariants.map((v) => (
                    <td
                      key={v.id}
                      className={`py-2.5 px-4 tabular-nums border-r border-[#232426]/40 last:border-r-0 ${getHighlightClass(
                        comparedVariants.map((x) => x.propertyOverrides?.oxygenContentWt),
                        v.propertyOverrides?.oxygenContentWt,
                        'lower'
                      )}`}
                    >
                      {v.propertyOverrides?.oxygenContentWt || 'N/A'}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-2.5 px-4 text-[#9A9DA3] sticky left-0 bg-[#0d0e0f] border-r border-[#232426]">
                    Electrical Resistivity
                  </td>
                  {comparedVariants.map((v) => (
                    <td key={v.id} className="py-2.5 px-4 text-white tabular-nums border-r border-[#232426]/40 last:border-r-0">
                      {v.propertyOverrides?.electricalResistivity || 'N/A'}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-2.5 px-4 text-[#9A9DA3] sticky left-0 bg-[#0d0e0f] border-r border-[#232426]">
                    Laser Absorptivity (1064 nm)
                  </td>
                  {comparedVariants.map((v) => (
                    <td key={v.id} className="py-2.5 px-4 text-white tabular-nums border-r border-[#232426]/40 last:border-r-0">
                      {v.propertyOverrides?.laserAbsorptivity || 'N/A'}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-2.5 px-4 text-[#9A9DA3] sticky left-0 bg-[#0d0e0f] border-r border-[#232426]">
                    Visible Reflectance (%)
                  </td>
                  {comparedVariants.map((v) => (
                    <td key={v.id} className="py-2.5 px-4 text-white tabular-nums border-r border-[#232426]/40 last:border-r-0">
                      {v.propertyOverrides?.visibleReflectance || 'N/A'}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-2.5 px-4 text-[#9A9DA3] sticky left-0 bg-[#0d0e0f] border-r border-[#232426]">
                    Corrosion Resistance
                  </td>
                  {comparedVariants.map((v) => (
                    <td key={v.id} className="py-2.5 px-4 text-[#38bdf8] font-semibold border-r border-[#232426]/40 last:border-r-0">
                      {v.propertyOverrides?.corrosionRating || 'N/A'}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-2.5 px-4 text-[#9A9DA3] sticky left-0 bg-[#0d0e0f] border-r border-[#232426]">
                    Biocompatibility
                  </td>
                  {comparedVariants.map((v) => (
                    <td key={v.id} className="py-2.5 px-4 text-[#E5FD17] font-semibold border-r border-[#232426]/40 last:border-r-0">
                      {v.propertyOverrides?.biocompatibilityRating || 'N/A'}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-2.5 px-4 text-[#9A9DA3] sticky left-0 bg-[#0d0e0f] border-r border-[#232426]">
                    Magnetic Susceptibility
                  </td>
                  {comparedVariants.map((v) => (
                    <td key={v.id} className="py-2.5 px-4 text-white tabular-nums border-r border-[#232426]/40 last:border-r-0">
                      {v.propertyOverrides?.magneticSusceptibility || 'N/A'}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* Footer info note */}
        <div className="pt-3 border-t border-[#232426] flex flex-wrap items-center justify-between text-[11px] font-mono-data text-[#9A9DA3] shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#50d8e9]"></span>
            <span>Highlighted values indicate optimal parameter among compared routes (higher strength/density or lower porosity/stress).</span>
          </div>
          <div>
            Maximum 5 process variants can be compared simultaneously.
          </div>
        </div>
      </div>
    </div>
  );
}
