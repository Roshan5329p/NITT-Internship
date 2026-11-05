import React from 'react';
import { X, Trash2, Plus, ArrowRight } from 'lucide-react';
import { MATERIALS_CATALOG, MaterialItem } from '../data/materialsData';

interface MaterialCompareModalProps {
  isOpen: boolean;
  onClose: () => void;
  compareIds: string[];
  onToggleCompare: (id: string) => void;
  onClearCompare: () => void;
  onSelectMaterial: (id: string) => void;
}

export function MaterialCompareModal({
  isOpen,
  onClose,
  compareIds,
  onToggleCompare,
  onClearCompare,
  onSelectMaterial,
}: MaterialCompareModalProps) {
  if (!isOpen) return null;

  const comparedMaterials: MaterialItem[] = compareIds
    .map((id) => MATERIALS_CATALOG.find((m) => m.id === id))
    .filter((m): m is MaterialItem => !!m);

  const defaultSuggestions = [
    'ti-6al-4v',
    'ti-6al-4v-eli',
    'ti-grade-2',
    'ti-6242',
    'ti-5553',
    'ti-48al-2cr-2nb',
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-6xl bg-[#0d0e0f] border border-[#232426] rounded-xl p-6 sm:p-8 shadow-2xl text-[#e5e2e3] inner-glow max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-wrap items-center justify-between gap-4 pb-5 mb-6 border-b border-[#232426]">
          <div>
            <h3 className="font-h3 text-xl sm:text-2xl font-bold text-white">
              Multi-Material Synthesis &amp; Property Matrix
            </h3>
            <p className="text-xs text-[#9A9DA3] mt-1">
              Side-by-side comparison of creation parameters, mechanical strength, and thermal-electrical profiles
            </p>
          </div>

          <div className="flex items-center gap-3">
            {comparedMaterials.length > 0 && (
              <button
                onClick={onClearCompare}
                className="px-3 py-1.5 text-xs font-mono-data text-[#ffb4ab] border border-[#ffb4ab]/30 rounded hover:bg-[#ffb4ab]/10 transition-colors flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear All</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 text-[#9A9DA3] hover:text-white border border-[#232426] rounded hover:bg-[#1a1b1d]"
              aria-label="Close comparison matrix"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {comparedMaterials.length === 0 ? (
          <div className="py-12 text-center space-y-5">
            <p className="text-sm text-[#9A9DA3]">
              No materials currently selected for side-by-side comparison.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {defaultSuggestions.map((id) => {
                const mat = MATERIALS_CATALOG.find((m) => m.id === id);
                if (!mat) return null;
                return (
                  <button
                    key={id}
                    onClick={() => onToggleCompare(id)}
                    className="px-3.5 py-2 bg-[#101112] border border-[#232426] hover:border-[#50d8e9] rounded text-xs text-[#50d8e9] font-mono-data flex items-center gap-1.5 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add {mat.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#232426]">
                  <th className="py-3 px-4 font-mono-data text-[#9A9DA3] uppercase w-48">
                    Parameter / Metric
                  </th>
                  {comparedMaterials.map((mat) => (
                    <th key={mat.id} className="py-3 px-4 min-w-[200px] bg-[#101112]/60">
                      <div className="flex justify-between items-start gap-2">
                        <div>
                          <div className="font-h4 text-sm font-bold text-white">
                            {mat.name}
                          </div>
                          <div className="font-mono-data text-[10px] text-[#50d8e9] mt-0.5">
                            {mat.category} · {mat.processRoutes.length} routes
                          </div>
                        </div>
                        <button
                          onClick={() => onToggleCompare(mat.id)}
                          className="text-[#9A9DA3] hover:text-white p-1"
                          title="Remove from comparison"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1B1C1E] font-mono-data">
                <tr>
                  <td className="py-3 px-4 text-[#9A9DA3]">Formula / Composition</td>
                  {comparedMaterials.map((m) => (
                    <td key={m.id} className="py-3 px-4 text-[#bec2ff]">
                      {m.formula}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-3 px-4 text-[#9A9DA3]">Crystal / Phase</td>
                  {comparedMaterials.map((m) => (
                    <td key={m.id} className="py-3 px-4 text-[#e5e2e3]">
                      {m.crystalStructure}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-3 px-4 text-[#9A9DA3]">Available AM Processes</td>
                  {comparedMaterials.map((m) => (
                    <td key={m.id} className="py-3 px-4 text-[#50d8e9] font-medium">
                      {m.availableProcesses ? m.availableProcesses.join(', ') : m.category}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-3 px-4 text-[#9A9DA3]">Tensile Strength (UTS)</td>
                  {comparedMaterials.map((m) => (
                    <td key={m.id} className="py-3 px-4 text-white font-bold tabular-nums">
                      {m.mechanical.tensileStrengthMPa}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-3 px-4 text-[#9A9DA3]">Yield Strength (0.2%)</td>
                  {comparedMaterials.map((m) => (
                    <td key={m.id} className="py-3 px-4 text-white tabular-nums">
                      {m.mechanical.yieldStrengthMPa}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-3 px-4 text-[#9A9DA3]">Elastic Modulus (E)</td>
                  {comparedMaterials.map((m) => (
                    <td key={m.id} className="py-3 px-4 text-white tabular-nums">
                      {m.mechanical.elasticModulusGPa}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-3 px-4 text-[#9A9DA3]">Elongation at Break</td>
                  {comparedMaterials.map((m) => (
                    <td key={m.id} className="py-3 px-4 text-white tabular-nums">
                      {m.mechanical.elongationPct}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-3 px-4 text-[#9A9DA3]">Vickers Hardness</td>
                  {comparedMaterials.map((m) => (
                    <td key={m.id} className="py-3 px-4 text-white tabular-nums">
                      {m.mechanical.hardnessHV}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-3 px-4 text-[#9A9DA3]">Fracture Toughness (K₁c)</td>
                  {comparedMaterials.map((m) => (
                    <td key={m.id} className="py-3 px-4 text-white tabular-nums">
                      {m.mechanical.fractureToughness}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-3 px-4 text-[#9A9DA3]">Relative Density</td>
                  {comparedMaterials.map((m) => (
                    <td key={m.id} className="py-3 px-4 text-[#E5FD17] font-bold tabular-nums">
                      {m.amQuality.relativeDensityPct}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-3 px-4 text-[#9A9DA3]">Internal Porosity</td>
                  {comparedMaterials.map((m) => (
                    <td key={m.id} className="py-3 px-4 text-white tabular-nums">
                      {m.amQuality.porosityPct}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-3 px-4 text-[#9A9DA3]">Surface Roughness (Ra)</td>
                  {comparedMaterials.map((m) => (
                    <td key={m.id} className="py-3 px-4 text-white tabular-nums">
                      {m.amQuality.surfaceRoughnessRa}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-3 px-4 text-[#9A9DA3]">Peak Residual Stress</td>
                  {comparedMaterials.map((m) => (
                    <td key={m.id} className="py-3 px-4 text-[#ffb689] tabular-nums">
                      {m.amQuality.residualStressMax}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-3 px-4 text-[#9A9DA3]">Volumetric Build Rate</td>
                  {comparedMaterials.map((m) => (
                    <td key={m.id} className="py-3 px-4 text-[#50d8e9] tabular-nums">
                      {m.amQuality.buildRate}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-3 px-4 text-[#9A9DA3]">Liquidus / Melt Point</td>
                  {comparedMaterials.map((m) => (
                    <td key={m.id} className="py-3 px-4 text-[#ffb689] tabular-nums">
                      {m.thermal.liquidusC}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-3 px-4 text-[#9A9DA3]">β-Transus Temp</td>
                  {comparedMaterials.map((m) => (
                    <td key={m.id} className="py-3 px-4 text-[#ffb689] tabular-nums">
                      {m.thermal.betaTransusC}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-3 px-4 text-[#9A9DA3]">Thermal Conductivity</td>
                  {comparedMaterials.map((m) => (
                    <td key={m.id} className="py-3 px-4 text-white tabular-nums">
                      {m.thermal.thermalConductivity}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-3 px-4 text-[#9A9DA3]">Interstitial Oxygen</td>
                  {comparedMaterials.map((m) => (
                    <td key={m.id} className="py-3 px-4 text-white tabular-nums">
                      {m.chemicalAndPhysical.oxygenContentWt}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-3 px-4 text-[#9A9DA3]">Bulk Density (ρ)</td>
                  {comparedMaterials.map((m) => (
                    <td key={m.id} className="py-3 px-4 text-white tabular-nums">
                      {m.amQuality.densityGcm3}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-3 px-4 text-[#9A9DA3]">Electrical Resistivity</td>
                  {comparedMaterials.map((m) => (
                    <td key={m.id} className="py-3 px-4 text-[#bec2ff] tabular-nums">
                      {m.chemicalAndPhysical.electricalResistivity}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-3 px-4 text-[#9A9DA3]">Inspect Full Profile</td>
                  {comparedMaterials.map((m) => (
                    <td key={m.id} className="py-3 px-4">
                      <button
                        onClick={() => {
                          onSelectMaterial(m.id);
                          onClose();
                        }}
                        className="text-xs text-[#50d8e9] hover:underline flex items-center gap-1"
                      >
                        <span>Open in Workbench</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
