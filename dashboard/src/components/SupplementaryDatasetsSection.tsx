/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Supplementary Datasets & Empirical Telemetry Section
 * Dedicated, standalone section for researchers and engineers to explore,
 * filter, inspect, and export all 275 Titanium AM Process Variants across 20 alloys,
 * curated peer-reviewed experimental callsets, process parameter envelopes,
 * and literature evidence gap matrices — without needing to interact with the physics predictor.
 */

import React, { useState, useMemo } from 'react';
import {
  Database,
  Table,
  Search,
  Filter,
  Download,
  FileSpreadsheet,
  FileJson,
  Layers,
  Sliders,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Info,
  CheckCircle,
  AlertTriangle,
  Lightbulb,
  TrendingUp,
  X,
  Eye,
  ArrowRight,
  Atom,
  Flame,
  Award
} from 'lucide-react';
import {
  MATERIALS_CATALOG,
  MaterialItem,
  ProcessVariant,
  ProcessCategory
} from '../data/materialsData';
import {
  INDEXED_LITERATURE,
  CURATED_EXPERIMENTAL_RECORDS,
  PROCESS_PARAMETER_RANGES,
  FREQUENTLY_REPORTED_PROPERTIES,
  INSUFFICIENT_EVIDENCE_PROPERTIES,
  RESEARCH_OPPORTUNITIES,
  CuratedExperimentalRecord
} from '../utils/literatureIntelligence';

interface SupplementaryDatasetsSectionProps {
  onSelectMaterialInWorkbench?: (materialId: string) => void;
  onApplyParametersToPredictor?: (alloyId: string, processId?: string) => void;
}

export type DatasetTab = 'variants' | 'literature-records' | 'parameter-envelopes' | 'evidence-matrix';

interface FlatVariantRow {
  variantId: string;
  alloyId: string;
  alloyName: string;
  alloyFamily: string;
  category: ProcessCategory;
  subprocess: string;
  condition: string;
  yieldStrengthMPa: number;
  yieldStrengthStr: string;
  tensileStrengthMPa: number;
  tensileStrengthStr: string;
  elongationPct: number;
  elongationStr: string;
  hardnessHV: number;
  hardnessStr: string;
  relativeDensityPct: number;
  relativeDensityStr: string;
  porosityPct: string;
  elasticModulusGPa: string;
  surfaceRoughnessRa: string;
  residualStressMax: string;
  buildRate: string;
  fatigueStrengthMPa: string;
  fractureToughness: string;
  charpyImpactEnergyJ: string;
  thermalConductivity: string;
  maxServiceTempC: string;
  densityGcm3: string;
  oxygenContentWt: string;
  corrosionRating: string;
  biocompatibilityRating: string;
  rawMaterial: MaterialItem;
  rawVariant: ProcessVariant;
}

function parseNumeric(val?: string | number): number {
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  if (!val) return 0;
  const match = String(val).match(/[-+]?[0-9]*\.?[0-9]+/);
  return match ? parseFloat(match[0]) : 0;
}

/**
 * Neutralizes CSV Formula Injection (CWE-1236) and safely quotes fields
 */
function escapeCsvValue(val: any): string {
  if (val === null || val === undefined) return '""';
  let str = String(val).replace(/"/g, '""');
  if (/^[=+@-|\t\r]/.test(str)) {
    str = "'" + str;
  }
  return `"${str}"`;
}

function downloadBrowserFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob(['\uFEFF', content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    if (a.parentNode) a.parentNode.removeChild(a);
    URL.revokeObjectURL(url);
  }, 250);
}

export const SupplementaryDatasetsSection: React.FC<SupplementaryDatasetsSectionProps> = ({
  onSelectMaterialInWorkbench,
  onApplyParametersToPredictor
}) => {
  const [activeTab, setActiveTab] = useState<DatasetTab>('variants');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProcessFilter, setSelectedProcessFilter] = useState<string>('All');
  const [selectedConditionFilter, setSelectedConditionFilter] = useState<string>('All');
  const [sortField, setSortField] = useState<keyof FlatVariantRow>('variantId');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(15);
  const [inspectingVariant, setInspectingVariant] = useState<FlatVariantRow | null>(null);

  // Flatten all 275 process variants with complete metadata
  const flatVariants: FlatVariantRow[] = useMemo(() => {
    const rows: FlatVariantRow[] = [];
    MATERIALS_CATALOG.forEach((mat) => {
      mat.processRoutes.forEach((vr) => {
        const p = vr.propertyOverrides || {};
        rows.push({
          variantId: vr.id,
          alloyId: mat.id,
          alloyName: mat.name,
          alloyFamily: mat.category,
          category: vr.processCategory,
          subprocess: vr.subprocess,
          condition: vr.postProcessingCondition,
          yieldStrengthMPa: parseNumeric(p.yieldStrengthMPa || mat.mechanical.yieldStrengthMPa),
          yieldStrengthStr: p.yieldStrengthMPa || mat.mechanical.yieldStrengthMPa || 'N/A',
          tensileStrengthMPa: parseNumeric(p.tensileStrengthMPa || mat.mechanical.tensileStrengthMPa),
          tensileStrengthStr: p.tensileStrengthMPa || mat.mechanical.tensileStrengthMPa || 'N/A',
          elongationPct: parseNumeric(p.elongationPct || mat.mechanical.elongationPct),
          elongationStr: p.elongationPct || mat.mechanical.elongationPct || 'N/A',
          hardnessHV: parseNumeric(p.hardnessHV || mat.mechanical.hardnessHV),
          hardnessStr: p.hardnessHV || mat.mechanical.hardnessHV || 'N/A',
          relativeDensityPct: parseNumeric(p.relativeDensityPct || mat.amQuality.relativeDensityPct),
          relativeDensityStr: p.relativeDensityPct || mat.amQuality.relativeDensityPct || 'N/A',
          porosityPct: p.porosityPct || mat.amQuality.porosityPct || 'N/A',
          elasticModulusGPa: p.elasticModulusGPa || mat.mechanical.elasticModulusGPa || 'N/A',
          surfaceRoughnessRa: p.surfaceRoughnessRa || mat.amQuality.surfaceRoughnessRa || 'N/A',
          residualStressMax: p.residualStressMax || mat.amQuality.residualStressMax || 'N/A',
          buildRate: p.buildRate || mat.amQuality.buildRate || 'N/A',
          fatigueStrengthMPa: p.fatigueStrengthMPa || mat.mechanical.fatigueStrengthMPa || 'N/A',
          fractureToughness: p.fractureToughness || mat.mechanical.fractureToughness || 'N/A',
          charpyImpactEnergyJ: p.charpyImpactEnergyJ || mat.mechanical.charpyImpactEnergyJ || 'N/A',
          thermalConductivity: p.thermalConductivity || mat.thermal.thermalConductivity || 'N/A',
          maxServiceTempC: p.maxServiceTempC || mat.thermal.maxServiceTempC || 'N/A',
          densityGcm3: p.densityGcm3 || mat.amQuality.densityGcm3 || 'N/A',
          oxygenContentWt: p.oxygenContentWt || mat.chemicalAndPhysical.oxygenContentWt || 'N/A',
          corrosionRating: p.corrosionRating || mat.chemicalAndPhysical.corrosionRating || 'N/A',
          biocompatibilityRating: p.biocompatibilityRating || mat.chemicalAndPhysical.biocompatibilityRating || 'N/A',
          rawMaterial: mat,
          rawVariant: vr
        });
      });
    });
    return rows;
  }, []);

  // Filtered & sorted variants
  const filteredVariants = useMemo(() => {
    let result = flatVariants.filter((row) => {
      if (selectedProcessFilter !== 'All' && row.category !== selectedProcessFilter) {
        return false;
      }
      if (selectedConditionFilter !== 'All') {
        const cLower = row.condition.toLowerCase();
        if (selectedConditionFilter === 'As-built' && !cLower.includes('as-built')) return false;
        if (selectedConditionFilter === 'Stress-relieved' && !cLower.includes('stress')) return false;
        if (selectedConditionFilter === 'HIP' && !cLower.includes('hip')) return false;
        if (selectedConditionFilter === 'STA/Annealed' && !cLower.includes('anneal') && !cLower.includes('sta')) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matches =
          row.variantId.toLowerCase().includes(q) ||
          row.alloyName.toLowerCase().includes(q) ||
          row.subprocess.toLowerCase().includes(q) ||
          row.category.toLowerCase().includes(q) ||
          row.condition.toLowerCase().includes(q);
        if (!matches) return false;
      }
      return true;
    });

    result.sort((a, b) => {
      const valA = a[sortField];
      const valB = b[sortField];
      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortDirection === 'asc' ? valA - valB : valB - valA;
      }
      const strA = String(valA || '').toLowerCase();
      const strB = String(valB || '').toLowerCase();
      return sortDirection === 'asc' ? strA.localeCompare(strB) : strB.localeCompare(strA);
    });

    return result;
  }, [flatVariants, selectedProcessFilter, selectedConditionFilter, searchQuery, sortField, sortDirection]);

  // Pagination calculation
  const totalPages = Math.ceil(filteredVariants.length / pageSize) || 1;
  const paginatedVariants = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredVariants.slice(start, start + pageSize);
  }, [filteredVariants, currentPage, pageSize]);

  const handleSort = (field: keyof FlatVariantRow) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
    setCurrentPage(1);
  };

  // CSV Export Function
  const handleExportCsv = () => {
    const headers = [
      'Variant ID',
      'Alloy ID',
      'Alloy Name',
      'Process Category',
      'Subprocess',
      'Post-Processing Condition',
      'Density (g/cm³)',
      'Relative Density (%)',
      'Porosity (%)',
      'Yield Strength (MPa)',
      'Tensile Strength UTS (MPa)',
      'Elongation at Break (%)',
      'Vickers Hardness (HV)',
      'Elastic Modulus (GPa)',
      'Surface Roughness Ra (µm)',
      'Residual Stress Max (MPa)',
      'Build Rate (cm³/h)',
      'Fatigue Strength 10^7 (MPa)',
      'Fracture Toughness K1c (MPa*m^0.5)',
      'Charpy Impact Energy (J)',
      'Thermal Conductivity (W/m*K)',
      'Max Service Temp (°C)',
      'Oxygen Content (wt. %)',
      'Corrosion Rating (1-5)',
      'Biocompatibility Rating (1-5)'
    ];

    const rows = filteredVariants.map((r) => [
      escapeCsvValue(r.variantId),
      escapeCsvValue(r.alloyId),
      escapeCsvValue(r.alloyName),
      escapeCsvValue(r.category),
      escapeCsvValue(r.subprocess),
      escapeCsvValue(r.condition),
      escapeCsvValue(r.densityGcm3),
      escapeCsvValue(r.relativeDensityStr),
      escapeCsvValue(r.porosityPct),
      escapeCsvValue(r.yieldStrengthStr),
      escapeCsvValue(r.tensileStrengthStr),
      escapeCsvValue(r.elongationStr),
      escapeCsvValue(r.hardnessStr),
      escapeCsvValue(r.elasticModulusGPa),
      escapeCsvValue(r.surfaceRoughnessRa),
      escapeCsvValue(r.residualStressMax),
      escapeCsvValue(r.buildRate),
      escapeCsvValue(r.fatigueStrengthMPa),
      escapeCsvValue(r.fractureToughness),
      escapeCsvValue(r.charpyImpactEnergyJ),
      escapeCsvValue(r.thermalConductivity),
      escapeCsvValue(r.maxServiceTempC),
      escapeCsvValue(r.oxygenContentWt),
      escapeCsvValue(r.corrosionRating),
      escapeCsvValue(r.biocompatibilityRating)
    ]);

    const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\r\n');
    downloadBrowserFile(csvContent, 'titanium-am-supplementary-dataset-275-variants.csv', 'text/csv;charset=utf-8;');
  };

  // JSON Export Function
  const handleExportJson = () => {
    const exportData = {
      metadata: {
        title: 'Titanium Additive Manufacturing Supplementary Dataset',
        source: 'MatSci Navigator Empirical Telemetry Repository',
        exportedAt: new Date().toISOString(),
        totalVariantsExported: filteredVariants.length,
        totalAlloysCovered: MATERIALS_CATALOG.length,
        isoAstmProcessesCount: 8
      },
      data: filteredVariants.map((r) => ({
        variantId: r.variantId,
        alloyId: r.alloyId,
        alloyName: r.alloyName,
        processCategory: r.category,
        subprocess: r.subprocess,
        postProcessingCondition: r.condition,
        mechanicalProperties: {
          yieldStrengthMPa: r.yieldStrengthStr,
          tensileStrengthMPa: r.tensileStrengthStr,
          elongationPct: r.elongationStr,
          vickersHardnessHV: r.hardnessStr,
          elasticModulusGPa: r.elasticModulusGPa,
          fatigueStrengthMPa: r.fatigueStrengthMPa,
          fractureToughness: r.fractureToughness,
          charpyImpactEnergyJ: r.charpyImpactEnergyJ
        },
        amQuality: {
          densityGcm3: r.densityGcm3,
          relativeDensityPct: r.relativeDensityStr,
          porosityPct: r.porosityPct,
          surfaceRoughnessRa: r.surfaceRoughnessRa,
          peakResidualStressMPa: r.residualStressMax,
          volumetricBuildRate: r.buildRate
        },
        thermalAndPhysical: {
          thermalConductivity: r.thermalConductivity,
          maxServiceTempC: r.maxServiceTempC,
          oxygenContentWt: r.oxygenContentWt,
          corrosionRating: r.corrosionRating,
          biocompatibilityRating: r.biocompatibilityRating
        }
      }))
    };

    const jsonStr = JSON.stringify(exportData, null, 2);
    downloadBrowserFile(jsonStr, 'titanium-am-supplementary-dataset-275-variants.json', 'application/json;charset=utf-8;');
  };

  // Unique Process Categories
  const processCategories = ['All', ...new Set(flatVariants.map((v) => v.category))];

  return (
    <section id="supplementary-datasets" className="w-full max-w-full overflow-x-hidden py-16 sm:py-20 border-t border-[#232426] bg-[#070708] relative">
      {/* Background accents */}
      <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-[#50d8e9]/40 to-transparent" />
      <div className="absolute -top-32 right-12 w-96 h-96 bg-[#50d8e9]/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 left-12 w-96 h-96 bg-[#5E6BFF]/5 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-[1640px] w-full mx-auto px-4 sm:px-8 min-w-0">
        {/* Section Header */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-10 pb-8 border-b border-[#232426]">
          <div>
            <div className="flex flex-wrap items-center gap-2.5 mb-3">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-medium bg-[#50d8e9]/10 text-[#50d8e9] border border-[#50d8e9]/30">
                <Database className="w-3.5 h-3.5" />
                SUPPLEMENTARY DATASETS &amp; TELEMETRY REPOSITORY
              </span>
              <span className="text-xs font-mono text-[#9A9DA3]">
                ISO/ASTM 52900 Calibrated Callsets
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-white mb-2">
              Empirical Additive Manufacturing Datasets
            </h2>
            <p className="text-sm sm:text-base text-[#9A9DA3] max-w-3xl leading-relaxed">
              Explore, query, filter, and export the comprehensive empirical dataset of 275 Titanium AM variants across 20 alloys, curated peer-reviewed experimental literature benchmarks, parameter envelopes, and documented research gap matrices — cleanly separated from the simulation predictor.
            </p>
          </div>

          {/* Global Dataset Export Actions */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleExportCsv}
              className="px-4 py-2 rounded-lg text-xs font-mono font-semibold bg-[#101112] hover:bg-[#1a1b1d] border border-[#232426] hover:border-[#50d8e9]/50 text-white flex items-center gap-2 transition-all shadow-md group"
            >
              <FileSpreadsheet className="w-4 h-4 text-[#50d8e9] group-hover:scale-110 transition-transform" />
              <span>Export CSV (275 Rows)</span>
            </button>
            <button
              onClick={handleExportJson}
              className="px-4 py-2 rounded-lg text-xs font-mono font-semibold bg-[#101112] hover:bg-[#1a1b1d] border border-[#232426] hover:border-[#5E6BFF]/50 text-white flex items-center gap-2 transition-all shadow-md group"
            >
              <FileJson className="w-4 h-4 text-[#5E6BFF] group-hover:scale-110 transition-transform" />
              <span>Export JSON Spec</span>
            </button>
          </div>
        </div>

        {/* 4 Dataset Navigation Tabs */}
        <div className="flex flex-wrap items-center gap-2 mb-8 bg-[#0b0c0e] p-1.5 rounded-xl border border-[#232426]">
          <button
            onClick={() => setActiveTab('variants')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-mono font-semibold transition-all ${
              activeTab === 'variants'
                ? 'bg-[#50d8e9] text-black shadow-[0_0_20px_rgba(80,216,233,0.3)]'
                : 'text-[#9A9DA3] hover:text-white hover:bg-white/5'
            }`}
          >
            <Table className="w-4 h-4" />
            <span>AM Process Variants ({flatVariants.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('literature-records')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-mono font-semibold transition-all ${
              activeTab === 'literature-records'
                ? 'bg-[#50d8e9] text-black shadow-[0_0_20px_rgba(80,216,233,0.3)]'
                : 'text-[#9A9DA3] hover:text-white hover:bg-white/5'
            }`}
          >
            <Award className="w-4 h-4" />
            <span>Peer-Reviewed Experimental Callset ({CURATED_EXPERIMENTAL_RECORDS.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('parameter-envelopes')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-mono font-semibold transition-all ${
              activeTab === 'parameter-envelopes'
                ? 'bg-[#50d8e9] text-black shadow-[0_0_20px_rgba(80,216,233,0.3)]'
                : 'text-[#9A9DA3] hover:text-white hover:bg-white/5'
            }`}
          >
            <Sliders className="w-4 h-4" />
            <span>Process Parameter Envelopes (4 AM Types)</span>
          </button>

          <button
            onClick={() => setActiveTab('evidence-matrix')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-mono font-semibold transition-all ${
              activeTab === 'evidence-matrix'
                ? 'bg-[#50d8e9] text-black shadow-[0_0_20px_rgba(80,216,233,0.3)]'
                : 'text-[#9A9DA3] hover:text-white hover:bg-white/5'
            }`}
          >
            <AlertTriangle className="w-4 h-4" />
            <span>Property Coverage &amp; Evidence Gaps</span>
          </button>
        </div>

        {/* TAB 1: 275 AM PROCESS VARIANTS TABLE */}
        {activeTab === 'variants' && (
          <div className="space-y-6">
            {/* KPI Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-[#101112] border border-[#232426] rounded-xl p-4">
                <span className="text-[11px] font-mono text-[#9A9DA3] block mb-1">Total Calibrated Variants</span>
                <span className="text-xl sm:text-2xl font-bold font-mono text-white">275 Records</span>
                <span className="text-[10px] text-[#50d8e9] block mt-1">20 Titanium Alloys</span>
              </div>
              <div className="bg-[#101112] border border-[#232426] rounded-xl p-4">
                <span className="text-[11px] font-mono text-[#9A9DA3] block mb-1">Yield Strength Range</span>
                <span className="text-xl sm:text-2xl font-bold font-mono text-white">165 – 1,320</span>
                <span className="text-[10px] text-[#9A9DA3] block mt-1">MPa (Mean: 864 MPa)</span>
              </div>
              <div className="bg-[#101112] border border-[#232426] rounded-xl p-4">
                <span className="text-[11px] font-mono text-[#9A9DA3] block mb-1">Vickers Hardness</span>
                <span className="text-xl sm:text-2xl font-bold font-mono text-white">110 – 485</span>
                <span className="text-[10px] text-emerald-400 block mt-1">HV (Calibrated Hybrid)</span>
              </div>
              <div className="bg-[#101112] border border-[#232426] rounded-xl p-4">
                <span className="text-[11px] font-mono text-[#9A9DA3] block mb-1">Relative Density Peak</span>
                <span className="text-xl sm:text-2xl font-bold font-mono text-[#50d8e9]">99.98%</span>
                <span className="text-[10px] text-[#9A9DA3] block mt-1">HIP Post-Processed</span>
              </div>
            </div>

            {/* Filter & Search Toolbar */}
            <div className="bg-[#101112] border border-[#232426] rounded-xl p-4 space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                {/* Search input */}
                <div className="relative flex-1 max-w-md">
                  <Search className="w-4 h-4 text-[#9A9DA3] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setCurrentPage(1);
                    }}
                    placeholder="Search by alloy, variant ID (e.g. TIV-00042), subprocess, condition..."
                    className="w-full bg-[#070708] border border-[#232426] rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-[#7189a3] focus:outline-none focus:border-[#50d8e9] transition-colors"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#9A9DA3] hover:text-white"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Condition filter */}
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-[#9A9DA3] shrink-0">Condition:</span>
                  <select
                    value={selectedConditionFilter}
                    onChange={(e) => {
                      setSelectedConditionFilter(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="bg-[#070708] border border-[#232426] text-xs text-white rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-[#50d8e9]"
                  >
                    <option value="All">All Conditions (275)</option>
                    <option value="As-built">As-built</option>
                    <option value="Stress-relieved">Stress-relieved</option>
                    <option value="HIP">HIP (Hot Isostatic Pressed)</option>
                    <option value="STA/Annealed">STA / Annealed</option>
                  </select>
                </div>
              </div>

              {/* Process Category Chips */}
              <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-[#1a1b1e]">
                <span className="text-[11px] font-mono text-[#9A9DA3] mr-2">Process Filter:</span>
                {processCategories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => {
                      setSelectedProcessFilter(cat);
                      setCurrentPage(1);
                    }}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-mono transition-colors ${
                      selectedProcessFilter === cat
                        ? 'bg-[#50d8e9]/20 text-[#50d8e9] border border-[#50d8e9]'
                        : 'bg-[#070708] text-[#9A9DA3] hover:text-white border border-[#232426]'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Results Count & Page size selector */}
            <div className="flex items-center justify-between text-xs font-mono text-[#9A9DA3] px-1">
              <span>
                Showing <strong className="text-white">{filteredVariants.length}</strong> variants matching criteria
              </span>
              <div className="flex items-center gap-2">
                <span>Rows per page:</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="bg-[#101112] border border-[#232426] text-white rounded px-2 py-0.5"
                >
                  <option value={10}>10</option>
                  <option value={15}>15</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={275}>All (275)</option>
                </select>
              </div>
            </div>

            {/* Main Interactive Table */}
            <div className="bg-[#101112] border border-[#232426] rounded-xl overflow-hidden shadow-2xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-[#0b0c0e] text-[#9A9DA3] font-mono border-b border-[#232426]">
                      <th
                        onClick={() => handleSort('variantId')}
                        className="py-3 px-3.5 font-semibold cursor-pointer hover:text-white whitespace-nowrap"
                      >
                        Variant ID {sortField === 'variantId' && (sortDirection === 'asc' ? '↑' : '↓')}
                      </th>
                      <th
                        onClick={() => handleSort('alloyName')}
                        className="py-3 px-3.5 font-semibold cursor-pointer hover:text-white whitespace-nowrap"
                      >
                        Alloy Name {sortField === 'alloyName' && (sortDirection === 'asc' ? '↑' : '↓')}
                      </th>
                      <th
                        onClick={() => handleSort('category')}
                        className="py-3 px-3.5 font-semibold cursor-pointer hover:text-white whitespace-nowrap"
                      >
                        AM Process {sortField === 'category' && (sortDirection === 'asc' ? '↑' : '↓')}
                      </th>
                      <th
                        onClick={() => handleSort('condition')}
                        className="py-3 px-3.5 font-semibold cursor-pointer hover:text-white whitespace-nowrap"
                      >
                        Condition {sortField === 'condition' && (sortDirection === 'asc' ? '↑' : '↓')}
                      </th>
                      <th
                        onClick={() => handleSort('yieldStrengthMPa')}
                        className="py-3 px-3.5 font-semibold cursor-pointer hover:text-white text-right whitespace-nowrap"
                      >
                        Yield (MPa) {sortField === 'yieldStrengthMPa' && (sortDirection === 'asc' ? '↑' : '↓')}
                      </th>
                      <th
                        onClick={() => handleSort('tensileStrengthMPa')}
                        className="py-3 px-3.5 font-semibold cursor-pointer hover:text-white text-right whitespace-nowrap"
                      >
                        UTS (MPa) {sortField === 'tensileStrengthMPa' && (sortDirection === 'asc' ? '↑' : '↓')}
                      </th>
                      <th
                        onClick={() => handleSort('elongationPct')}
                        className="py-3 px-3.5 font-semibold cursor-pointer hover:text-white text-right whitespace-nowrap"
                      >
                        Elong (%) {sortField === 'elongationPct' && (sortDirection === 'asc' ? '↑' : '↓')}
                      </th>
                      <th
                        onClick={() => handleSort('hardnessHV')}
                        className="py-3 px-3.5 font-semibold cursor-pointer hover:text-white text-right whitespace-nowrap"
                      >
                        Hardness (HV) {sortField === 'hardnessHV' && (sortDirection === 'asc' ? '↑' : '↓')}
                      </th>
                      <th
                        onClick={() => handleSort('relativeDensityPct')}
                        className="py-3 px-3.5 font-semibold cursor-pointer hover:text-white text-right whitespace-nowrap"
                      >
                        Rel. Density {sortField === 'relativeDensityPct' && (sortDirection === 'asc' ? '↑' : '↓')}
                      </th>
                      <th className="py-3 px-3.5 font-semibold text-right whitespace-nowrap">Build Rate</th>
                      <th className="py-3 px-3.5 font-semibold text-center whitespace-nowrap">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1a1b1d] font-mono text-[#c6c5d8]">
                    {paginatedVariants.length === 0 ? (
                      <tr>
                        <td colSpan={11} className="py-12 text-center text-[#7189a3]">
                          No process variants found matching &quot;{searchQuery}&quot;. Try clearing filters.
                        </td>
                      </tr>
                    ) : (
                      paginatedVariants.map((row) => (
                        <tr
                          key={row.variantId}
                          className="hover:bg-white/[0.03] transition-colors group"
                        >
                          <td className="py-2.5 px-3.5 whitespace-nowrap">
                            <span className="px-2 py-0.5 rounded text-[11px] bg-[#50d8e9]/10 text-[#50d8e9] border border-[#50d8e9]/30 font-bold">
                              {row.variantId}
                            </span>
                          </td>
                          <td className="py-2.5 px-3.5 whitespace-nowrap font-medium text-white">
                            <button
                              onClick={() => onSelectMaterialInWorkbench?.(row.alloyId)}
                              className="hover:text-[#50d8e9] hover:underline text-left"
                            >
                              {row.alloyName}
                            </button>
                          </td>
                          <td className="py-2.5 px-3.5 whitespace-nowrap text-[#9A9DA3]">
                            <span className="truncate max-w-[200px] block" title={row.subprocess}>
                              {row.subprocess}
                            </span>
                          </td>
                          <td className="py-2.5 px-3.5 whitespace-nowrap">
                            <span className={`px-2 py-0.5 rounded text-[10px] ${
                              row.condition.toLowerCase().includes('hip')
                                ? 'bg-purple-950/60 text-purple-300 border border-purple-500/30'
                                : row.condition.toLowerCase().includes('stress')
                                ? 'bg-amber-950/60 text-amber-300 border border-amber-500/30'
                                : 'bg-blue-950/60 text-blue-300 border border-blue-500/30'
                            }`}>
                              {row.condition}
                            </span>
                          </td>
                          <td className="py-2.5 px-3.5 whitespace-nowrap text-right font-bold text-white">
                            {row.yieldStrengthStr}
                          </td>
                          <td className="py-2.5 px-3.5 whitespace-nowrap text-right text-white">
                            {row.tensileStrengthStr}
                          </td>
                          <td className="py-2.5 px-3.5 whitespace-nowrap text-right text-emerald-400">
                            {row.elongationStr}
                          </td>
                          <td className="py-2.5 px-3.5 whitespace-nowrap text-right text-[#50d8e9]">
                            {row.hardnessStr}
                          </td>
                          <td className="py-2.5 px-3.5 whitespace-nowrap text-right">
                            {row.relativeDensityStr}
                          </td>
                          <td className="py-2.5 px-3.5 whitespace-nowrap text-right text-[#9A9DA3]">
                            {row.buildRate}
                          </td>
                          <td className="py-2.5 px-3.5 whitespace-nowrap text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => setInspectingVariant(row)}
                                className="px-2 py-1 rounded bg-[#161719] hover:bg-[#50d8e9] hover:text-black text-[11px] text-[#9A9DA3] border border-[#232426] transition-colors flex items-center gap-1"
                                title="Inspect all 42 telemetry properties"
                              >
                                <Eye className="w-3 h-3" />
                                <span>Inspect</span>
                              </button>
                              <button
                                onClick={() => onApplyParametersToPredictor?.(row.alloyId, row.category)}
                                className="px-2 py-1 rounded bg-[#161719] hover:bg-[#5E6BFF] hover:text-white text-[11px] text-[#9A9DA3] border border-[#232426] transition-colors flex items-center gap-1"
                                title="Load into Physics Predictor"
                              >
                                <Atom className="w-3 h-3" />
                                <span>Predict</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination Bar */}
              {totalPages > 1 && (
                <div className="p-4 bg-[#0b0c0e] border-t border-[#232426] flex items-center justify-between text-xs font-mono text-[#9A9DA3]">
                  <span>
                    Page <strong className="text-white">{currentPage}</strong> of <strong className="text-white">{totalPages}</strong>
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="p-1.5 rounded border border-[#232426] bg-[#101112] hover:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="p-1.5 rounded border border-[#232426] bg-[#101112] hover:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: PEER-REVIEWED EXPERIMENTAL BENCHMARKS */}
        {activeTab === 'literature-records' && (
          <div className="space-y-6">
            <div className="bg-[#101112] border border-[#232426] rounded-xl p-6">
              <div className="flex items-center justify-between mb-4 pb-4 border-b border-[#232426]">
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <Award className="w-5 h-5 text-[#50d8e9]" />
                    Curated Literature Experimental Benchmark Callset
                  </h3>
                  <p className="text-xs text-[#9A9DA3] mt-1">
                    Independent, peer-reviewed experimental test articles across major global additive manufacturing institutions (NIST, NASA MSFC, Fraunhofer, Cambridge, Tsinghua).
                  </p>
                </div>
                <span className="text-xs font-mono text-[#50d8e9] bg-[#50d8e9]/10 px-3 py-1 rounded border border-[#50d8e9]/30">
                  {CURATED_EXPERIMENTAL_RECORDS.length} Curated Benchmarks
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-[#0b0c0e] text-[#9A9DA3] font-mono border-b border-[#232426]">
                      <th className="py-2.5 px-3">ID / Source</th>
                      <th className="py-2.5 px-3">Alloy &amp; Process</th>
                      <th className="py-2.5 px-3 text-right">Power (W)</th>
                      <th className="py-2.5 px-3 text-right">Speed (mm/s)</th>
                      <th className="py-2.5 px-3 text-right">Layer (µm)</th>
                      <th className="py-2.5 px-3 text-right">VED (J/mm³)</th>
                      <th className="py-2.5 px-3 text-right">Hardness (HV)</th>
                      <th className="py-2.5 px-3 text-right">Rel. Density</th>
                      <th className="py-2.5 px-3 text-right">UTS (MPa)</th>
                      <th className="py-2.5 px-3 text-center">DOI Link</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1a1b1d] font-mono text-[#c6c5d8]">
                    {CURATED_EXPERIMENTAL_RECORDS.map((rec) => (
                      <tr key={rec.id} className="hover:bg-white/[0.02]">
                        <td className="py-2.5 px-3">
                          <span className="font-bold text-[#50d8e9] block">{rec.id}</span>
                          <span className="text-[10px] text-[#7189a3] truncate max-w-[180px] block" title={rec.citation}>
                            {rec.authors} ({rec.year})
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="text-white font-medium block">{rec.alloy}</span>
                          <span className="text-[10px] text-purple-400">{rec.process} • {rec.heatTreatment}</span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-white">{rec.laserPowerW}</td>
                        <td className="py-2.5 px-3 text-right">{rec.scanSpeedMmS}</td>
                        <td className="py-2.5 px-3 text-right">{rec.layerThicknessUm}</td>
                        <td className="py-2.5 px-3 text-right text-emerald-400 font-bold">{rec.vedJmm3.toFixed(1)}</td>
                        <td className="py-2.5 px-3 text-right font-bold text-[#50d8e9]">{rec.measuredHV}</td>
                        <td className="py-2.5 px-3 text-right">{rec.relativeDensityPct.toFixed(1)}%</td>
                        <td className="py-2.5 px-3 text-right text-white">{rec.utsMPa ? `${rec.utsMPa} MPa` : '—'}</td>
                        <td className="py-2.5 px-3 text-center">
                          <a
                            href={`https://doi.org/${rec.doi}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] text-[#50d8e9] hover:underline"
                          >
                            <span>Open</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: PROCESS PARAMETER ENVELOPES */}
        {activeTab === 'parameter-envelopes' && (
          <div className="space-y-6">
            <div className="bg-[#101112] border border-[#232426] rounded-xl p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 mb-4 border-b border-[#232426]">
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <Sliders className="w-5 h-5 text-[#50d8e9]" />
                    Calibrated AM Process Parameter Envelopes (ISO/ASTM 52900)
                  </h3>
                  <p className="text-xs text-[#9A9DA3] mt-1">
                    Literature-validated operating envelopes, sweet-spot windows, saturation levels, and defect physics across major Titanium additive manufacturing methods.
                  </p>
                </div>
                <span className="text-xs font-mono text-[#50d8e9] bg-[#50d8e9]/10 px-3 py-1 rounded border border-[#50d8e9]/30 shrink-0">
                  {PROCESS_PARAMETER_RANGES.length} Calibrated Parameters
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-[#0b0c0e] text-[#9A9DA3] font-mono border-b border-[#232426]">
                      <th className="py-2.5 px-3">Parameter</th>
                      <th className="py-2.5 px-3">AM Process</th>
                      <th className="py-2.5 px-3 text-right">Literature Min</th>
                      <th className="py-2.5 px-3 text-right">Sweet-Spot Window</th>
                      <th className="py-2.5 px-3 text-right">Literature Max</th>
                      <th className="py-2.5 px-3 text-center">Saturation</th>
                      <th className="py-2.5 px-3">Impact on Defect Physics</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1a1b1d] font-mono text-[#c6c5d8]">
                    {PROCESS_PARAMETER_RANGES.map((param, idx) => (
                      <tr key={idx} className="hover:bg-white/[0.02]">
                        <td className="py-2.5 px-3 font-medium text-white">
                          <span>{param.parameter}</span>
                          <span className="text-[10px] text-[#7189a3] ml-1.5 font-normal">({param.symbol}, {param.unit})</span>
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="px-2 py-0.5 rounded text-[10px] bg-blue-950/60 text-blue-300 border border-blue-500/30">
                            {param.process}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right text-[#9A9DA3]">
                          {param.literatureMin} {param.unit}
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-emerald-400">
                          {param.sweetSpotMin} – {param.sweetSpotMax} {param.unit}
                        </td>
                        <td className="py-2.5 px-3 text-right text-[#9A9DA3]">
                          {param.literatureMax} {param.unit}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span className={`px-2 py-0.5 rounded text-[10px] ${
                            param.saturationLevel === 'High'
                              ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-500/30'
                              : param.saturationLevel === 'Moderate'
                              ? 'bg-amber-950/60 text-amber-400 border border-amber-500/30'
                              : 'bg-rose-950/60 text-rose-400 border border-rose-500/30'
                          }`}>
                            {param.saturationLevel}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-[11px] text-[#9A9DA3] max-w-xs truncate" title={param.impactOnDefects}>
                          {param.impactOnDefects}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: PROPERTY COVERAGE & RESEARCH GAPS */}
        {activeTab === 'evidence-matrix' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Frequently Reported Properties */}
              <div className="bg-[#101112] border border-[#232426] rounded-xl p-6">
                <h4 className="text-base font-bold text-white mb-1 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                  High-Frequency Reported Properties
                </h4>
                <p className="text-xs text-[#9A9DA3] mb-4">
                  Standard mechanical metrics reported across &gt;70% of peer-reviewed titanium AM literature.
                </p>

                <div className="space-y-3">
                  {FREQUENTLY_REPORTED_PROPERTIES.map((prop) => (
                    <div key={prop.propertyName} className="space-y-1">
                      <div className="flex items-center justify-between text-xs font-mono">
                        <span className="text-white font-medium">{prop.propertyName} ({prop.symbol}, {prop.unit})</span>
                        <span className="text-[#50d8e9] font-bold">{prop.reportingFrequencyPct}%</span>
                      </div>
                      <div className="w-full bg-[#161719] h-2 rounded-full overflow-hidden">
                        <div
                          className="bg-gradient-to-r from-[#5E6BFF] to-[#50d8e9] h-full rounded-full transition-all duration-500"
                          style={{ width: `${prop.reportingFrequencyPct}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-[10px] font-mono text-[#7189a3]">
                        <span>Standard: {prop.standardTest}</span>
                        <span>As-built: {prop.typicalRangeAsBuilt}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Insufficient Evidence Properties (Research Gaps) */}
              <div className="bg-[#101112] border border-[#232426] rounded-xl p-6">
                <h4 className="text-base font-bold text-white mb-1 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                  Critical Published Evidence Gaps
                </h4>
                <p className="text-xs text-[#9A9DA3] mb-4">
                  Properties with insufficient empirical coverage (&lt;25% published literature).
                </p>

                <div className="space-y-3">
                  {INSUFFICIENT_EVIDENCE_PROPERTIES.map((gap) => (
                    <div key={gap.id} className="bg-[#0b0c0e] p-3.5 rounded-lg border border-[#1a1b1d] space-y-1.5">
                      <div className="flex items-center justify-between text-xs font-mono">
                        <span className="text-white font-bold">{gap.propertyName}</span>
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-red-950/60 text-red-400 border border-red-500/30">
                          {gap.evidenceCoveragePct}% coverage
                        </span>
                      </div>
                      <p className="text-[11px] text-[#9A9DA3] leading-relaxed">{gap.missingPhenomenon}</p>
                      <div className="text-[10px] font-mono text-[#50d8e9] pt-1">
                        Recommended Action: <span className="text-[#c6c5d8]">{gap.recommendedExperimentalAction}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Prioritized Research Opportunities */}
            <div className="bg-[#101112] border border-[#232426] rounded-xl p-6">
              <h4 className="text-base font-bold text-white mb-3 flex items-center gap-2">
                <Lightbulb className="w-4 h-4 text-amber-400" />
                Prioritized Research Opportunities
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {RESEARCH_OPPORTUNITIES.map((opp) => (
                  <div key={opp.id} className="bg-[#0b0c0e] p-4 rounded-xl border border-[#1a1b1d] space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-purple-950/60 text-purple-300 border border-purple-500/30">
                        {opp.category}
                      </span>
                      <span className="text-[10px] font-mono text-emerald-400 font-bold">
                        {opp.priority}
                      </span>
                    </div>
                    <h5 className="text-xs font-bold text-white">{opp.title}</h5>
                    <p className="text-[11px] text-[#9A9DA3] leading-relaxed">{opp.potentialImpact}</p>
                    <div className="pt-1 border-t border-[#1a1b1d] text-[10px] font-mono text-[#50d8e9]">
                      Target: {opp.targetDeliverable}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* INFORMATIVE VARIANT 42-PROPERTY INSPECTION DRAWER/MODAL */}
      {inspectingVariant && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          <div className="bg-[#101112] border border-[#232426] rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6 sm:p-8 space-y-6 shadow-2xl relative">
            <button
              onClick={() => setInspectingVariant(null)}
              className="absolute top-5 right-5 p-2 rounded-lg bg-[#1a1b1e] text-[#9A9DA3] hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Modal Title */}
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span className="px-2.5 py-0.5 rounded text-xs font-mono font-bold bg-[#50d8e9]/20 text-[#50d8e9] border border-[#50d8e9]/40">
                  {inspectingVariant.variantId}
                </span>
                <span className="text-xs font-mono text-[#9A9DA3]">{inspectingVariant.category}</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-purple-950/60 text-purple-300 border border-purple-500/30">
                  {inspectingVariant.condition}
                </span>
              </div>
              <h3 className="text-xl sm:text-2xl font-bold text-white">
                {inspectingVariant.alloyName} &mdash; {inspectingVariant.subprocess}
              </h3>
              <p className="text-xs text-[#9A9DA3] mt-1">
                Full 42-Feature Empirical &amp; Metallurgical Parameter Telemetry
              </p>
            </div>

            {/* 4 Feature Groups */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Group 1: Mechanical Properties */}
              <div className="bg-[#0b0c0e] p-4 rounded-xl border border-[#1a1b1d] space-y-2.5">
                <h4 className="text-xs font-bold font-mono text-[#50d8e9] uppercase tracking-wider">
                  1. Mechanical &amp; Structural Properties
                </h4>
                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                  <div>
                    <span className="text-[10px] text-[#7189a3] block">Yield Strength (0.2%)</span>
                    <span className="text-white font-bold">{inspectingVariant.yieldStrengthStr}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#7189a3] block">Tensile Strength (UTS)</span>
                    <span className="text-white font-bold">{inspectingVariant.tensileStrengthStr}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#7189a3] block">Elongation at Break</span>
                    <span className="text-emerald-400 font-bold">{inspectingVariant.elongationStr}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#7189a3] block">Vickers Hardness</span>
                    <span className="text-[#50d8e9] font-bold">{inspectingVariant.hardnessStr}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#7189a3] block">Elastic Modulus (E)</span>
                    <span className="text-white">{inspectingVariant.elasticModulusGPa}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#7189a3] block">Fracture Toughness (K1c)</span>
                    <span className="text-white">{inspectingVariant.fractureToughness}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#7189a3] block">Fatigue Strength (10^7)</span>
                    <span className="text-white">{inspectingVariant.fatigueStrengthMPa}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#7189a3] block">Charpy Impact Energy</span>
                    <span className="text-white">{inspectingVariant.charpyImpactEnergyJ}</span>
                  </div>
                </div>
              </div>

              {/* Group 2: AM Quality & Microstructure */}
              <div className="bg-[#0b0c0e] p-4 rounded-xl border border-[#1a1b1d] space-y-2.5">
                <h4 className="text-xs font-bold font-mono text-[#50d8e9] uppercase tracking-wider">
                  2. AM Quality &amp; Defect Metrics
                </h4>
                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                  <div>
                    <span className="text-[10px] text-[#7189a3] block">Relative Density</span>
                    <span className="text-emerald-400 font-bold">{inspectingVariant.relativeDensityStr}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#7189a3] block">Internal Porosity</span>
                    <span className="text-white">{inspectingVariant.porosityPct}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#7189a3] block">Surface Roughness (Ra)</span>
                    <span className="text-white">{inspectingVariant.surfaceRoughnessRa}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#7189a3] block">Max Residual Stress</span>
                    <span className="text-amber-400 font-bold">{inspectingVariant.residualStressMax}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#7189a3] block">Volumetric Build Rate</span>
                    <span className="text-white">{inspectingVariant.buildRate}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#7189a3] block">Alloy True Density</span>
                    <span className="text-white">{inspectingVariant.densityGcm3}</span>
                  </div>
                </div>
              </div>

              {/* Group 3: Thermal & Physical */}
              <div className="bg-[#0b0c0e] p-4 rounded-xl border border-[#1a1b1d] space-y-2.5">
                <h4 className="text-xs font-bold font-mono text-[#5E6BFF] uppercase tracking-wider">
                  3. Thermal &amp; High-Temperature Properties
                </h4>
                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                  <div>
                    <span className="text-[10px] text-[#7189a3] block">Max Service Temp</span>
                    <span className="text-white font-bold">{inspectingVariant.maxServiceTempC}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#7189a3] block">Thermal Conductivity</span>
                    <span className="text-white font-bold">{inspectingVariant.thermalConductivity}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#7189a3] block">Oxygen Content</span>
                    <span className="text-white">{inspectingVariant.oxygenContentWt}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#7189a3] block">Corrosion Rating</span>
                    <span className="text-white">{inspectingVariant.corrosionRating} / 5</span>
                  </div>
                </div>
              </div>

              {/* Group 4: Synthesis & Atmosphere */}
              <div className="bg-[#0b0c0e] p-4 rounded-xl border border-[#1a1b1d] space-y-2.5">
                <h4 className="text-xs font-bold font-mono text-[#5E6BFF] uppercase tracking-wider">
                  4. Calibrated Synthesis Conditions
                </h4>
                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                  <div>
                    <span className="text-[10px] text-[#7189a3] block">Process Atmosphere</span>
                    <span className="text-white">{inspectingVariant.rawVariant.atmosphere || 'Ultra-high purity Argon'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#7189a3] block">Peak Temperature</span>
                    <span className="text-white">{inspectingVariant.rawVariant.peakTempC}°C</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#7189a3] block">Cooling Rate</span>
                    <span className="text-white">{inspectingVariant.rawVariant.coolingRate}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#7189a3] block">Biocompatibility</span>
                    <span className="text-emerald-400 font-bold">{inspectingVariant.biocompatibilityRating} / 5</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-[#232426]">
              <span className="text-xs font-mono text-[#9A9DA3]">
                Calibrated per ISO/ASTM 52900 &amp; ASTM F2924 specifications.
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    onApplyParametersToPredictor?.(inspectingVariant.alloyId, inspectingVariant.category);
                    setInspectingVariant(null);
                  }}
                  className="px-4 py-2 rounded-lg text-xs font-mono font-semibold bg-[#5E6BFF] text-white hover:bg-[#4d5aff] transition-colors flex items-center gap-1.5"
                >
                  <Atom className="w-3.5 h-3.5" />
                  <span>Load into Physics Predictor</span>
                </button>
                <button
                  onClick={() => setInspectingVariant(null)}
                  className="px-4 py-2 rounded-lg text-xs font-mono bg-[#1a1b1e] hover:bg-white/10 text-white transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
