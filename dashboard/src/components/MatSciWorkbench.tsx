import React, { useState, useMemo, useEffect } from 'react';
import {
  Search,
  X,
  Microscope,
  Flame,
  Gauge,
  Clock,
  Wind,
  Layers,
  Zap,
  Thermometer,
  Shield,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Scale,
  Check,
  Download,
  Sliders,
} from 'lucide-react';
import {
  MATERIALS_CATALOG,
  MATERIAL_CATEGORIES,
  QUICK_SUGGESTION_IDS,
  TOTAL_MATERIALS_COUNT,
  TOTAL_PROCESS_VARIANTS_COUNT,
  MaterialCategory,
  MaterialItem,
} from '../data/materialsData';
import { ProcessCompareModal } from './ProcessCompareModal';
import { AlloyExportModal } from './AlloyExportModal';
import { exportAlloyToCsv, exportAlloyToPdf } from '../utils/alloyExporter';

interface MatSciWorkbenchProps {
  selectedMaterialId: string | null;
  onSelectMaterial: (id: string | null) => void;
  compareIds: string[];
  onToggleCompare: (id: string) => void;
  onOpenCompareModal: () => void;
  onNavigateArchitecture: () => void;
}

export function MatSciWorkbench({
  selectedMaterialId,
  onSelectMaterial,
  compareIds,
  onToggleCompare,
  onOpenCompareModal,
  onNavigateArchitecture,
}: MatSciWorkbenchProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<MaterialCategory>('All Processes');
  const [selectedVariantIdx, setSelectedVariantIdx] = useState<number>(0);
  const [expandedCardRoutesId, setExpandedCardRoutesId] = useState<string | null>(null);
  const [svgProbe, setSvgProbe] = useState<{ x: number; y: number; active: boolean }>({
    x: 0,
    y: 0,
    active: false,
  });

  // Filter materials by process category and search query (matches name, formula, subtitle, standard, or processes)
  const filteredMaterials = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return MATERIALS_CATALOG.filter((mat) => {
      const matchesCat =
        activeCategory === 'All Processes' ||
        (mat.availableProcesses && mat.availableProcesses.includes(activeCategory)) ||
        mat.category === activeCategory;
      if (!matchesCat) return false;
      if (!q) return true;
      const inName = mat.name.toLowerCase().includes(q);
      const inFormula = mat.formula.toLowerCase().includes(q);
      const inSubtitle = mat.subtitle.toLowerCase().includes(q);
      const inStandard = mat.standardCode.toLowerCase().includes(q);
      const inProcesses = mat.availableProcesses
        ? mat.availableProcesses.some((p) => p.toLowerCase().includes(q))
        : false;
      const inRoutes = mat.processRoutes.some(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          r.shortName.toLowerCase().includes(q) ||
          r.temperOrGrade.toLowerCase().includes(q) ||
          r.summary.toLowerCase().includes(q) ||
          (r.processCategory && r.processCategory.toLowerCase().includes(q)) ||
          (r.subprocess && r.subprocess.toLowerCase().includes(q))
      );
      return inName || inFormula || inSubtitle || inStandard || inProcesses || inRoutes;
    });
  }, [searchQuery, activeCategory]);

  // Process variants visible in right pane (strictly filtered by active process if not "All Processes")
  const activeProcessRoutes = useMemo(() => {
    if (!selectedMaterialId) return [];
    const mat = MATERIALS_CATALOG.find((m) => m.id === selectedMaterialId);
    if (!mat) return [];
    if (activeCategory === 'All Processes') {
      return mat.processRoutes;
    }
    const filtered = mat.processRoutes.filter(
      (r) => r.processCategory === activeCategory
    );
    return filtered.length > 0 ? filtered : mat.processRoutes;
  }, [selectedMaterialId, activeCategory]);

  const filteredProcessVariantsCount = useMemo(() => {
    if (activeCategory === 'All Processes') {
      return filteredMaterials.reduce((acc, m) => acc + m.processRoutes.length, 0);
    }
    return filteredMaterials.reduce(
      (acc, m) =>
        acc +
        m.processRoutes.filter((r) => r.processCategory === activeCategory).length,
      0
    );
  }, [filteredMaterials, activeCategory]);

  const selectedMaterial: MaterialItem | null = useMemo(() => {
    if (!selectedMaterialId) return null;
    return MATERIALS_CATALOG.find((m) => m.id === selectedMaterialId) || null;
  }, [selectedMaterialId]);

  // State for comparing up to 5 AM processes for the same alloy
  const [processCompareIds, setProcessCompareIds] = useState<string[]>([]);
  const [isProcessCompareOpen, setIsProcessCompareOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

  // Sync process comparison IDs when material changes: default to first 2 routes if empty
  useEffect(() => {
    if (selectedMaterial) {
      const valid = processCompareIds.filter((id) =>
        selectedMaterial.processRoutes.some((r) => r.id === id)
      );
      if (valid.length === 0 && selectedMaterial.processRoutes.length >= 2) {
        setProcessCompareIds(selectedMaterial.processRoutes.slice(0, 2).map((r) => r.id));
      } else {
        setProcessCompareIds(valid);
      }
    }
  }, [selectedMaterial?.id]);

  const handleToggleProcessCompare = (variantId: string) => {
    setProcessCompareIds((prev) => {
      if (prev.includes(variantId)) {
        return prev.filter((id) => id !== variantId);
      }
      if (prev.length >= 5) {
        return prev;
      }
      return [...prev, variantId];
    });
  };

  const handleClearProcessCompare = () => {
    setProcessCompareIds([]);
  };

  const activeVariant = useMemo(() => {
    if (!selectedMaterial || activeProcessRoutes.length === 0) return null;
    return (
      activeProcessRoutes[selectedVariantIdx] ||
      activeProcessRoutes[0]
    );
  }, [selectedMaterial, activeProcessRoutes, selectedVariantIdx]);

  const handleSelectMaterialCard = (matId: string, variantIndex = 0) => {
    onSelectMaterial(matId);
    setSelectedVariantIdx(variantIndex);
  };

  const handleExportMaterialJson = (mat: MaterialItem) => {
    const dataStr =
      'data:text/json;charset=utf-8,' +
      encodeURIComponent(JSON.stringify(mat, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `${mat.id}-synthesis-spec.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div id="workbench-anchor" className="w-full max-w-[1640px] mx-auto px-4 sm:px-8 pt-6 pb-20 scroll-mt-20 overflow-x-hidden min-w-0">
      {/* Sub-Header Telemetry & Subtitle Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-5 mb-6 border-b border-[#232426]">
        <div>
          <p className="text-xs sm:text-sm text-[#9A9DA3] font-body-md">
            Materials Synthesis Routes, Creation Parameters &amp; Properties
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-xs font-mono-data">
          <span className="text-[#c6c5d8]">
            <strong className="text-[#50d8e9] font-semibold tabular-nums">{TOTAL_MATERIALS_COUNT}</strong> Materials
          </span>
          <span className="text-[#232426]">/</span>
          <span className="text-[#c6c5d8]">
            <strong className="text-[#50d8e9] font-semibold tabular-nums">{TOTAL_PROCESS_VARIANTS_COUNT}</strong> Process Variants
          </span>
          <span className="text-[#232426]">/</span>
          <span className="text-[#50d8e9] flex items-center gap-1.5">
            <span>● Local Java Engine</span>
          </span>
          {compareIds.length > 0 && (
            <>
              <span className="text-[#232426]">/</span>
              <button
                onClick={onOpenCompareModal}
                className="px-3 py-1 bg-[#5E6BFF] text-white rounded font-medium hover:bg-[#4e5bef] transition-colors whitespace-nowrap"
              >
                Compare ({compareIds.length})
              </button>
            </>
          )}
        </div>
      </div>

      {/* Search & Category Filter Box (Matches image_f48a1e5a.png layout with Cinematic Precision styling) */}
      <div className="bg-[#101112] border border-[#232426] rounded-xl p-4 sm:p-6 mb-7 inner-glow shadow-2xl">
        {/* Search Input */}
        <div className="relative mb-4">
          <Search className="w-4 h-4 text-[#50d8e9] absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by alloy name, formula, or AM process (e.g., 'Ti-6Al-4V', 'Powder Bed Fusion', 'Wire arc additive manufacturing')..."
            className="w-full bg-[#070708] border border-[#50d8e9]/60 focus:border-[#50d8e9] rounded-lg pl-11 pr-10 py-3 text-sm text-[#e5e2e3] placeholder-[#9A9DA3]/60 focus:outline-none focus:ring-2 focus:ring-[#50d8e9]/20 transition-all font-body-md"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#9A9DA3] hover:text-white p-1"
              aria-label="Clear search"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Process Filter Buttons - Strictly the 8 Authorized Additive Manufacturing Processes */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-[#9A9DA3] mr-1 font-body-md font-semibold">
            Process Filter:
          </span>
          <button
            onClick={() => {
              setActiveCategory('All Processes');
              setSelectedVariantIdx(0);
            }}
            className={`px-3 py-1.5 rounded text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              activeCategory === 'All Processes'
                ? 'bg-[#38bdf8] text-[#070708] font-semibold shadow-[0_0_12px_rgba(56,189,248,0.25)]'
                : 'bg-[#0a0a0b] border border-[#232426] text-[#c6c5d8] hover:border-[#454655] hover:text-white'
            }`}
          >
            All (275 Variants)
          </button>
          {MATERIAL_CATEGORIES.map((category) => {
            const isActive = activeCategory === category;
            return (
              <button
                key={category}
                onClick={() => {
                  setActiveCategory(isActive ? 'All Processes' : category);
                  setSelectedVariantIdx(0);
                }}
                className={`px-3 py-1.5 rounded text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  isActive
                    ? 'bg-[#38bdf8] text-[#070708] font-semibold shadow-[0_0_12px_rgba(56,189,248,0.25)]'
                    : 'bg-[#0a0a0b] border border-[#232426] text-[#c6c5d8] hover:border-[#454655] hover:text-white'
                }`}
              >
                {category}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Split Workbench: Left Material List + Right Material Explorer */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start min-w-0 w-full">
        {/* LEFT PANE: Scrollable Material Cards (4 cols on lg) */}
        <div className="lg:col-span-4 min-w-0 flex flex-col">
          {/* Left Header */}
          <div className="flex justify-between items-baseline text-xs text-[#9A9DA3] mb-3 px-0.5">
            <span className="font-mono-data tabular-nums">
              {filteredMaterials.length} materials ({filteredProcessVariantsCount} process variants)
            </span>
            <span className="text-[11px] text-[#9A9DA3]/80 text-right">
              Click any card to inspect creation parameters
            </span>
          </div>

          {/* Scrollable Cards Container */}
          <div className="space-y-3 max-h-[780px] overflow-y-auto pr-1.5">
            {filteredMaterials.length === 0 ? (
              <div className="bg-[#101112] border border-[#232426] rounded-xl p-8 text-center space-y-3">
                <p className="text-sm text-[#e5e2e3] font-medium">
                  No materials match &ldquo;{searchQuery}&rdquo;
                </p>
                <p className="text-xs text-[#9A9DA3]">
                  Try clearing your search filter or viewing All Processes.
                </p>
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setActiveCategory('All Processes');
                  }}
                  className="px-3 py-1.5 bg-[#5E6BFF] text-white text-xs rounded font-medium"
                >
                  Reset Filters
                </button>
              </div>
            ) : (
              filteredMaterials.map((item) => {
                const isSelected = selectedMaterialId === item.id;
                const isExpanded = expandedCardRoutesId === item.id;
                const visibleRoutes = isExpanded
                  ? item.processRoutes
                  : item.processRoutes.slice(0, 3);
                const hiddenCount = Math.max(0, item.processRoutes.length - 3);

                return (
                  <div
                    key={item.id}
                    onClick={() => handleSelectMaterialCard(item.id, 0)}
                    className={`rounded-xl p-4 cursor-pointer transition-all border inner-glow ${
                      isSelected
                        ? 'bg-[#141619] border-[#50d8e9] shadow-[0_0_20px_rgba(80,216,233,0.08)]'
                        : 'bg-[#101112] border-[#232426] hover:border-[#454655] hover:bg-[#121315]'
                    }`}
                  >
                    {/* Card Top Row: Name + Category Label */}
                    <div className="flex justify-between items-start gap-2 mb-1">
                      <h3 className="font-h4 text-base font-bold text-[#e5e2e3] tracking-tight">
                        {item.name}
                      </h3>
                      <span className="text-[11px] font-mono-data text-[#9A9DA3] bg-[#0a0a0b] border border-[#232426] px-2 py-0.5 rounded shrink-0">
                        {item.tagLabel}
                      </span>
                    </div>

                    {/* Subtitle + Process Routes count */}
                    <div className="text-xs text-[#9A9DA3] mb-3 flex items-center gap-1.5">
                      <span>{item.subtitle}</span>
                      <span aria-hidden="true">·</span>
                      <span className="text-[#38bdf8] font-medium tabular-nums">
                        {item.processRoutes.length} process routes
                      </span>
                    </div>

                    {/* Process Route Selector Buttons */}
                    <div className="flex flex-wrap gap-1.5">
                      {visibleRoutes.map((route, rIdx) => (
                        <button
                          key={route.id}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelectMaterialCard(item.id, rIdx);
                          }}
                          className={`text-[11px] px-2 py-0.5 rounded border transition-colors whitespace-nowrap truncate max-w-[220px] ${
                            isSelected && selectedVariantIdx === rIdx
                              ? 'bg-[#38bdf8]/20 border-[#38bdf8] text-[#92f1ff]'
                              : 'bg-[#09131c] border-[#1e293b] text-[#38bdf8] hover:border-[#38bdf8]/50'
                          }`}
                        >
                          {route.shortName}
                        </button>
                      ))}

                      {hiddenCount > 0 && !isExpanded && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setExpandedCardRoutesId(item.id);
                            handleSelectMaterialCard(item.id, 3);
                          }}
                          className="text-[11px] px-2 py-0.5 rounded bg-[#09131c] border border-[#1e293b] text-[#38bdf8] hover:border-[#38bdf8]/50 transition-colors whitespace-nowrap"
                        >
                          +{hiddenCount} more
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* RIGHT PANE: Material Explorer / Creation Parameters & Property Profiles (8 cols on lg) */}
        <div className="lg:col-span-8 min-w-0 max-w-full">
          {!selectedMaterial ? (
            /* EMPTY / DEFAULT EXPLORER STATE (Matches image_f48a1e5a.png + Cinematic Precision schematics) */
            <div className="space-y-6">
              <div className="bg-[#101112] border border-[#232426] rounded-xl p-8 sm:p-14 min-h-[360px] flex flex-col items-center justify-center text-center relative overflow-hidden inner-glow shadow-2xl">
                {/* Subtle Cinematic Precision Grid & Corner Brackets */}
                <div className="absolute inset-0 dot-pattern opacity-25 pointer-events-none" />
                <div className="absolute top-4 left-4 w-2.5 h-2.5 border-t border-l border-[#454655]" />
                <div className="absolute top-4 right-4 w-2.5 h-2.5 border-t border-r border-[#454655]" />
                <div className="absolute bottom-4 left-4 w-2.5 h-2.5 border-b border-l border-[#454655]" />
                <div className="absolute bottom-4 right-4 w-2.5 h-2.5 border-b border-r border-[#454655]" />

                {/* Microscope Icon */}
                <div className="w-14 h-14 rounded-xl bg-[#18191c] border border-[#232426] flex items-center justify-center mb-5 text-[#bec2ff] relative z-10 shadow-inner">
                  <Microscope className="w-7 h-7 text-[#50d8e9]" />
                </div>

                <h2 className="font-h2 text-2xl sm:text-3xl font-bold text-white mb-3 relative z-10 tracking-tight">
                  Select a Material to Explore
                </h2>

                <p className="font-body-md text-sm sm:text-base text-[#9A9DA3] max-w-lg leading-relaxed mb-7 relative z-10">
                  Search or click any material on the left to view its detailed manufacturing process, step-by-step parameters of creation, and full mechanical, thermal, and electrical property profiles.
                </p>

                {/* Quick Suggestions Row */}
                <div className="flex flex-wrap items-center justify-center gap-2 relative z-10">
                  <span className="text-xs text-[#9A9DA3] mr-1">
                    Quick suggestions:
                  </span>
                  {QUICK_SUGGESTION_IDS.map((sug) => (
                    <button
                      key={sug.id}
                      onClick={() => handleSelectMaterialCard(sug.id, 0)}
                      className="px-3 py-1.5 rounded bg-[#09131c] border border-[#1e293b] text-[#38bdf8] hover:bg-[#38bdf8]/15 hover:border-[#38bdf8] text-xs font-medium transition-all whitespace-nowrap"
                    >
                      {sug.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Cinematic Precision Architectural Schematics (Bridging Image 1 & Image 2) */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* FIG 0.1 */}
                <div
                  onClick={() => handleSelectMaterialCard('ti-6al-4v', 0)}
                  className="border border-[#232426] hover:border-[#5E6BFF]/50 rounded-xl p-4 bg-[#0a0a0b] cursor-pointer transition-colors flex flex-col h-[230px]"
                >
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-mono-data text-[10px] text-[#9A9DA3]">
                      FIG 0.1 / PBF-LB SYNTHESIS VIEW
                    </span>
                    <span className="font-mono-data text-[9px] text-[#5E6BFF]">
                      TI-6AL-4V
                    </span>
                  </div>
                  <div className="flex-1 border border-[#232426] rounded bg-[#070708] dot-pattern flex items-center justify-center relative p-2">
                    <svg viewBox="0 0 200 120" className="w-full h-full">
                      <rect x="15" y="15" width="170" height="90" rx="2" stroke="#232426" strokeWidth="0.7" fill="none" />
                      <line x1="60" y1="15" x2="60" y2="105" stroke="#232426" strokeWidth="0.7" />
                      <rect x="70" y="24" width="102" height="30" rx="1" stroke="#5E6BFF" strokeWidth="1" fill="rgba(94,107,255,0.06)" />
                      <rect x="70" y="62" width="102" height="34" rx="1" stroke="#232426" strokeWidth="0.7" fill="none" />
                      <text x="76" y="42" fill="#bec2ff" fontFamily="monospace" fontSize="6.5">PHASE_ALPHA // MARTENSITIC_α'</text>
                      <text x="76" y="81" fill="#9A9DA3" fontFamily="monospace" fontSize="6">PHASE_POST // HIP_920C_100MPA</text>
                      <text x="22" y="32" fill="#454655" fontFamily="monospace" fontSize="5.5">AM_ROUTE</text>
                    </svg>
                    <span className="absolute bottom-1.5 right-2 font-mono-data text-[8px] text-[#9A9DA3]/50">
                      UTS: 1040 MPa
                    </span>
                  </div>
                </div>

                {/* FIG 0.2 */}
                <div
                  onClick={() => handleSelectMaterialCard('ti-grade-2', 0)}
                  className="border border-[#232426] hover:border-[#50d8e9]/50 rounded-xl p-4 bg-[#0a0a0b] cursor-pointer transition-colors flex flex-col h-[230px]"
                >
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-mono-data text-[10px] text-[#9A9DA3]">
                      FIG 0.2 / MICROSTRUCTURE GRAPH
                    </span>
                    <span className="font-mono-data text-[9px] text-[#50d8e9]">
                      TI GRADE 2 (CP)
                    </span>
                  </div>
                  <div className="flex-1 border border-[#232426] rounded bg-[#070708] dot-pattern flex items-center justify-center relative p-2">
                    <svg viewBox="0 0 200 120" className="w-full h-full">
                      <circle cx="100" cy="60" r="28" stroke="#50d8e9" strokeWidth="0.8" fill="none" />
                      <circle cx="45" cy="25" r="7" stroke="#454655" strokeWidth="0.7" fill="none" />
                      <circle cx="155" cy="25" r="7" stroke="#454655" strokeWidth="0.7" fill="none" />
                      <circle cx="155" cy="95" r="7" stroke="#454655" strokeWidth="0.7" fill="none" />
                      <circle cx="45" cy="95" r="7" stroke="#454655" strokeWidth="0.7" fill="none" />
                      <line x1="51" y1="29" x2="77" y2="45" stroke="#454655" strokeDasharray="2 2" strokeWidth="0.6" />
                      <line x1="149" y1="29" x2="123" y2="45" stroke="#454655" strokeDasharray="2 2" strokeWidth="0.6" />
                      <line x1="149" y1="91" x2="123" y2="75" stroke="#454655" strokeDasharray="2 2" strokeWidth="0.6" />
                      <line x1="51" y1="91" x2="77" y2="75" stroke="#454655" strokeDasharray="2 2" strokeWidth="0.6" />
                      <text x="80" y="62" fill="#50d8e9" fontFamily="monospace" fontSize="6.5">HCP_EQUIAXED</text>
                    </svg>
                    <span className="absolute bottom-1.5 right-2 font-mono-data text-[8px] text-[#9A9DA3]/50">
                      UTS: 405 MPa
                    </span>
                  </div>
                </div>

                {/* FIG 0.3 */}
                <div
                  onClick={() => handleSelectMaterialCard('ti-48al-2cr-2nb', 0)}
                  className="border border-[#232426] hover:border-[#E5FD17]/50 rounded-xl p-4 bg-[#0a0a0b] cursor-pointer transition-colors flex flex-col h-[230px]"
                >
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-mono-data text-[10px] text-[#9A9DA3]">
                      FIG 0.3 / HIGH-TEMP INTERMETALLIC
                    </span>
                    <span className="font-mono-data text-[9px] text-[#E5FD17]">
                      GAMMA TIAL
                    </span>
                  </div>
                  <div className="flex-1 border border-[#232426] rounded bg-[#070708] dot-pattern flex items-center justify-center relative p-2">
                    <svg viewBox="0 0 200 120" className="w-full h-full">
                      <path d="M20,90 Q65,15 105,60 T185,45" fill="none" stroke="#E5FD17" strokeWidth="1.1" />
                      <line x1="105" y1="12" x2="105" y2="108" stroke="#454655" strokeDasharray="2 2" strokeWidth="0.6" />
                      <circle cx="105" cy="60" r="3" fill="#E5FD17" />
                      <text x="112" y="56" fill="#E5FD17" fontFamily="monospace" fontSize="6.5">[750 °C SERVICE]</text>
                      <text x="112" y="66" fill="#9A9DA3" fontFamily="monospace" fontSize="5.5">TURBINE_BLADE</text>
                    </svg>
                    <span className="absolute bottom-1.5 right-2 font-mono-data text-[8px] text-[#9A9DA3]/50">
                      Density: 3.89 g/cm³
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* ACTIVE MATERIAL & PROCESS VARIANT INSPECTOR */
            <div className="bg-[#101112] border border-[#232426] rounded-xl overflow-hidden inner-glow shadow-2xl space-y-0">
              {/* Top Material Header Bar */}
              <div className="p-6 sm:p-8 bg-[#0b0c0e] border-b border-[#232426]">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                  <button
                    onClick={() => onSelectMaterial(null)}
                    className="text-xs font-mono-data text-[#9A9DA3] hover:text-white flex items-center gap-1.5 px-2.5 py-1 rounded border border-[#232426] bg-[#101112] hover:border-[#454655] transition-colors"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Material Explorer</span>
                  </button>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => setIsProcessCompareOpen(true)}
                      className={`px-3 py-1.5 rounded text-xs font-mono-data border transition-all flex items-center gap-1.5 ${
                        processCompareIds.length >= 2
                          ? 'bg-[#50d8e9]/20 border-[#50d8e9] text-[#50d8e9] shadow-[0_0_15px_rgba(80,216,233,0.15)]'
                          : 'bg-[#101112] border-[#232426] text-[#c6c5d8] hover:border-[#50d8e9]/50'
                      }`}
                      title="Compare up to 5 process variants for this alloy"
                    >
                      <Layers className="w-3.5 h-3.5" />
                      <span>Compare Processes ({processCompareIds.length}/5)</span>
                    </button>

                    <button
                      onClick={() => onToggleCompare(selectedMaterial.id)}
                      className={`px-3 py-1.5 rounded text-xs font-mono-data border transition-colors flex items-center gap-1.5 ${
                        compareIds.includes(selectedMaterial.id)
                          ? 'bg-[#5E6BFF]/20 border-[#5E6BFF] text-[#bec2ff]'
                          : 'bg-[#101112] border-[#232426] text-[#c6c5d8] hover:border-[#5E6BFF]/50'
                      }`}
                    >
                      {compareIds.includes(selectedMaterial.id) ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-[#50d8e9]" />
                          <span>In Comparison ({compareIds.length})</span>
                        </>
                      ) : (
                        <>
                          <Scale className="w-3.5 h-3.5" />
                          <span>Compare Material</span>
                        </>
                      )}
                    </button>

                    {/* Export Menu & Quick Export Buttons */}
                    <button
                      onClick={() => setIsExportModalOpen(true)}
                      className="px-3 py-1.5 rounded text-xs font-mono-data bg-[#16181c] border border-[#50d8e9]/50 text-[#50d8e9] hover:bg-[#50d8e9]/10 transition-colors flex items-center gap-1.5 shadow-[0_0_12px_rgba(80,216,233,0.15)]"
                      title="Export alloy data with options for CSV, PDF datasheet, and JSON"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Export Alloy (.csv / .pdf)</span>
                    </button>

                    <div className="hidden sm:inline-flex items-center rounded border border-[#232426] bg-[#101112] p-0.5 text-[11px] font-mono-data">
                      <button
                        onClick={() => exportAlloyToCsv(selectedMaterial, activeVariant, 'active-route')}
                        className="px-2 py-1 rounded text-[#9A9DA3] hover:text-[#50d8e9] hover:bg-[#16181c] transition-colors"
                        title="Quick download: active route CSV"
                      >
                        .CSV
                      </button>
                      <button
                        onClick={async () => {
                          await exportAlloyToPdf(selectedMaterial, activeVariant);
                        }}
                        className="px-2 py-1 rounded text-[#9A9DA3] hover:text-[#ff7961] hover:bg-[#16181c] transition-colors"
                        title="Quick download: printable Engineering Datasheet PDF"
                      >
                        .PDF
                      </button>
                    </div>

                    {/* Launch Physics Predictor */}
                    <button
                      onClick={() => {
                        const el = document.getElementById('physics-predictor');
                        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      }}
                      className="px-3 py-1.5 rounded text-xs font-mono-data bg-[#122333] border border-[#50d8e9]/70 text-[#50d8e9] hover:bg-[#50d8e9]/20 transition-colors flex items-center gap-1.5 shadow-[0_0_12px_rgba(80,216,233,0.2)]"
                      title="Launch physical simulation, Rosenthal melt pool, and multi-model hardness predictor"
                    >
                      <Flame className="w-3.5 h-3.5 text-[#50d8e9]" />
                      <span>Physics Predictor</span>
                    </button>
                  </div>
                </div>

                {/* Title & Formula Metadata */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 text-xs font-mono-data text-[#50d8e9] mb-1.5">
                      <span>{selectedMaterial.category}</span>
                      <span>·</span>
                      <span>{selectedMaterial.standardCode}</span>
                    </div>
                    <h2 className="font-h2 text-2xl sm:text-4xl font-bold text-white tracking-tight">
                      {selectedMaterial.name}
                    </h2>
                    <p className="text-xs sm:text-sm font-mono-data text-[#bec2ff] mt-1">
                      Formula / Composition: <span className="text-white">{selectedMaterial.formula}</span>
                    </p>
                  </div>

                  <div className="text-left md:text-right font-mono-data text-xs text-[#9A9DA3]">
                    <div className="text-[10px] uppercase tracking-wider text-[#9A9DA3]/60">
                      Crystal / Phase Structure
                    </div>
                    <div className="text-[#e5e2e3] mt-0.5">
                      {selectedMaterial.crystalStructure}
                    </div>
                  </div>
                </div>

                <p className="mt-4 text-sm text-[#9A9DA3] leading-relaxed font-body-md">
                  {selectedMaterial.overview}
                </p>
              </div>

              {/* Process Route Variants Bar */}
              <div className="p-6 bg-[#0e0f11] border-b border-[#232426]">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                  <div>
                    <span className="text-xs font-mono-data text-[#9A9DA3] uppercase tracking-wider block">
                      {activeCategory === 'All Processes'
                        ? `Select Process Route (${selectedMaterial.processRoutes.length} Variants Across All Processes)`
                        : `${activeCategory} Routes (${activeProcessRoutes.length} Variants)`}
                    </span>
                    <span className="text-[11px] font-mono-data text-[#9A9DA3]/70">
                      Click route to inspect · Use <span className="text-[#50d8e9] font-bold">[+ Comp]</span> to compare up to 5 processes side-by-side
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {activeVariant && (
                      <span className="text-xs font-mono-data text-[#50d8e9] mr-2">
                        {activeVariant.temperOrGrade}
                      </span>
                    )}
                    <button
                      onClick={() => setIsProcessCompareOpen(true)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-mono-data font-semibold border transition-all flex items-center gap-1.5 ${
                        processCompareIds.length >= 2
                          ? 'bg-[#50d8e9]/20 border-[#50d8e9] text-[#50d8e9] shadow-[0_0_15px_rgba(80,216,233,0.15)]'
                          : 'bg-[#101112] border-[#232426] text-[#9A9DA3] hover:text-white hover:border-[#454655]'
                      }`}
                    >
                      <Layers className="w-3.5 h-3.5" />
                      <span>Compare Processes ({processCompareIds.length}/5)</span>
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {activeProcessRoutes.map((route, idx) => {
                    const isRouteActive = route.id === activeVariant?.id;
                    const isCompared = processCompareIds.includes(route.id);
                    const canCompare = isCompared || processCompareIds.length < 5;

                    return (
                      <div
                        key={route.id}
                        className={`inline-flex items-center rounded-lg border text-xs font-medium transition-all ${
                          isRouteActive
                            ? 'bg-[#38bdf8] text-[#070708] border-[#38bdf8] font-bold shadow-[0_0_15px_rgba(56,189,248,0.25)]'
                            : isCompared
                            ? 'bg-[#0e1626] border-[#50d8e9]/70 text-white'
                            : 'bg-[#070708] border-[#232426] text-[#c6c5d8] hover:border-[#50d8e9]/50 hover:text-white'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => setSelectedVariantIdx(idx)}
                          className="px-3 py-2 text-left flex items-center"
                        >
                          <span className="font-mono-data opacity-70 mr-1.5">
                            {idx + 1 < 10 ? `0${idx + 1}.` : `${idx + 1}.`}
                          </span>
                          <span>{route.name}</span>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleProcessCompare(route.id);
                          }}
                          disabled={!canCompare}
                          title={
                            isCompared
                              ? 'Remove from process comparison'
                              : processCompareIds.length >= 5
                              ? 'Max 5 processes reached'
                              : 'Add to process comparison'
                          }
                          className={`mr-1.5 px-1.5 py-0.5 rounded text-[10px] font-mono-data transition-colors ${
                            isCompared
                              ? isRouteActive
                                ? 'bg-[#070708] text-[#38bdf8] font-bold'
                                : 'bg-[#50d8e9] text-[#070708] font-bold'
                              : canCompare
                              ? isRouteActive
                                ? 'bg-[#070708]/30 text-[#070708] hover:bg-[#070708] hover:text-white'
                                : 'text-[#9A9DA3] hover:text-white bg-[#101112] hover:bg-[#1e2024] border border-[#232426]'
                              : 'opacity-30 cursor-not-allowed text-[#9A9DA3]'
                          }`}
                        >
                          {isCompared ? '✓ Comp' : '+ Comp'}
                        </button>
                      </div>
                    );
                  })}
                </div>

                {/* Active Comparison Bar if 1+ selected */}
                {processCompareIds.length > 0 && (
                  <div className="mt-4 p-3 rounded-lg bg-[#070708] border border-[#50d8e9]/30 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-mono-data text-[#50d8e9] font-semibold">
                        Comparing {processCompareIds.length} of 5 processes:
                      </span>
                      {processCompareIds.map((cId) => {
                        const r = selectedMaterial.processRoutes.find((x) => x.id === cId);
                        if (!r) return null;
                        return (
                          <span
                            key={cId}
                            className="text-[11px] font-mono-data px-2 py-0.5 rounded bg-[#101112] border border-[#232426] text-white flex items-center gap-1.5"
                          >
                            <span className="max-w-[150px] truncate">{r.name}</span>
                            <button
                              type="button"
                              onClick={() => handleToggleProcessCompare(cId)}
                              className="text-[#9A9DA3] hover:text-[#ffb4ab] font-bold text-xs"
                            >
                              ×
                            </button>
                          </span>
                        );
                      })}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setIsProcessCompareOpen(true)}
                        className="px-3.5 py-1.5 rounded text-xs font-mono-data font-bold bg-[#50d8e9] text-[#070708] hover:bg-[#38bdf8] transition-all flex items-center gap-1.5 shadow-[0_0_15px_rgba(80,216,233,0.3)]"
                      >
                        <span>View Comparison Table ({processCompareIds.length})</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={handleClearProcessCompare}
                        className="px-2 py-1 text-xs font-mono-data text-[#9A9DA3] hover:text-white"
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                )}

                {/* Active Route Summary KPI Strip */}
                {activeVariant && (
                  <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-[#232426]/80">
                    <div className="p-3 bg-[#070708] border border-[#232426] rounded-lg">
                      <span className="text-[10px] font-mono-data text-[#9A9DA3] block">
                        Peak Process Temp
                      </span>
                      <span className="text-lg font-mono-data font-bold text-[#50d8e9] tabular-nums">
                        {activeVariant.peakTempC} °C
                      </span>
                    </div>
                    <div className="p-3 bg-[#070708] border border-[#232426] rounded-lg">
                      <span className="text-[10px] font-mono-data text-[#9A9DA3] block">
                        Total Hold Duration
                      </span>
                      <span className="text-lg font-mono-data font-bold text-white tabular-nums">
                        {activeVariant.holdTimeMin} min
                      </span>
                    </div>
                    <div className="p-3 bg-[#070708] border border-[#232426] rounded-lg">
                      <span className="text-[10px] font-mono-data text-[#9A9DA3] block">
                        Cooling / Quench Vector
                      </span>
                      <span className="text-xs font-mono-data font-semibold text-[#bec2ff] block mt-1 truncate">
                        {activeVariant.coolingRate}
                      </span>
                    </div>
                    <div className="p-3 bg-[#070708] border border-[#232426] rounded-lg">
                      <span className="text-[10px] font-mono-data text-[#9A9DA3] block">
                        Process Atmosphere
                      </span>
                      <span className="text-xs font-mono-data font-semibold text-[#ffb689] block mt-1 truncate">
                        {activeVariant.atmosphere}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Step-by-Step Creation Parameters + Thermal Curve Schematic */}
              {activeVariant && (
                <div className="p-6 sm:p-8 border-b border-[#232426] space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <h3 className="font-h3 text-lg font-bold text-white">
                        Creation Parameters &amp; Thermal-Mechanical Pathway
                      </h3>
                      <p className="text-xs text-[#9A9DA3] mt-0.5">
                        {activeVariant.summary}
                      </p>
                    </div>
                    <span className="text-xs font-mono-data text-[#50d8e9] shrink-0">
                      YIELD DELTA: {activeVariant.yieldChangePct}
                    </span>
                  </div>

                  {/* Interactive Thermal-Time Synthesis Profile (Cinematic Precision SVG) */}
                  <div
                    className="h-52 bg-[#070708] border border-[#232426] rounded-xl relative overflow-hidden p-4 cursor-crosshair select-none"
                    onMouseMove={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      setSvgProbe({
                        x: e.clientX - rect.left,
                        y: e.clientY - rect.top,
                        active: true,
                      });
                    }}
                    onMouseLeave={() => setSvgProbe((p) => ({ ...p, active: false }))}
                  >
                    <div className="absolute inset-0 dot-pattern opacity-25 pointer-events-none" />
                    <div className="flex justify-between items-center text-[10px] font-mono-data text-[#9A9DA3] relative z-10 mb-2">
                      <span>THERMAL_KINETIC_TRACE // {activeVariant.shortName.toUpperCase()}</span>
                      <span className="text-[#50d8e9]">
                        T_MAX: {activeVariant.peakTempC} °C · HOLD: {activeVariant.holdTimeMin} MIN
                      </span>
                    </div>

                    <svg viewBox="0 0 800 140" className="w-full h-32 overflow-visible">
                      <line x1="0" y1="120" x2="800" y2="120" stroke="#232426" strokeWidth="1" />
                      <line x1="0" y1="65" x2="800" y2="65" stroke="#232426" strokeDasharray="3 3" strokeWidth="0.6" />
                      <line x1="0" y1="20" x2="800" y2="20" stroke="#232426" strokeDasharray="3 3" strokeWidth="0.6" />

                      {/* Synthesis Thermal Profile Path */}
                      <path
                        d="M 20,115 L 160,65 L 280,65 L 410,22 L 580,22 C 630,22 660,95 720,105 L 780,115"
                        fill="none"
                        stroke="#50d8e9"
                        strokeWidth="2"
                      />
                      {/* Secondary Pressure / Stress Envelope */}
                      <path
                        d="M 20,118 L 160,95 L 410,50 L 580,45 L 780,116"
                        fill="none"
                        stroke="#5E6BFF"
                        strokeDasharray="3 4"
                        strokeWidth="1.2"
                        opacity="0.7"
                      />

                      {/* Stage Nodes */}
                      <circle cx="160" cy="65" r="3.5" fill="#bec2ff" />
                      <text x="140" y="54" fill="#bec2ff" fontFamily="monospace" fontSize="9">
                        PREHEAT / HOMOGENIZE
                      </text>

                      <circle cx="410" cy="22" r="4" fill="#50d8e9" />
                      <text x="395" y="12" fill="#50d8e9" fontFamily="monospace" fontSize="9" fontWeight="bold">
                        PEAK SYNTHESIS ({activeVariant.peakTempC} °C)
                      </text>

                      <circle cx="580" cy="22" r="3.5" fill="#E5FD17" />
                      <text x="565" y="38" fill="#E5FD17" fontFamily="monospace" fontSize="9">
                        QUENCH / CONSOLIDATE
                      </text>

                      <circle cx="720" cy="105" r="3.5" fill="#ffb689" />
                      <text x="665" y="96" fill="#ffb689" fontFamily="monospace" fontSize="9">
                        AGING / STABILIZE
                      </text>
                    </svg>

                    {svgProbe.active && (
                      <div
                        className="absolute pointer-events-none px-2 py-1 bg-[#101112]/95 border border-[#50d8e9]/50 rounded text-[10px] font-mono-data text-[#50d8e9]"
                        style={{
                          left: Math.min(svgProbe.x + 12, 540),
                          top: Math.max(svgProbe.y - 28, 8),
                        }}
                      >
                        t = {Math.round((svgProbe.x / 700) * activeVariant.holdTimeMin)} min · T ≈{' '}
                        {Math.max(
                          25,
                          Math.round(activeVariant.peakTempC * (1 - svgProbe.y / 210))
                        )}{' '}
                        °C
                      </div>
                    )}
                  </div>

                  {/* Step-by-Step Creation Protocol Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {activeVariant.steps.map((step, sIdx) => (
                      <div
                        key={step.phaseCode}
                        className="p-4 bg-[#0a0a0b] border border-[#232426] rounded-xl flex flex-col justify-between space-y-3"
                      >
                        <div>
                          <div className="flex justify-between items-center text-[10px] font-mono-data text-[#50d8e9] mb-1">
                            <span>{step.phaseCode}</span>
                            <span className="text-[#9A9DA3]">STEP 0{sIdx + 1}</span>
                          </div>
                          <h4 className="font-h4 text-sm font-bold text-white mb-1.5">
                            {step.stage}
                          </h4>
                          <p className="text-xs text-[#9A9DA3] leading-relaxed">
                            {step.details}
                          </p>
                        </div>

                        <div className="grid grid-cols-3 gap-2 pt-3 border-t border-[#232426]/60 text-[11px] font-mono-data">
                          <div>
                            <span className="text-[9px] text-[#9A9DA3] block">TEMP</span>
                            <span className="text-white tabular-nums">{step.temperature}</span>
                          </div>
                          <div>
                            <span className="text-[9px] text-[#9A9DA3] block">PRESSURE</span>
                            <span className="text-[#bec2ff] tabular-nums">{step.pressure}</span>
                          </div>
                          <div>
                            <span className="text-[9px] text-[#9A9DA3] block">DURATION</span>
                            <span className="text-[#50d8e9] tabular-nums">{step.duration}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Full Mechanical, Thermal & Electrical Property Profiles */}
              <div className="p-6 sm:p-8 space-y-6 bg-[#0b0c0e]">
                <div className="flex items-center justify-between">
                  <h3 className="font-h3 text-lg font-bold text-white">
                    Mechanical, Thermal &amp; Electrical Property Profiles
                  </h3>
                  <span className="text-xs font-mono-data text-[#9A9DA3]">
                    CALIBRATED TO ACTIVE VARIANT
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                  {/* 1. Mechanical Properties Test Profile */}
                  <div className="p-5 bg-[#101112] border border-[#232426] rounded-xl space-y-3">
                    <div className="flex items-center justify-between pb-2.5 border-b border-[#232426]">
                      <span className="text-xs font-mono-data text-[#50d8e9] font-semibold uppercase">
                        Mechanical Profile
                      </span>
                      <Shield className="w-4 h-4 text-[#50d8e9]" />
                    </div>

                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between items-baseline">
                        <span className="text-[#9A9DA3]">Tensile Strength (UTS)</span>
                        <span className="font-mono-data font-bold text-white tabular-nums">
                          {activeVariant?.propertyOverrides?.tensileStrengthMPa ||
                            selectedMaterial.mechanical.tensileStrengthMPa}
                        </span>
                      </div>
                      <div className="flex justify-between items-baseline">
                        <span className="text-[#9A9DA3]">Yield Strength (0.2%)</span>
                        <span className="font-mono-data font-bold text-[#50d8e9] tabular-nums">
                          {activeVariant?.propertyOverrides?.yieldStrengthMPa ||
                            selectedMaterial.mechanical.yieldStrengthMPa}
                        </span>
                      </div>
                      <div className="flex justify-between items-baseline">
                        <span className="text-[#9A9DA3]">Elastic Modulus (E)</span>
                        <span className="font-mono-data text-white tabular-nums">
                          {activeVariant?.propertyOverrides?.elasticModulusGPa ||
                            selectedMaterial.mechanical.elasticModulusGPa}
                        </span>
                      </div>
                      <div className="flex justify-between items-baseline">
                        <span className="text-[#9A9DA3]">Elongation at Break</span>
                        <span className="font-mono-data text-white tabular-nums">
                          {activeVariant?.propertyOverrides?.elongationPct ||
                            selectedMaterial.mechanical.elongationPct}
                        </span>
                      </div>
                      <div className="flex justify-between items-baseline">
                        <span className="text-[#9A9DA3]">Vickers Hardness</span>
                        <span className="font-mono-data text-white tabular-nums">
                          {activeVariant?.propertyOverrides?.hardnessHV ||
                            selectedMaterial.mechanical.hardnessHV}
                        </span>
                      </div>
                      <div className="flex justify-between items-baseline">
                        <span className="text-[#9A9DA3]">Fracture Toughness</span>
                        <span className="font-mono-data text-white tabular-nums">
                          {activeVariant?.propertyOverrides?.fractureToughness ||
                            selectedMaterial.mechanical.fractureToughness}
                        </span>
                      </div>
                      <div className="flex justify-between items-baseline">
                        <span className="text-[#9A9DA3]">Fatigue (10⁷ cyc)</span>
                        <span className="font-mono-data text-white tabular-nums">
                          {activeVariant?.propertyOverrides?.fatigueStrengthMPa ||
                            selectedMaterial.mechanical.fatigueStrengthMPa}
                        </span>
                      </div>
                      <div className="flex justify-between items-baseline">
                        <span className="text-[#9A9DA3]">Charpy Impact</span>
                        <span className="font-mono-data text-white tabular-nums">
                          {activeVariant?.propertyOverrides?.charpyImpactEnergyJ ||
                            selectedMaterial.mechanical.charpyImpactEnergyJ}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 2. Thermal & Phase Transitions Test Profile */}
                  <div className="p-5 bg-[#101112] border border-[#232426] rounded-xl space-y-3">
                    <div className="flex items-center justify-between pb-2.5 border-b border-[#232426]">
                      <span className="text-xs font-mono-data text-[#ffb689] font-semibold uppercase">
                        Thermal &amp; Phase
                      </span>
                      <Thermometer className="w-4 h-4 text-[#ffb689]" />
                    </div>

                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between items-baseline">
                        <span className="text-[#9A9DA3]">Liquidus / Melt</span>
                        <span className="font-mono-data font-bold text-white tabular-nums">
                          {activeVariant?.propertyOverrides?.liquidusC ||
                            selectedMaterial.thermal.liquidusC}
                        </span>
                      </div>
                      <div className="flex justify-between items-baseline">
                        <span className="text-[#9A9DA3]">β-Transus Temp</span>
                        <span className="font-mono-data font-bold text-[#ffb689] tabular-nums">
                          {activeVariant?.propertyOverrides?.betaTransusC ||
                            selectedMaterial.thermal.betaTransusC}
                        </span>
                      </div>
                      <div className="flex justify-between items-baseline">
                        <span className="text-[#9A9DA3]">Max Service Temp</span>
                        <span className="font-mono-data text-white tabular-nums">
                          {activeVariant?.propertyOverrides?.maxServiceTempC ||
                            selectedMaterial.thermal.maxServiceTempC}
                        </span>
                      </div>
                      <div className="flex justify-between items-baseline">
                        <span className="text-[#9A9DA3]">Thermal Conductivity</span>
                        <span className="font-mono-data text-white tabular-nums">
                          {activeVariant?.propertyOverrides?.thermalConductivity ||
                            selectedMaterial.thermal.thermalConductivity}
                        </span>
                      </div>
                      <div className="flex justify-between items-baseline">
                        <span className="text-[#9A9DA3]">Thermal Expansion (CTE)</span>
                        <span className="font-mono-data text-white tabular-nums">
                          {activeVariant?.propertyOverrides?.thermalExpansionCTE ||
                            selectedMaterial.thermal.thermalExpansionCTE}
                        </span>
                      </div>
                      <div className="flex justify-between items-baseline">
                        <span className="text-[#9A9DA3]">Specific Heat (Cp)</span>
                        <span className="font-mono-data text-white tabular-nums">
                          {activeVariant?.propertyOverrides?.specificHeat ||
                            selectedMaterial.thermal.specificHeat}
                        </span>
                      </div>
                      <div className="flex justify-between items-baseline">
                        <span className="text-[#9A9DA3]">Emissivity</span>
                        <span className="font-mono-data text-white tabular-nums">
                          {activeVariant?.propertyOverrides?.emissivity ||
                            selectedMaterial.thermal.emissivity}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 3. Additive Manufacturing Telemetry */}
                  <div className="p-5 bg-[#101112] border border-[#232426] rounded-xl space-y-3">
                    <div className="flex items-center justify-between pb-2.5 border-b border-[#232426]">
                      <span className="text-xs font-mono-data text-[#E5FD17] font-semibold uppercase">
                        AM Process Metrics
                      </span>
                      <Gauge className="w-4 h-4 text-[#E5FD17]" />
                    </div>

                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between items-baseline">
                        <span className="text-[#9A9DA3]">Relative Density</span>
                        <span className="font-mono-data font-bold text-[#E5FD17] tabular-nums">
                          {activeVariant?.propertyOverrides?.relativeDensityPct ||
                            selectedMaterial.amQuality.relativeDensityPct}
                        </span>
                      </div>
                      <div className="flex justify-between items-baseline">
                        <span className="text-[#9A9DA3]">Internal Porosity</span>
                        <span className="font-mono-data text-white tabular-nums">
                          {activeVariant?.propertyOverrides?.porosityPct ||
                            selectedMaterial.amQuality.porosityPct}
                        </span>
                      </div>
                      <div className="flex justify-between items-baseline">
                        <span className="text-[#9A9DA3]">Surface Roughness (Ra)</span>
                        <span className="font-mono-data text-white tabular-nums">
                          {activeVariant?.propertyOverrides?.surfaceRoughnessRa ||
                            selectedMaterial.amQuality.surfaceRoughnessRa}
                        </span>
                      </div>
                      <div className="flex justify-between items-baseline">
                        <span className="text-[#9A9DA3]">Peak Residual Stress</span>
                        <span className="font-mono-data font-bold text-[#ffb689] tabular-nums">
                          {activeVariant?.propertyOverrides?.residualStressMax ||
                            selectedMaterial.amQuality.residualStressMax}
                        </span>
                      </div>
                      <div className="flex justify-between items-baseline">
                        <span className="text-[#9A9DA3]">Volumetric Build Rate</span>
                        <span className="font-mono-data text-[#50d8e9] tabular-nums">
                          {activeVariant?.propertyOverrides?.buildRate ||
                            selectedMaterial.amQuality.buildRate}
                        </span>
                      </div>
                      <div className="flex justify-between items-baseline">
                        <span className="text-[#9A9DA3]">Build Anisotropy</span>
                        <span className="font-mono-data text-white tabular-nums">
                          {activeVariant?.propertyOverrides?.anisotropy ||
                            selectedMaterial.amQuality.anisotropy}
                        </span>
                      </div>
                      <div className="flex justify-between items-baseline">
                        <span className="text-[#9A9DA3]">Min Feature Size</span>
                        <span className="font-mono-data text-white tabular-nums">
                          {activeVariant?.propertyOverrides?.minFeatureSize ||
                            selectedMaterial.amQuality.minFeatureSize}
                        </span>
                      </div>
                      <div className="flex justify-between items-baseline">
                        <span className="text-[#9A9DA3]">Dimensional Accuracy</span>
                        <span className="font-mono-data text-white tabular-nums">
                          {activeVariant?.propertyOverrides?.accuracy ||
                            selectedMaterial.amQuality.accuracy}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 4. Chemical, Physical & Optical Tests */}
                  <div className="p-5 bg-[#101112] border border-[#232426] rounded-xl space-y-3">
                    <div className="flex items-center justify-between pb-2.5 border-b border-[#232426]">
                      <span className="text-xs font-mono-data text-[#bec2ff] font-semibold uppercase">
                        Chemical &amp; Optical
                      </span>
                      <Zap className="w-4 h-4 text-[#bec2ff]" />
                    </div>

                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between items-baseline">
                        <span className="text-[#9A9DA3]">Bulk Density (ρ)</span>
                        <span className="font-mono-data font-bold text-white tabular-nums">
                          {activeVariant?.propertyOverrides?.densityGcm3 ||
                            selectedMaterial.amQuality.densityGcm3}
                        </span>
                      </div>
                      <div className="flex justify-between items-baseline">
                        <span className="text-[#9A9DA3]">Interstitial Oxygen</span>
                        <span className="font-mono-data font-bold text-white tabular-nums">
                          {activeVariant?.propertyOverrides?.oxygenContentWt ||
                            selectedMaterial.chemicalAndPhysical.oxygenContentWt}
                        </span>
                      </div>
                      <div className="flex justify-between items-baseline">
                        <span className="text-[#9A9DA3]">Electrical Resistivity</span>
                        <span className="font-mono-data font-bold text-[#bec2ff] tabular-nums">
                          {activeVariant?.propertyOverrides?.electricalResistivity ||
                            selectedMaterial.chemicalAndPhysical.electricalResistivity}
                        </span>
                      </div>
                      <div className="flex justify-between items-baseline">
                        <span className="text-[#9A9DA3]">Laser Absorptivity (1070nm)</span>
                        <span className="font-mono-data text-white tabular-nums">
                          {activeVariant?.propertyOverrides?.laserAbsorptivity ||
                            selectedMaterial.chemicalAndPhysical.laserAbsorptivity}
                        </span>
                      </div>
                      <div className="flex justify-between items-baseline">
                        <span className="text-[#9A9DA3]">Visible Reflectance</span>
                        <span className="font-mono-data text-white tabular-nums">
                          {activeVariant?.propertyOverrides?.visibleReflectance ||
                            selectedMaterial.chemicalAndPhysical.visibleReflectance}
                        </span>
                      </div>
                      <div className="flex justify-between items-baseline">
                        <span className="text-[#9A9DA3]">Corrosion Rating</span>
                        <span className="font-mono-data text-white tabular-nums">
                          {activeVariant?.propertyOverrides?.corrosionRating ||
                            selectedMaterial.chemicalAndPhysical.corrosionRating}
                        </span>
                      </div>
                      <div className="flex justify-between items-baseline">
                        <span className="text-[#9A9DA3]">Biocompatibility</span>
                        <span className="font-mono-data text-white tabular-nums">
                          {activeVariant?.propertyOverrides?.biocompatibilityRating ||
                            selectedMaterial.chemicalAndPhysical.biocompatibilityRating}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Principal Industrial Applications */}
                <div className="p-4 bg-[#101112] border border-[#232426] rounded-xl flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-mono-data text-[#9A9DA3]">
                      PRIMARY APPLICATIONS:
                    </span>
                    {selectedMaterial.applications.map((app, idx) => (
                      <React.Fragment key={app}>
                        {idx > 0 && <span className="text-[#454655]">·</span>}
                        <span className="text-[#e5e2e3]">{app}</span>
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Process Route Comparison Modal (Up to 5 AM processes for the same alloy) */}
      {selectedMaterial && (
        <ProcessCompareModal
          isOpen={isProcessCompareOpen}
          onClose={() => setIsProcessCompareOpen(false)}
          material={selectedMaterial}
          selectedVariantIds={processCompareIds}
          onToggleVariant={handleToggleProcessCompare}
          onClearVariants={handleClearProcessCompare}
          onSelectVariantForInspector={(vIdx) => {
            setSelectedVariantIdx(vIdx);
            setIsProcessCompareOpen(false);
          }}
        />
      )}

      {/* Alloy Data Export Modal (CSV, PDF, JSON options) */}
      <AlloyExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        material={selectedMaterial}
        activeVariant={activeVariant}
      />
    </div>
  );
}
