/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Atom,
  Menu,
  X,
  ChevronDown,
  Database,
  Sliders,
  Flame,
  GitFork,
  Activity,
  FileCheck2,
  BookOpen,
  Box,
  TrendingUp,
  ShieldAlert,
  DollarSign
} from 'lucide-react';
import { MatSciWorkbench } from './components/MatSciWorkbench';
import { MatSciCommandSections } from './components/MatSciCommandSections';
import { MaterialCompareModal } from './components/MaterialCompareModal';
import { ActiveTab, MatSciPredictor } from './components/MatSciPredictor';
import type { CopilotNavigationTarget, CopilotRouteId } from './components/MatSciCopilotDrawer';
import { SupplementaryDatasetsSection } from './components/SupplementaryDatasetsSection';
import { TitaniumWorkstationView } from './components/titanium/TitaniumWorkstationView';

const COPILOT_SECTION_TARGETS: Record<CopilotRouteId, { sectionId: string; tab?: ActiveTab }> = {
  predictions: { sectionId: 'physics-predictor', tab: 'predictions' },
  'process-map': { sectionId: 'physics-predictor', tab: 'process-map' },
  defects: { sectionId: 'physics-predictor', tab: 'defect-map' },
  economics: { sectionId: 'physics-predictor', tab: 'economics' },
  'digital-twin': { sectionId: 'physics-predictor', tab: 'digital-twin' },
  qualification: { sectionId: 'physics-predictor', tab: 'qualification' },
  literature: { sectionId: 'physics-predictor', tab: 'literature-intel' },
  workbench: { sectionId: 'workbench-anchor' },
  datasets: { sectionId: 'supplementary-datasets' },
  telemetry: { sectionId: 'telemetry-section' },
  'heat-treatment': { sectionId: 'architecture-section' },
  'phase-kinetics': { sectionId: 'insights-section' },
  'titanium-workstation': { sectionId: 'titanium-workstation' }
};

export default function App() {
  const [selectedMaterialId, setSelectedMaterialId] = useState<string | null>(null);
  const [activePredictorTab, setActivePredictorTab] = useState<ActiveTab>('predictions');
  const [compareIds, setCompareIds] = useState<string[]>(['ti-6al-4v', 'ti-6al-4v-eli']);
  const [isCompareModalOpen, setIsCompareModalOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSectionsDropdownOpen, setIsSectionsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsSectionsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleToggleCompare = (id: string) => {
    setCompareIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleClearCompare = () => {
    setCompareIds([]);
  };

  const handleSelectMaterialAndScroll = (id: string) => {
    setSelectedMaterialId(id);
    const workbenchEl = document.getElementById('workbench-anchor');
    if (workbenchEl) {
      workbenchEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleScrollToSection = (sectionId: string) => {
    const el = document.getElementById(sectionId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleCopilotNavigate = useCallback((target: CopilotNavigationTarget) => {
    const destination = COPILOT_SECTION_TARGETS[target.id];
    if (destination.tab) setActivePredictorTab(destination.tab);
    window.requestAnimationFrame(() => {
      document.getElementById(destination.sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, []);

  return (
    <div className="min-h-screen w-full max-w-full overflow-x-hidden bg-[#070708] text-[#e5e2e3] antialiased selection:bg-[#5E6BFF] selection:text-white">
      {/* Top 3-Zone Navigation Bar (Cinematic Precision) */}
      <header className="sticky top-0 z-40 w-full max-w-full h-16 bg-[#070708]/90 backdrop-blur-md border-b border-[#232426]">
        <div className="max-w-[1640px] w-full mx-auto h-full px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-3 xl:gap-6 min-w-0">
          {/* Zone 1: Brand Wordmark */}
          <button
            onClick={() => {
              setSelectedMaterialId(null);
              handleScrollToSection('workbench-anchor');
            }}
            className="flex items-center gap-2.5 text-left group shrink-0 whitespace-nowrap"
          >
            <Atom className="w-5 h-5 text-[#50d8e9] group-hover:rotate-45 transition-transform duration-300" />
            <span className="font-h3 text-base sm:text-lg font-bold tracking-tight text-white">
              MatSci Navigator
            </span>
          </button>

          {/* Zone 2: Primary Navigation Links (Optimized Responsive Desktop Bar) */}
          <nav className="hidden lg:flex items-center gap-1 xl:gap-2.5 text-xs xl:text-sm text-[#9A9DA3] min-w-0">
            <button
              onClick={() => {
                setActivePredictorTab('predictions');
                handleScrollToSection('physics-predictor');
              }}
              className="px-2 xl:px-2.5 py-1.5 rounded-lg hover:text-[#50d8e9] hover:bg-white/5 transition-colors whitespace-nowrap shrink-0 font-medium"
            >
              Physics Predictor
            </button>

            <button
              onClick={() => {
                setActivePredictorTab('defect-map');
                handleScrollToSection('physics-predictor');
              }}
              className="px-2 xl:px-2.5 py-1.5 rounded-lg hover:text-[#50d8e9] hover:bg-white/5 transition-colors whitespace-nowrap shrink-0 font-medium flex items-center gap-1.5"
            >
              <span>Defect Window</span>
              <span className="hidden 2xl:inline-block text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 font-mono">Enthalpy</span>
            </button>

            <button
              onClick={() => {
                setActivePredictorTab('economics');
                handleScrollToSection('physics-predictor');
              }}
              className="px-2 xl:px-2.5 py-1.5 rounded-lg hover:text-[#50d8e9] hover:bg-white/5 transition-colors whitespace-nowrap shrink-0 font-medium flex items-center gap-1.5"
            >
              <span>Economics</span>
              <span className="hidden 2xl:inline-block text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-mono">ROI</span>
            </button>

            <button
              onClick={() => {
                setActivePredictorTab('digital-twin');
                handleScrollToSection('physics-predictor');
              }}
              className="px-2 xl:px-2.5 py-1.5 rounded-lg hover:text-[#50d8e9] hover:bg-white/5 transition-colors whitespace-nowrap shrink-0 font-medium flex items-center gap-1.5"
            >
              <span>3D Twin</span>
              <span className="hidden 2xl:inline-block text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/20 text-[#50d8e9] font-mono">Tensor</span>
            </button>

            <button
              onClick={() => {
                setActivePredictorTab('qualification');
                handleScrollToSection('physics-predictor');
              }}
              className="hidden xl:flex px-2 xl:px-2.5 py-1.5 rounded-lg hover:text-[#50d8e9] hover:bg-white/5 transition-colors whitespace-nowrap shrink-0 font-medium items-center gap-1.5"
            >
              <span>ASTM Audit</span>
              <span className="hidden 2xl:inline-block text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 font-mono">Audit</span>
            </button>

            <button
              onClick={() => {
                setActivePredictorTab('literature-intel');
                handleScrollToSection('physics-predictor');
              }}
              className="hidden 2xl:flex px-2 xl:px-2.5 py-1.5 rounded-lg hover:text-[#50d8e9] hover:bg-white/5 transition-colors whitespace-nowrap shrink-0 font-medium items-center gap-1.5"
            >
              <span>Evidence &amp; Gaps</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#50d8e9]/20 text-[#50d8e9] font-mono">6</span>
            </button>

            <button
              onClick={() => handleScrollToSection('titanium-workstation')}
              className="px-2 xl:px-2.5 py-1.5 rounded-lg border border-[#00f7ff]/40 bg-[#00f7ff]/10 text-[#00f7ff] hover:bg-[#00f7ff]/20 transition-all whitespace-nowrap shrink-0 font-medium flex items-center gap-1.5 shadow-[0_0_12px_rgba(0,247,255,0.15)] cursor-pointer"
            >
              <Flame className="w-3.5 h-3.5 text-[#00f7ff]" />
              <span>Ti-6Al-4V Workstation</span>
            </button>

            {/* Interactive "Explore Sections ▾" Dropdown */}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setIsSectionsDropdownOpen(!isSectionsDropdownOpen)}
                className={`px-2.5 py-1.5 rounded-lg border transition-all text-xs xl:text-sm font-medium flex items-center gap-1.5 shrink-0 ${
                  isSectionsDropdownOpen
                    ? 'border-[#50d8e9]/50 text-[#50d8e9] bg-[#50d8e9]/10'
                    : 'border-[#232426] text-[#c6c5d8] hover:text-white hover:bg-white/5 hover:border-[#3a3b40]'
                }`}
              >
                <span>Explore Sections</span>
                <ChevronDown
                  className={`w-3.5 h-3.5 transition-transform duration-200 ${
                    isSectionsDropdownOpen ? 'rotate-180 text-[#50d8e9]' : 'text-[#8f8fa1]'
                  }`}
                />
              </button>

              {isSectionsDropdownOpen && (
                <div className="absolute right-0 mt-2 w-72 rounded-xl bg-[#0b0c0e]/98 border border-[#232426] p-1.5 shadow-2xl backdrop-blur-2xl z-50 animate-in fade-in zoom-in-95 duration-150">
                  <div className="px-3 py-2 text-[10px] font-mono uppercase tracking-wider text-[#686b73] border-b border-[#1b1c1e]">
                    Platform Sections &amp; Data
                  </div>

                  <div className="py-1 space-y-0.5">
                    <button
                      onClick={() => {
                        handleScrollToSection('titanium-workstation');
                        setIsSectionsDropdownOpen(false);
                      }}
                      className="w-full text-left px-3 py-2 rounded-lg text-xs hover:bg-[#00f7ff]/10 hover:text-[#00f7ff] text-[#c6c5d8] transition-colors flex items-center justify-between group"
                    >
                      <div className="flex items-center gap-2">
                        <Flame className="w-3.5 h-3.5 text-[#00f7ff]" />
                        <span className="font-medium">Ti-6Al-4V Physics Workstation</span>
                      </div>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#00f7ff]/20 text-[#00f7ff]">L-PBF/EBM</span>
                    </button>
                    <button
                      onClick={() => {
                        handleScrollToSection('supplementary-datasets');
                        setIsSectionsDropdownOpen(false);
                      }}
                      className="w-full text-left px-3 py-2 rounded-lg text-xs hover:bg-[#50d8e9]/10 hover:text-[#50d8e9] text-[#c6c5d8] transition-colors flex items-center justify-between group"
                    >
                      <div className="flex items-center gap-2">
                        <Database className="w-3.5 h-3.5 text-[#50d8e9]" />
                        <span className="font-medium">Supplementary Datasets</span>
                      </div>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#50d8e9]/15 text-[#50d8e9]">275</span>
                    </button>

                    <button
                      onClick={() => {
                        handleScrollToSection('workbench-anchor');
                        setIsSectionsDropdownOpen(false);
                      }}
                      className="w-full text-left px-3 py-2 rounded-lg text-xs hover:bg-white/5 hover:text-white text-[#c6c5d8] transition-colors flex items-center gap-2"
                    >
                      <Sliders className="w-3.5 h-3.5 text-[#5E6BFF]" />
                      <span className="font-medium">Synthesis Explorer (20 Alloys)</span>
                    </button>

                    <button
                      onClick={() => {
                        handleScrollToSection('telemetry-section');
                        setIsSectionsDropdownOpen(false);
                      }}
                      className="w-full text-left px-3 py-2 rounded-lg text-xs hover:bg-white/5 hover:text-white text-[#c6c5d8] transition-colors flex items-center gap-2"
                    >
                      <Flame className="w-3.5 h-3.5 text-amber-400" />
                      <span className="font-medium">Thermal Telemetry &amp; Cooling</span>
                    </button>

                    <button
                      onClick={() => {
                        handleScrollToSection('architecture-section');
                        setIsSectionsDropdownOpen(false);
                      }}
                      className="w-full text-left px-3 py-2 rounded-lg text-xs hover:bg-white/5 hover:text-white text-[#c6c5d8] transition-colors flex items-center gap-2"
                    >
                      <GitFork className="w-3.5 h-3.5 text-cyan-400" />
                      <span className="font-medium">Route Architecture &amp; HIP</span>
                    </button>

                    <button
                      onClick={() => {
                        handleScrollToSection('insights-section');
                        setIsSectionsDropdownOpen(false);
                      }}
                      className="w-full text-left px-3 py-2 rounded-lg text-xs hover:bg-white/5 hover:text-white text-[#c6c5d8] transition-colors flex items-center gap-2"
                    >
                      <Activity className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="font-medium">Phase Kinetics &amp; CCT</span>
                    </button>

                    {/* Responsive fallback for ASTM Audit and Evidence & Gaps when hidden on smaller desktop widths */}
                    <div className="border-t border-[#1b1c1e] my-1 pt-1 xl:hidden">
                      <button
                        onClick={() => {
                          setActivePredictorTab('qualification');
                          handleScrollToSection('physics-predictor');
                          setIsSectionsDropdownOpen(false);
                        }}
                        className="w-full text-left px-3 py-2 rounded-lg text-xs hover:bg-amber-500/10 hover:text-amber-300 text-[#c6c5d8] transition-colors flex items-center justify-between"
                      >
                        <div className="flex items-center gap-2">
                          <FileCheck2 className="w-3.5 h-3.5 text-amber-400" />
                          <span className="font-medium">ASTM Qualification Audit</span>
                        </div>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400">PDF</span>
                      </button>
                    </div>

                    <div className="2xl:hidden">
                      <button
                        onClick={() => {
                          setActivePredictorTab('literature-intel');
                          handleScrollToSection('physics-predictor');
                          setIsSectionsDropdownOpen(false);
                        }}
                        className="w-full text-left px-3 py-2 rounded-lg text-xs hover:bg-[#50d8e9]/10 hover:text-[#50d8e9] text-[#c6c5d8] transition-colors flex items-center justify-between"
                      >
                        <div className="flex items-center gap-2">
                          <BookOpen className="w-3.5 h-3.5 text-[#50d8e9]" />
                          <span className="font-medium">Evidence &amp; Research Gaps</span>
                        </div>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#50d8e9]/20 text-[#50d8e9]">6 Gaps</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </nav>

          {/* Zone 3: Primary Action & Mobile Hamburger */}
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              onClick={() => setIsCompareModalOpen(true)}
              className="px-3 sm:px-4 py-1.5 sm:py-2 text-[11px] sm:text-xs font-mono-data font-medium bg-[#5E6BFF] text-white rounded-md hover:bg-[#4e5bef] transition-colors whitespace-nowrap shrink-0 shadow-[0_0_20px_rgba(94,107,255,0.28)]"
            >
              Compare Matrix ({compareIds.length})
            </button>

            {/* Mobile/Tablet Hamburger Button */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="lg:hidden p-1.5 text-[#9A9DA3] hover:text-white rounded-lg hover:bg-white/5 transition-colors focus:outline-none"
              aria-label="Toggle navigation menu"
            >
              {isMobileMenuOpen ? <X className="w-5 h-5 text-white" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile/Tablet Dropdown Navigation Drawer */}
        {isMobileMenuOpen && (
          <div className="lg:hidden border-b border-[#232426] bg-[#070708]/98 backdrop-blur-xl px-4 py-3 space-y-2 shadow-2xl max-h-[85vh] overflow-y-auto">
            <div className="text-[10px] font-mono uppercase tracking-wider text-[#686b73] px-2 pt-1">
              Core Analytical Engines
            </div>
            <button
              onClick={() => {
                setActivePredictorTab('predictions');
                handleScrollToSection('physics-predictor');
                setIsMobileMenuOpen(false);
              }}
              className="w-full text-left py-2 px-3 rounded-lg text-sm text-[#50d8e9] hover:bg-[#50d8e9]/10 font-medium transition-colors flex items-center justify-between"
            >
              <span>Physics Predictor</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#50d8e9]/20 text-[#50d8e9] font-mono">v2.0</span>
            </button>
            <button
              onClick={() => {
                setActivePredictorTab('defect-map');
                handleScrollToSection('physics-predictor');
                setIsMobileMenuOpen(false);
              }}
              className="w-full text-left py-2 px-3 rounded-lg text-sm text-amber-300 hover:bg-amber-500/10 font-medium transition-colors flex items-center justify-between"
            >
              <span>Defect Process Window</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 font-mono">Enthalpy</span>
            </button>
            <button
              onClick={() => {
                setActivePredictorTab('economics');
                handleScrollToSection('physics-predictor');
                setIsMobileMenuOpen(false);
              }}
              className="w-full text-left py-2 px-3 rounded-lg text-sm text-emerald-300 hover:bg-emerald-500/10 font-medium transition-colors flex items-center justify-between"
            >
              <span>Build Economics &amp; ESG</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-mono">ROI</span>
            </button>
            <button
              onClick={() => {
                setActivePredictorTab('digital-twin');
                handleScrollToSection('physics-predictor');
                setIsMobileMenuOpen(false);
              }}
              className="w-full text-left py-2 px-3 rounded-lg text-sm text-cyan-300 hover:bg-cyan-500/10 font-medium transition-colors flex items-center justify-between"
            >
              <span>3D Digital Twin</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/20 text-[#50d8e9] font-mono">Tensor</span>
            </button>
            <button
              onClick={() => {
                setActivePredictorTab('qualification');
                handleScrollToSection('physics-predictor');
                setIsMobileMenuOpen(false);
              }}
              className="w-full text-left py-2 px-3 rounded-lg text-sm text-amber-300 hover:bg-amber-500/10 font-medium transition-colors flex items-center justify-between"
            >
              <span>ASTM Qualification</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 font-mono">Audit</span>
            </button>
            <button
              onClick={() => {
                setActivePredictorTab('literature-intel');
                handleScrollToSection('physics-predictor');
                setIsMobileMenuOpen(false);
              }}
              className="w-full text-left py-2 px-3 rounded-lg text-sm text-[#50d8e9] hover:bg-[#50d8e9]/10 font-medium transition-colors flex items-center justify-between border border-[#50d8e9]/30 bg-[#50d8e9]/10"
            >
              <span className="flex items-center gap-2">
                <span>Evidence &amp; Gaps</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#50d8e9]/30 text-[#50d8e9] font-mono font-bold">6 Insights</span>
              </span>
              <span className="text-[10px] text-[#50d8e9] font-mono">Matrix →</span>
            </button>

            <div className="text-[10px] font-mono uppercase tracking-wider text-[#686b73] px-2 pt-2 border-t border-[#1b1c1e]">
              Platform Sections &amp; Data
            </div>
            <button
              onClick={() => {
                handleScrollToSection('supplementary-datasets');
                setIsMobileMenuOpen(false);
              }}
              className="w-full text-left py-2 px-3 rounded-lg text-sm text-[#50d8e9] hover:bg-[#50d8e9]/10 font-medium transition-colors flex items-center justify-between"
            >
              <span>Supplementary Datasets</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#50d8e9]/20 text-[#50d8e9] font-mono">275 Records</span>
            </button>
            <button
              onClick={() => {
                handleScrollToSection('workbench-anchor');
                setIsMobileMenuOpen(false);
              }}
              className="w-full text-left py-2 px-3 rounded-lg text-sm text-[#9A9DA3] hover:text-white hover:bg-white/5 transition-colors"
            >
              Synthesis Explorer (20 Alloys)
            </button>
            <button
              onClick={() => {
                handleScrollToSection('telemetry-section');
                setIsMobileMenuOpen(false);
              }}
              className="w-full text-left py-2 px-3 rounded-lg text-sm text-[#9A9DA3] hover:text-white hover:bg-white/5 transition-colors"
            >
              Thermal Telemetry
            </button>
            <button
              onClick={() => {
                handleScrollToSection('architecture-section');
                setIsMobileMenuOpen(false);
              }}
              className="w-full text-left py-2 px-3 rounded-lg text-sm text-[#9A9DA3] hover:text-white hover:bg-white/5 transition-colors"
            >
              Route Architecture
            </button>
            <button
              onClick={() => {
                handleScrollToSection('insights-section');
                setIsMobileMenuOpen(false);
              }}
              className="w-full text-left py-2 px-3 rounded-lg text-sm text-[#9A9DA3] hover:text-white hover:bg-white/5 transition-colors"
            >
              Phase Kinetics
            </button>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main>
        {/* MatSci Physics & Microstructure Predictor Suite matching reference views */}
        <MatSciPredictor
          initialAlloyId={selectedMaterialId || 'ti-6al-4v'}
          onAlloyChange={(newId) => setSelectedMaterialId(newId)}
          activeTab={activePredictorTab}
          onTabChange={setActivePredictorTab}
          onCopilotNavigate={handleCopilotNavigate}
        />

        {/* Dedicated Titanium Additive Physics — Ti-6Al-4V L-PBF & EBM Workstation Section */}
        <section id="titanium-workstation" className="max-w-[1640px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <TitaniumWorkstationView
            onNavigateParentSection={handleScrollToSection}
          />
        </section>

        <MatSciWorkbench
          selectedMaterialId={selectedMaterialId}
          onSelectMaterial={setSelectedMaterialId}
          compareIds={compareIds}
          onToggleCompare={handleToggleCompare}
          onOpenCompareModal={() => setIsCompareModalOpen(true)}
          onNavigateArchitecture={() => handleScrollToSection('architecture-section')}
        />

        {/* Dedicated Supplementary Datasets & Empirical Telemetry Repository Section */}
        <SupplementaryDatasetsSection
          onSelectMaterialInWorkbench={handleSelectMaterialAndScroll}
          onApplyParametersToPredictor={(alloyId) => {
            setSelectedMaterialId(alloyId);
            setActivePredictorTab('predictions');
            handleScrollToSection('physics-predictor');
          }}
        />

        <MatSciCommandSections
          onSelectMaterialInWorkbench={handleSelectMaterialAndScroll}
          onOpenCompareModal={() => setIsCompareModalOpen(true)}
        />
      </main>

      {/* Footer */}
      <footer className="border-t border-[#232426] bg-[#070708] py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
          <div>
            <div className="flex items-center gap-2.5 mb-2">
              <Atom className="w-5 h-5 text-[#50d8e9]" />
              <span className="font-h3 text-base font-bold text-white">
                MatSci Navigator
              </span>
            </div>
            <p className="text-xs text-[#9A9DA3] max-w-md">
              Titanium Additive Manufacturing Routes, Creation Parameters &amp; Properties — Covering the 8 ISO/ASTM AM processes with calibrated metallurgical telemetry.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-6 text-xs font-mono-data text-[#9A9DA3]">
            <button
              onClick={() => handleSelectMaterialAndScroll('ti-6al-4v')}
              className="hover:text-[#50d8e9] transition-colors"
            >
              Ti-6Al-4V (Grade 5)
            </button>
            <button
              onClick={() => handleSelectMaterialAndScroll('ti-6al-4v-eli')}
              className="hover:text-[#50d8e9] transition-colors"
            >
              Ti-6Al-4V ELI (Grade 23)
            </button>
            <button
              onClick={() => handleSelectMaterialAndScroll('ti-grade-2')}
              className="hover:text-[#50d8e9] transition-colors"
            >
              Ti Grade 2 (CP)
            </button>
            <button
              onClick={() => handleSelectMaterialAndScroll('ti-6242')}
              className="hover:text-[#50d8e9] transition-colors"
            >
              Ti-6242 Creep-Resistant
            </button>
            <button
              onClick={() => handleSelectMaterialAndScroll('ti-5553')}
              className="hover:text-[#50d8e9] transition-colors"
            >
              Ti-5553 Near-Beta
            </button>
            <button
              onClick={() => handleSelectMaterialAndScroll('ti-48al-2cr-2nb')}
              className="hover:text-[#50d8e9] transition-colors"
            >
              Gamma TiAl (Intermetallic)
            </button>
            <button
              onClick={() => handleSelectMaterialAndScroll('cfrp')}
              className="hover:text-[#50d8e9] transition-colors"
            >
              CFRP
            </button>
          </div>
        </div>
      </footer>

      {/* Multi-Material Comparison Modal */}
      <MaterialCompareModal
        isOpen={isCompareModalOpen}
        onClose={() => setIsCompareModalOpen(false)}
        compareIds={compareIds}
        onToggleCompare={handleToggleCompare}
        onClearCompare={handleClearCompare}
        onSelectMaterial={handleSelectMaterialAndScroll}
      />
    </div>
  );
}
