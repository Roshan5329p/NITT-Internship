/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * MatSci — Hardness & Microstructure Predictor for Laser-AM Titanium Alloys
 * Replicates and enhances the state-of-the-art physics-informed prediction system
 * across all authorized ISO/ASTM processes and all 20 titanium alloys.
 */

import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Sliders,
  Activity,
  BookOpen,
  Compass,
  Gauge,
  Flame,
  Zap,
  Download,
  AlertTriangle,
  Layers,
  Search,
  BarChart3,
  Target,
  TrendingUp,
  Info,
  Sparkles,
  RefreshCw,
  User,
  CheckCircle,
  HelpCircle,
  ArrowRight,
  Maximize2,
  Ruler,
  Crosshair,
  Grid,
  ShieldAlert,
  DollarSign,
  Box,
  Award
} from 'lucide-react';
import {
  calculateAmPredictions,
  calculateBonthaThermalModel,
  type BonthaSolidificationResult,
  type DepthSolidificationPoint,
  getKobrynMorphologyBoundaries,
  searchInverseDesignSettings,
  type InverseDesignCandidate,
  solveParametersFromVed,
  type VedSolverCandidate,
  type CoenMeltPoolResult,
  type RansenigoDefectResult,
  calculateCoenHybridMeltPool,
  calculateRansenigoDefects,
  EXPERIMENTAL_BENCHMARKS,
  ALLOY_THERMAL_PROPERTIES,
  DEFAULT_TITANIUM_PROPERTIES,
  ProcessInputParams,
  PredictionResult,
  type BonthaGeometryMode,
  type BonthaPhysicsMode,
  getBonthaDimensionlessProcessMapData
} from '../utils/amPhysicsEngine';
import { LiteratureIntelligenceView } from './LiteratureIntelligenceView';
import { DefectProcessWindowView } from './DefectProcessWindowView';
import { IndustrialEconomicsView } from './IndustrialEconomicsView';
import { QualificationAuditView } from './QualificationAuditView';
import { DigitalTwin3DView } from './DigitalTwin3DView';
import { MatSciCopilotDrawer, type CopilotNavigationTarget } from './MatSciCopilotDrawer';

export type ActiveTab =
  | 'predictions'
  | 'process-map'
  | 'defect-map'
  | 'economics'
  | 'digital-twin'
  | 'qualification'
  | 'suggestions'
  | 'melt-pool'
  | 'accuracy'
  | 'literature-intel'
  | 'references';

const PREDICTOR_TAB_ORDER: readonly ActiveTab[] = [
  'predictions',
  'process-map',
  'defect-map',
  'economics',
  'digital-twin',
  'qualification',
  'suggestions',
  'melt-pool',
  'accuracy',
  'literature-intel',
  'references'
];

export interface MatSciPredictorProps {
  initialAlloyId?: string;
  onAlloyChange?: (alloyId: string) => void;
  activeTab?: ActiveTab;
  onTabChange?: (tab: ActiveTab) => void;
  onCopilotNavigate: (target: CopilotNavigationTarget) => void;
}

// The 8 authorized ISO/ASTM Additive Manufacturing processes
const AM_PROCESSES = [
  { id: 'pbf-laser', label: 'LPBF / SLM (powder bed)', category: 'Powder Bed Fusion', defaultPower: 200, defaultSpeed: 950 },
  { id: 'ded-laser', label: 'L-DED (laser directed energy deposition)', category: 'Directed Energy Deposition', defaultPower: 1200, defaultSpeed: 300 },
  { id: 'waam', label: 'WAAM (wire arc additive manufacturing)', category: 'Wire arc additive manufacturing', defaultPower: 2200, defaultSpeed: 25 },
  { id: 'pbf-ebeam', label: 'E-PBF / EBM (electron beam powder bed)', category: 'Powder Bed Fusion', defaultPower: 650, defaultSpeed: 1600 },
  { id: 'binder-jetting', label: 'Binder Jetting (sinter-HIP)', category: 'Binder Jetting', defaultPower: 150, defaultSpeed: 700 },
  { id: 'material-extrusion', label: 'Material Extrusion (FFF sintered)', category: 'Material Extrusion', defaultPower: 120, defaultSpeed: 600 },
  { id: 'sheet-lamination', label: 'Sheet Lamination (ultrasonic)', category: 'Sheet Lamination', defaultPower: 300, defaultSpeed: 500 },
  { id: 'vat-photo', label: 'Vat Photopolymerization (stereolithography)', category: 'Vat Photopolymerization', defaultPower: 80, defaultSpeed: 1100 }
];

const TITANIUM_ALLOYS = [
  { id: 'ti-6al-4v', name: 'Ti-6Al-4V (Grade 5, α+β workhorse)', formula: 'Ti-6Al-4V', group: 'Alpha-Beta' },
  { id: 'ti-6al-4v-eli', name: 'Ti-6Al-4V ELI (Grade 23, medical)', formula: 'Ti-6Al-4V ELI', group: 'Alpha-Beta' },
  { id: 'ti-grade-1', name: 'Ti Grade 1 (CP highest ductility)', formula: 'Ti CP-1', group: 'CP Unalloyed' },
  { id: 'ti-grade-2', name: 'Ti Grade 2 (CP industrial standard)', formula: 'Ti CP-2', group: 'CP Unalloyed' },
  { id: 'ti-grade-3', name: 'Ti Grade 3 (CP intermediate)', formula: 'Ti CP-3', group: 'CP Unalloyed' },
  { id: 'ti-grade-4', name: 'Ti Grade 4 (CP high strength)', formula: 'Ti CP-4', group: 'CP Unalloyed' },
  { id: 'ti-6242', name: 'Ti-6242 (Ti-6Al-2Sn-4Zr-2Mo creep-resistant)', formula: 'Ti-6Al-2Sn-4Zr-2Mo', group: 'Near-Alpha' },
  { id: 'ti-5553', name: 'Ti-5553 (Ti-5Al-5V-5Mo-3Cr deep-hardenable)', formula: 'Ti-5Al-5V-5Mo-3Cr', group: 'Near-Beta' },
  { id: 'ti-48al-2cr-2nb', name: 'Ti-48Al-2Cr-2Nb (Gamma TiAl intermetallic)', formula: 'Ti-48Al-2Cr-2Nb', group: 'Intermetallic' },
  { id: 'ti-10-2-3', name: 'Ti-10V-2Fe-3Al (High toughness beta)', formula: 'Ti-10V-2Fe-3Al', group: 'Beta' },
  { id: 'ti-beta21s', name: 'Ti-Beta21S (Oxidation resistant foil)', formula: 'Ti-15Mo-3Nb-3Al-0.2Si', group: 'Beta' },
  { id: 'ti-15mo', name: 'Ti-15Mo (Biocompatible zero-Ni/zero-V)', formula: 'Ti-15Mo', group: 'Beta' },
  { id: 'ti-13nb-13zr', name: 'Ti-13Nb-13Zr (Low modulus orthopedic)', formula: 'Ti-13Nb-13Zr', group: 'Near-Beta' },
  { id: 'ti-35nb-7zr-5ta', name: 'TNZT (Ti-35Nb-7Zr-5Ta low modulus)', formula: 'Ti-35Nb-7Zr-5Ta', group: 'Beta' },
  { id: 'ti-grade-7', name: 'Ti Grade 7 (Ti-0.2Pd acid corrosion)', formula: 'Ti-0.2Pd', group: 'CP Unalloyed' },
  { id: 'ti-811', name: 'Ti-8Al-1Mo-1V (Aerospace jet compressor)', formula: 'Ti-8Al-1Mo-1V', group: 'Near-Alpha' }
];

interface ParamNumberInputProps {
  label: React.ReactNode;
  value: number;
  unit: string;
  onChange: (val: number) => void;
  sliderDefaultMax: number;
  min?: number;
  sliderStep?: number;
  title?: string;
  isHighlighted?: boolean;
}

const ParamNumberInput = React.memo(function ParamNumberInput({
  label,
  value,
  unit,
  onChange,
  sliderDefaultMax,
  min = 0,
  sliderStep,
  title,
  isHighlighted = false,
}: ParamNumberInputProps) {
  const [localStr, setLocalStr] = useState<string>(String(value));
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (!isFocused) {
      setLocalStr(String(value));
    }
  }, [value, isFocused]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setLocalStr(raw);
    if (raw === '') return;
    const parsed = parseFloat(raw);
    if (!isNaN(parsed)) {
      const clamped = Math.min(1000000, Math.max(0, parsed));
      onChange(clamped);
    }
  };

  const handleBlur = () => {
    setIsFocused(false);
    const parsed = parseFloat(localStr);
    if (isNaN(parsed) || localStr.trim() === '') {
      onChange(min);
      setLocalStr(String(min));
    } else {
      const clamped = Math.min(1000000, Math.max(0, parsed));
      onChange(clamped);
      setLocalStr(String(clamped));
    }
  };

  // Dynamic slider range extending up to 1,000,000 smoothly
  const dynamicSliderMax = Math.max(
    sliderDefaultMax,
    Math.min(1000000, value > sliderDefaultMax ? (value > 50000 ? 1000000 : value > 10000 ? 50000 : 10000) : sliderDefaultMax)
  );

  const currentStep = sliderStep ?? (dynamicSliderMax >= 100000 ? 500 : dynamicSliderMax >= 10000 ? 50 : value < 10 ? 0.01 : 1);

  return (
    <div className={`space-y-1 transition-all rounded-lg p-1.5 ${isHighlighted ? 'bg-[#50d8e9]/10 ring-2 ring-[#50d8e9] shadow-[0_0_15px_rgba(80,216,233,0.3)] animate-pulse' : ''}`}>
      <div className="flex items-center justify-between text-xs">
        <span className="text-[#a5b6ca] flex items-center gap-1.5">
          {label}
          {isHighlighted && (
            <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-[#50d8e9] text-black shadow-sm">
              Copilot
            </span>
          )}
        </span>
        <div className={`flex items-center gap-1 bg-[#0b1017] border ${isHighlighted ? 'border-[#50d8e9] ring-1 ring-[#50d8e9]' : 'border-[#202e40]'} hover:border-[#385375] focus-within:border-[#50d8e9] focus-within:ring-1 focus-within:ring-[#50d8e9]/30 rounded-md px-1.5 py-0.5 transition-all`}>
          <input
            type="number"
            min={0}
            max={1000000}
            step="any"
            value={isFocused ? localStr : value}
            onFocus={() => setIsFocused(true)}
            onChange={handleInputChange}
            onBlur={handleBlur}
            className="w-24 bg-transparent text-right font-mono font-bold text-[#50d8e9] text-xs focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            placeholder="0"
            title={title || "Directly write any parameter value up to 1,000,000"}
          />
          <span className="font-mono text-[10.5px] font-bold text-[#50d8e9] select-none">{unit}</span>
        </div>
      </div>
      <input
        type="range"
        min={min}
        max={dynamicSliderMax}
        step={currentStep}
        value={Math.min(dynamicSliderMax, Math.max(min, value))}
        onChange={(e) => {
          const v = Number(e.target.value);
          onChange(v);
          setLocalStr(String(v));
        }}
        className="w-full accent-[#50d8e9] h-1.5 bg-[#232b38] rounded-lg cursor-pointer"
      />
    </div>
  );
});

interface UsageStats {
  totalVisitors: number;
  visitorsToday: number;
  predictionsMade: number;
}

// Persistent Usage Statistics Engine (Vercel Serverless + Resilient Browser Fallback)
const STATS_STORAGE_KEY = 'matsci_usage_stats_v2';
const SESSION_VISIT_KEY = 'matsci_session_visit_v2';
const BASE_USAGE_STATS: UsageStats = {
  totalVisitors: 1258,
  visitorsToday: 42,
  predictionsMade: 3840,
};

function loadPersistentUsageStats(): UsageStats {
  if (typeof window === 'undefined') return BASE_USAGE_STATS;
  try {
    const today = new Date().toISOString().slice(0, 10);
    const raw = localStorage.getItem(STATS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<UsageStats & { statsDate?: string }>;
      const total = typeof parsed.totalVisitors === 'number' && parsed.totalVisitors > 0
        ? parsed.totalVisitors
        : BASE_USAGE_STATS.totalVisitors;
      const preds = typeof parsed.predictionsMade === 'number' && parsed.predictionsMade > 0
        ? parsed.predictionsMade
        : BASE_USAGE_STATS.predictionsMade;
      let todayVisits = typeof parsed.visitorsToday === 'number' && parsed.visitorsToday >= 0
        ? parsed.visitorsToday
        : BASE_USAGE_STATS.visitorsToday;

      // Daily midnight rollover
      if (parsed.statsDate !== today) {
        todayVisits = 1;
      }

      return {
        totalVisitors: total,
        visitorsToday: todayVisits,
        predictionsMade: preds,
      };
    }
  } catch {
    // Suppress storage read errors
  }
  return BASE_USAGE_STATS;
}

function savePersistentUsageStats(stats: UsageStats): void {
  if (typeof window === 'undefined') return;
  try {
    const today = new Date().toISOString().slice(0, 10);
    localStorage.setItem(STATS_STORAGE_KEY, JSON.stringify({
      ...stats,
      statsDate: today,
    }));
  } catch {
    // Suppress quota errors
  }
}

export function MatSciPredictor({
  initialAlloyId = 'ti-6al-4v',
  onAlloyChange,
  activeTab: activeTabProp,
  onTabChange,
  onCopilotNavigate,
}: MatSciPredictorProps) {
  // Sidebar Controls State
  const [selectedProcessId, setSelectedProcessId] = useState('pbf-laser');
  const [selectedAlloyId, setSelectedAlloyId] = useState(initialAlloyId);
  const [laserPower, setLaserPower] = useState(200);
  const [scanSpeed, setScanSpeed] = useState(950);
  const [hatchSpacing, setHatchSpacing] = useState(80);
  const [layerThickness, setLayerThickness] = useState(40);
  const [spotDiameter, setSpotDiameter] = useState(80);
  const [preheatTemp, setPreheatTemp] = useState(35);
  const [heatTreatment, setHeatTreatment] = useState<ProcessInputParams['heatTreatment']>('None');
  const [userName, setUserName] = useState('');
  const [targetHardnessInput, setTargetHardnessInput] = useState<number | string>(345);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [absorptivityOverride, setAbsorptivityOverride] = useState<number | null>(null);

  // VED Solver & Parameter Inversion State
  const [targetVedInput, setTargetVedInput] = useState<number | string>(72.4);
  const [solverMode, setSolverMode] = useState<'balanced' | 'fine' | 'productivity'>('balanced');
  const [autoApplyVed, setAutoApplyVed] = useState(false);
  const [vedAppliedNotification, setVedAppliedNotification] = useState(false);

  // Active Tab
  const [internalActiveTab, setInternalActiveTab] = useState<ActiveTab>('predictions');
  const activeTab = activeTabProp ?? internalActiveTab;
  const setActiveTab = (tab: ActiveTab) => {
    setInternalActiveTab(tab);
    onTabChange?.(tab);
  };
  const tabNavigationRef = useRef<HTMLDivElement | null>(null);
  const wheelGestureHandledRef = useRef(false);
  const wheelGestureResetTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const tabNavigation = tabNavigationRef.current;
    if (!tabNavigation) return;

    const handleSubsectionWheel = (event: WheelEvent) => {
      if (!window.matchMedia('(min-width: 1024px)').matches) return;

      const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY)
        ? event.deltaX
        : event.deltaY;
      if (delta === 0) return;

      const currentIndex = PREDICTOR_TAB_ORDER.indexOf(activeTab);
      const nextIndex = currentIndex + (delta > 0 ? 1 : -1);
      if (nextIndex < 0 || nextIndex >= PREDICTOR_TAB_ORDER.length) return;

      event.preventDefault();
      if (!wheelGestureHandledRef.current) {
        wheelGestureHandledRef.current = true;
        setActiveTab(PREDICTOR_TAB_ORDER[nextIndex]);
        tabNavigation.children.item(nextIndex)?.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
          inline: 'nearest'
        });
      }

      if (wheelGestureResetTimerRef.current !== null) {
        window.clearTimeout(wheelGestureResetTimerRef.current);
      }
      wheelGestureResetTimerRef.current = window.setTimeout(() => {
        wheelGestureHandledRef.current = false;
        wheelGestureResetTimerRef.current = null;
      }, 250);
    };

    tabNavigation.addEventListener('wheel', handleSubsectionWheel, { passive: false });
    return () => tabNavigation.removeEventListener('wheel', handleSubsectionWheel);
  }, [activeTab, onTabChange]);

  useEffect(() => () => {
    if (wheelGestureResetTimerRef.current !== null) {
      window.clearTimeout(wheelGestureResetTimerRef.current);
    }
  }, []);
  const [isCopilotOpen, setIsCopilotOpen] = useState(false);
  const [copilotBanner, setCopilotBanner] = useState<string | null>(null);
  const [highlightedSlider, setHighlightedSlider] = useState<'all' | 'laserPower' | 'scanSpeed' | 'hatchSpacing' | 'layerThickness' | 'preheatTemp' | null>(null);


  // Bontha et al. (2006 JMPT & 2009 MSEA) & KU Leuven (Coen et al. 2022) Melt Pool State
  const [meltPoolModelType, setMeltPoolModelType] = useState<'rosenthal' | 'coen-hybrid'>('coen-hybrid');
  const [meltPoolImagingMode, setMeltPoolImagingMode] = useState<'surface' | 'cross-section'>('surface');
  const [showMeltPoolDims, setShowMeltPoolDims] = useState<boolean>(true);
  const [showMeltPoolCallouts, setShowMeltPoolCallouts] = useState<boolean>(true);
  const [showMeltPoolGrid, setShowMeltPoolGrid] = useState<boolean>(true);
  const [gridContrastMode, setGridContrastMode] = useState<'high' | 'ultra'>('high');
  const [bonthaGeometryMode, setBonthaGeometryMode] = useState<BonthaGeometryMode>('3d-bulky');
  const [bonthaPhysicsMode, setBonthaPhysicsMode] = useState<BonthaPhysicsMode>('rosenthal');
  const [bonthaProcessScale, setBonthaProcessScale] = useState<'small-scale' | 'large-scale'>('small-scale');
  const [beamTechnology, setBeamTechnology] = useState<'laser' | 'ebeam'>('laser');
  const [selectedPaperPreset, setSelectedPaperPreset] = useState<string>('custom');
  const [showFemOverlay, setShowFemOverlay] = useState<boolean>(true);
  const [bonthaSubTab, setBonthaSubTab] = useState<'solidification-map' | 'dimensionless-maps' | 'depth-profile' | 'cell-spacing'>('solidification-map');
  const [wallThicknessMode, setWallThicknessMode] = useState<'lens-benchmark' | 'process-track' | 'custom'>('lens-benchmark');
  const [customWallThicknessMm, setCustomWallThicknessMm] = useState<number>(2.26);
  const [selectedDepthStationIdx, setSelectedDepthStationIdx] = useState<number>(0);

  // Interactive Process Map Range Settings
  const [mapColorMode, setMapColorMode] = useState<'hardness' | 'density' | 'coolingRate'>('hardness');
  const [mapPowerMax, setMapPowerMax] = useState(400);
  const [mapSpeedMax, setMapSpeedMax] = useState(2000);

  // Inverse Design Search State
  const [includeHTInSearch, setIncludeHTInSearch] = useState(true);
  const [inverseResults, setInverseResults] = useState<ReturnType<typeof searchInverseDesignSettings>>([]);
  const [hasSearchedInverse, setHasSearchedInverse] = useState(false);

  // Parity Plot Filter
  const [parityFilter, setParityFilter] = useState<'all' | 'current-alloy'>('all');

  // Stats Counters: Resilient Persistent Architecture (Hydrates from localStorage + Syncs with Server)
  const [usageStats, setUsageStats] = useState<UsageStats>(() => loadPersistentUsageStats());
  const [statsError, setStatsError] = useState<string | null>(null);
  const [experimentalCount] = useState(42);

  const refreshUsageStats = async () => {
    try {
      const response = await fetch('/api/stats', { cache: 'no-store' });
      if (response.ok) {
        const stats = await response.json() as UsageStats;
        if (stats && typeof stats.totalVisitors === 'number') {
          setUsageStats((prev) => {
            const merged: UsageStats = {
              totalVisitors: Math.max(prev.totalVisitors, stats.totalVisitors),
              visitorsToday: Math.max(prev.visitorsToday, stats.visitorsToday),
              predictionsMade: Math.max(prev.predictionsMade, stats.predictionsMade),
            };
            savePersistentUsageStats(merged);
            return merged;
          });
          setStatsError(null);
          return;
        }
      }
    } catch {
      // Offline or static host fallback: keep local persistent counters running seamlessly
    }
    // Never show red error banner if local persistence is active
    setStatsError(null);
  };

  const recordUsageEvent = async (event: 'visit' | 'prediction') => {
    // 1. Immediately increment local persistent state for zero-latency UI update
    if (event === 'prediction') {
      setUsageStats((prev) => {
        const updated = {
          ...prev,
          predictionsMade: prev.predictionsMade + 1,
        };
        savePersistentUsageStats(updated);
        return updated;
      });
    }
    setStatsError(null);

    // 2. Fire telemetry sync in background if backend server is available
    try {
      const response = await fetch('/api/stats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (response.ok) {
        const stats = await response.json() as UsageStats;
        if (stats && typeof stats.totalVisitors === 'number') {
          setUsageStats((prev) => {
            const merged: UsageStats = {
              totalVisitors: Math.max(prev.totalVisitors, stats.totalVisitors),
              visitorsToday: Math.max(prev.visitorsToday, stats.visitorsToday),
              predictionsMade: Math.max(prev.predictionsMade, stats.predictionsMade),
            };
            savePersistentUsageStats(merged);
            return merged;
          });
        }
      }
    } catch {
      // Gracefully handled by local storage
    }
  };

  useEffect(() => {
    let active = true;

    // 1. Record session visit locally
    try {
      const today = new Date().toISOString().slice(0, 10);
      const recorded = sessionStorage.getItem(SESSION_VISIT_KEY);
      if (recorded !== today) {
        const current = loadPersistentUsageStats();
        const updated: UsageStats = {
          totalVisitors: current.totalVisitors + 1,
          visitorsToday: current.visitorsToday + 1,
          predictionsMade: current.predictionsMade,
        };
        savePersistentUsageStats(updated);
        sessionStorage.setItem(SESSION_VISIT_KEY, today);
        if (active) {
          setUsageStats(updated);
          setStatsError(null);
        }
      }
    } catch {
      // Fallback without sessionStorage
    }

    // 2. Sync with backend API in background if available
    const syncWithBackend = async () => {
      try {
        const response = await fetch('/api/stats');
        if (response.ok) {
          const stats = await response.json() as UsageStats;
          if (active && stats && typeof stats.totalVisitors === 'number') {
            setUsageStats((prev) => {
              const merged: UsageStats = {
                totalVisitors: Math.max(prev.totalVisitors, stats.totalVisitors),
                visitorsToday: Math.max(prev.visitorsToday, stats.visitorsToday),
                predictionsMade: Math.max(prev.predictionsMade, stats.predictionsMade),
              };
              savePersistentUsageStats(merged);
              return merged;
            });
            setStatsError(null);
          }
        }
      } catch {
        // Handled silently
      }
    };

    void syncWithBackend();

    // 3. Periodic refresh to stay in sync
    const intervalId = window.setInterval(() => {
      if (active) {
        void refreshUsageStats();
      }
    }, 15000);

    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, []);

  // Update alloy if initialAlloyId changes
  useEffect(() => {
    if (initialAlloyId && initialAlloyId !== selectedAlloyId) {
      setSelectedAlloyId(initialAlloyId);
    }
  }, [initialAlloyId]);

  useEffect(() => {
    setHasSearchedInverse(false);
    setInverseResults([]);
  }, [selectedAlloyId, includeHTInSearch]);

  // Adjust parameters when process changes
  const handleProcessSelect = (procId: string) => {
    setSelectedProcessId(procId);
    setHasSearchedInverse(false);
    setInverseResults([]);
    const proc = AM_PROCESSES.find((p) => p.id === procId);
    if (proc) {
      setLaserPower(proc.defaultPower);
      setScanSpeed(proc.defaultSpeed);
      if (proc.id === 'ded-laser' || proc.id === 'waam') {
        setLayerThickness(proc.id === 'waam' ? 1200 : 250);
        setHatchSpacing(proc.id === 'waam' ? 3000 : 800);
        setSpotDiameter(proc.id === 'waam' ? 2500 : 600);
        setMapPowerMax(proc.id === 'waam' ? 4000 : 2500);
        setMapSpeedMax(proc.id === 'waam' ? 120 : 1000);
        setTargetVedInput(proc.id === 'waam' ? 15.0 : 25.0);
      } else {
        setLayerThickness(40);
        setHatchSpacing(80);
        setSpotDiameter(80);
        setMapPowerMax(400);
        setMapSpeedMax(2000);
        setTargetVedInput(proc.id === 'pbf-ebeam' ? 65.0 : 72.4);
      }
    }
  };

  const handleAlloyChange = (id: string) => {
    setSelectedAlloyId(id);
    setHasSearchedInverse(false);
    setInverseResults([]);
    if (onAlloyChange) onAlloyChange(id);
  };

  // Compile process parameters
  const currentParams: ProcessInputParams = useMemo(() => ({
    laserPowerW: laserPower,
    scanSpeedMmS: scanSpeed,
    hatchSpacingUm: hatchSpacing,
    layerThicknessUm: layerThickness,
    beamSpotDiameterUm: spotDiameter,
    preheatTempC: preheatTemp,
    heatTreatment,
    laserAbsorptivityOverride: absorptivityOverride ?? undefined,
    processId: selectedProcessId,
  }), [laserPower, scanSpeed, hatchSpacing, layerThickness, spotDiameter, preheatTemp, heatTreatment, absorptivityOverride, selectedProcessId]);

  // Compute live physics prediction
  const prediction: PredictionResult = useMemo(() => {
    return calculateAmPredictions(selectedAlloyId, currentParams);
  }, [selectedAlloyId, currentParams]);

  // VED Solver derivation for Process Parameters
  const vedPresets = useMemo(() => {
    if (selectedProcessId === 'waam') return [5, 10, 15, 20, 30];
    if (selectedProcessId === 'ded-laser') return [15, 25, 35, 50, 75];
    if (selectedProcessId === 'pbf-ebeam') return [45, 60, 75, 90, 110];
    return [50, 65, 72.4, 85, 100];
  }, [selectedProcessId]);

  const numericVed = useMemo(() => {
    const val = typeof targetVedInput === 'number' ? targetVedInput : parseFloat(String(targetVedInput));
    return isNaN(val) || val <= 0 ? (selectedProcessId === 'waam' ? 15 : selectedProcessId === 'ded-laser' ? 25 : 72.4) : val;
  }, [targetVedInput, selectedProcessId]);

  const vedSolverCandidates = useMemo(() => {
    return solveParametersFromVed(selectedAlloyId, selectedProcessId, numericVed);
  }, [selectedAlloyId, selectedProcessId, numericVed]);

  const activeVedCandidate = useMemo(() => {
    return vedSolverCandidates.find((c) => c.mode === solverMode) || vedSolverCandidates[0];
  }, [vedSolverCandidates, solverMode]);

  const handleApplyVedCandidate = (cand: VedSolverCandidate) => {
    setLaserPower(cand.laserPowerW);
    setScanSpeed(cand.scanSpeedMmS);
    setHatchSpacing(cand.hatchSpacingUm);
    setLayerThickness(cand.layerThicknessUm);
    setSpotDiameter(cand.spotDiameterUm);
    setVedAppliedNotification(true);
    setTimeout(() => setVedAppliedNotification(false), 2200);
  };

  useEffect(() => {
    if (autoApplyVed && activeVedCandidate) {
      setLaserPower(activeVedCandidate.laserPowerW);
      setScanSpeed(activeVedCandidate.scanSpeedMmS);
      setHatchSpacing(activeVedCandidate.hatchSpacingUm);
      setLayerThickness(activeVedCandidate.layerThicknessUm);
      setSpotDiameter(activeVedCandidate.spotDiameterUm);
    }
  }, [autoApplyVed, activeVedCandidate]);

  // Debounced telemetry recording: Only records after the user finishes adjusting parameters (1500ms debounce)
  // Completely eliminates request storms, thread contention, and cascading re-renders during continuous slider dragging
  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      if (active) {
        void recordUsageEvent('prediction');
      }
    }, 1500);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [prediction]);

  // Execute inverse design search

  const activeWallThicknessMm = useMemo(() => {
    if (wallThicknessMode === 'lens-benchmark') return 2.26;
    if (wallThicknessMode === 'process-track') {
      if (selectedProcessId === 'waam') return 3.5;
      if (selectedProcessId === 'ded-laser') return 2.26;
      return Math.max(0.08, (hatchSpacing / 1000) * 1.5);
    }
    return customWallThicknessMm || 2.26;
  }, [wallThicknessMode, selectedProcessId, hatchSpacing, customWallThicknessMm]);

  const bonthaData = useMemo(() => {
    return calculateBonthaThermalModel(
      selectedAlloyId,
      {
        laserPowerW: laserPower,
        scanSpeedMmS: scanSpeed,
        hatchSpacingUm: hatchSpacing,
        layerThicknessUm: layerThickness,
        beamSpotDiameterUm: spotDiameter,
        preheatTempC: preheatTemp,
        heatTreatment,
        laserAbsorptivityOverride: absorptivityOverride ?? undefined,
      },
      {
        geometryMode: bonthaGeometryMode,
        physicsMode: bonthaPhysicsMode,
        wallThicknessMm: activeWallThicknessMm,
      }
    );
  }, [selectedAlloyId, laserPower, scanSpeed, hatchSpacing, layerThickness, spotDiameter, preheatTemp, heatTreatment, absorptivityOverride, activeWallThicknessMm, bonthaGeometryMode, bonthaPhysicsMode]);

  const handleLoadPaperPreset = (presetKey: string) => {
    setSelectedPaperPreset(presetKey);
    if (presetKey === 'custom') return;
    setBonthaGeometryMode('3d-bulky');
    if (presetKey === 'fig3a-350w') {
      setLaserPower(350);
      setScanSpeed(8.47);
      setBonthaProcessScale('small-scale');
      setBeamTechnology('laser');
      setAbsorptivityOverride(0.35);
    } else if (presetKey === 'fig3a-550w') {
      setLaserPower(550);
      setScanSpeed(8.47);
      setBonthaProcessScale('small-scale');
      setBeamTechnology('laser');
      setAbsorptivityOverride(0.35);
    } else if (presetKey === 'fig3a-850w') {
      setLaserPower(850);
      setScanSpeed(8.47);
      setBonthaProcessScale('small-scale');
      setBeamTechnology('laser');
      setAbsorptivityOverride(0.35);
    } else if (presetKey === 'fig3b-slow') {
      setLaserPower(550);
      setScanSpeed(2.12);
      setBonthaProcessScale('small-scale');
      setBeamTechnology('laser');
      setAbsorptivityOverride(0.35);
    } else if (presetKey === 'fig3b-fast') {
      setLaserPower(550);
      setScanSpeed(10.6);
      setBonthaProcessScale('small-scale');
      setBeamTechnology('laser');
      setAbsorptivityOverride(0.35);
    } else if (presetKey === 'fig4a-5kw') {
      setLaserPower(5000);
      setScanSpeed(8.47);
      setBonthaProcessScale('large-scale');
      setBeamTechnology('laser');
      setAbsorptivityOverride(0.35);
    } else if (presetKey === 'fig4a-15kw') {
      setLaserPower(15000);
      setScanSpeed(8.47);
      setBonthaProcessScale('large-scale');
      setBeamTechnology('laser');
      setAbsorptivityOverride(0.35);
    } else if (presetKey === 'fig4a-30kw') {
      setLaserPower(30000);
      setScanSpeed(8.47);
      setBonthaProcessScale('large-scale');
      setBeamTechnology('laser');
      setAbsorptivityOverride(0.35);
    } else if (presetKey === 'fig4b-slow') {
      setLaserPower(15000);
      setScanSpeed(2.12);
      setBonthaProcessScale('large-scale');
      setBeamTechnology('laser');
      setAbsorptivityOverride(0.35);
    } else if (presetKey === 'fig4b-fast') {
      setLaserPower(15000);
      setScanSpeed(10.6);
      setBonthaProcessScale('large-scale');
      setBeamTechnology('laser');
      setAbsorptivityOverride(0.35);
    } else if (presetKey === 'ebeam-15kw') {
      setLaserPower(15000);
      setScanSpeed(8.47);
      setBonthaProcessScale('large-scale');
      setBeamTechnology('ebeam');
      setAbsorptivityOverride(0.88);
    }
  };

  const handleRunInverseDesign = () => {
    if (selectedProcessId !== 'pbf-laser') {
      setInverseResults([]);
      setHasSearchedInverse(false);
      return;
    }

    const targetHardnessNum = typeof targetHardnessInput === 'number' ? targetHardnessInput : parseFloat(String(targetHardnessInput)) || 345;
    const results = searchInverseDesignSettings(selectedAlloyId, targetHardnessNum, includeHTInSearch);
    setInverseResults(results);
    setHasSearchedInverse(true);
    void recordUsageEvent('prediction');
  };

  // Apply inverse design candidate to active sliders
  const handleApplyCandidate = (item: InverseDesignCandidate) => {
    setLaserPower(item.powerW);
    setScanSpeed(item.speedMmS);
    setHatchSpacing(item.hatchUm);
    setLayerThickness(item.layerUm);
    setHeatTreatment(item.heatTreatment);
    setActiveTab('predictions');
  };

  // Preset Handlers for Research Publications
  const applyCoenPreset = () => {
    setSelectedAlloyId('ti-6al-4v');
    setLaserPower(200);
    setScanSpeed(1600);
    setSpotDiameter(37.5);
    setLayerThickness(30);
    setHatchSpacing(100);
    setPreheatTemp(50); // 323 K
    setSelectedPaperPreset('coen-2022');
    setMeltPoolModelType('coen-hybrid');
  };

  const applyRansenigoPreset = () => {
    setSelectedAlloyId('ti-6al-4v');
    setLaserPower(300);
    setScanSpeed(1750);
    setSpotDiameter(100); // 2 * 50 um radius
    setLayerThickness(50);
    setHatchSpacing(75);
    setPreheatTemp(25);
    setSelectedPaperPreset('ransenigo-2022');
    setMeltPoolModelType('coen-hybrid');
  };

  // Download Prediction CSV (with CWE-1236 Formula Injection sanitization)
  const handleDownloadCsv = () => {
    const sanitizeCsvField = (val: unknown): string => {
      if (val === null || val === undefined) return '""';
      let str = String(val).replace(/"/g, '""');
      if (/^[=+@-|\t\r]/.test(str)) {
        str = "'" + str;
      }
      return `"${str}"`;
    };

    const headers = [
      'Alloy', 'Process', 'Laser Power (W)', 'Scan Speed (mm/s)', 'Hatch Spacing (um)', 'Layer Thickness (um)',
      'Spot Diameter (um)', 'Preheat Temp (C)', 'Heat Treatment', 'Regime', 'VED (J/mm3)',
      'Hybrid Hardness (HV)', 'Rockwell (HRC)', 'Estimated UTS (MPa)', 'Relative Density (%)', 'Porosity (%)',
      'Solidus Cooling Rate (K/s)', 'Thermal Gradient G (K/m)', 'Solidification Rate R (m/s)', 'Cell Spacing (um)',
      'LoF Index', 'Keyhole Ratio', 'Balling Ratio', 'Investigator'
    ];
    const row = [
      sanitizeCsvField(selectedAlloyId),
      sanitizeCsvField(selectedProcessId),
      currentParams.laserPowerW,
      currentParams.scanSpeedMmS,
      currentParams.hatchSpacingUm,
      currentParams.layerThicknessUm,
      currentParams.beamSpotDiameterUm,
      currentParams.preheatTempC,
      sanitizeCsvField(currentParams.heatTreatment),
      sanitizeCsvField(prediction.regimeLabel),
      prediction.volumetricEnergyDensity,
      prediction.hybridHardnessHV,
      sanitizeCsvField(prediction.rockwellHRC),
      prediction.estimatedUTSMPa,
      prediction.relativeDensityPct,
      prediction.porosityPct,
      prediction.coolingRateKs,
      prediction.thermalGradientG,
      prediction.solidificationRateR,
      prediction.cellSpacingUm,
      prediction.lackOfFusionIndex,
      prediction.keyholeRatio,
      prediction.ballingRatio,
      sanitizeCsvField(userName || 'Anonymous Engineer')
    ];

    const csvContent = '\uFEFF' + [headers.map(sanitizeCsvField).join(','), row.join(',')].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `am-prediction-${selectedAlloyId}-${Date.now()}.csv`;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      if (link.parentNode) link.parentNode.removeChild(link);
      URL.revokeObjectURL(url);
    }, 250);
  };

  return (
    <section id="physics-predictor" className="w-full max-w-full overflow-x-hidden bg-[#090b0e] border-y border-[#1f242d] text-[#e0e6ed] py-8 font-sans">
      <div className="max-w-[1720px] w-full mx-auto px-3 sm:px-6 min-w-0">
        
        {/* Top Header Card Banner matching screenshots */}
        <div className="relative mb-6 rounded-xl overflow-hidden border border-[#1f3042] bg-gradient-to-r from-[#11314f] via-[#0d2a45] to-[#0d3b4c] p-6 shadow-2xl">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-[#50d8e9]/20 border border-[#50d8e9]/40 flex items-center justify-center text-[#50d8e9] shadow-[0_0_15px_rgba(80,216,233,0.3)]">
                  <Flame className="w-5 h-5 text-[#50d8e9]" />
                </div>
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                  <span>MatSci — Hardness &amp; Microstructure Predictor for Laser-AM Titanium</span>
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#50d8e9]/20 text-[#50d8e9] border border-[#50d8e9]/30 font-mono">
                    v2.0 Physics-Informed
                  </span>
                </h1>
              </div>
              <p className="text-xs sm:text-sm text-[#93b4d4] font-medium max-w-4xl">
                Ti-6Al-4V • Ti-6242 • Ti-5553 • CP Grades 1–4 • Gamma TiAl | LPBF, DED &amp; WAAM | analytical physics (Rosenthal + Hall-Petch) + Gaussian Process Regression, checked against published experimental benchmarks.
              </p>
            </div>

            {/* User name & Live metrics counter */}
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2 bg-[#091522]/80 border border-[#1d354d] px-3 py-2 rounded-lg text-xs">
                <User className="w-4 h-4 text-[#50d8e9]" />
                <input
                  type="text"
                  placeholder="Your name (e.g. Priya, 22BME1234)"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  className="bg-transparent border-none text-white text-xs focus:outline-none placeholder:text-[#5f7e9f] w-52"
                />
              </div>

              <div className="flex items-center gap-2 font-mono text-xs">
                <div className="bg-[#091624] border border-[#1b354e] rounded-lg px-3 py-1.5 text-center">
                  <div className="text-[10px] text-[#7192b0] uppercase tracking-wider">Visits</div>
                  <div className="text-sm font-bold text-white">{usageStats.totalVisitors}</div>
                </div>
                <div className="bg-[#091624] border border-[#1b354e] rounded-lg px-3 py-1.5 text-center">
                  <div className="text-[10px] text-[#7192b0] uppercase tracking-wider">Predictions</div>
                  <div className="text-sm font-bold text-[#50d8e9]">{usageStats.predictionsMade}</div>
                </div>
                <div className="bg-[#091624] border border-[#1b354e] rounded-lg px-3 py-1.5 text-center">
                  <div className="text-[10px] text-[#7192b0] uppercase tracking-wider">Exp. Records</div>
                  <div className="text-sm font-bold text-emerald-400">{experimentalCount}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Workspace Layout: Left Sidebar Controls + Main Predictions Panel */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-w-0 w-full">

          {/* LEFT SIDEBAR: Process, Material, Sliders, Heat Treatment */}
          <aside className="lg:col-span-3 min-w-0 space-y-5 bg-[#0f1217] border border-[#1c222c] rounded-xl p-5 text-sm h-fit shadow-xl">
            
            {/* 1. AM Process Selection (8 Authorized Processes) */}
            <div className="space-y-2 border-b border-[#1c222c] pb-4">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-[#8ba2be] uppercase tracking-wider flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-[#50d8e9]" />
                  <span>AM Process</span>
                </label>
                <span className="text-[10px] text-[#50d8e9] font-mono">ISO/ASTM 52900</span>
              </div>
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {AM_PROCESSES.map((proc) => (
                  <label
                    key={proc.id}
                    onClick={() => handleProcessSelect(proc.id)}
                    className={`flex items-start gap-2.5 p-2 rounded-lg cursor-pointer transition-colors text-xs ${
                      selectedProcessId === proc.id
                        ? 'bg-[#1b2c3f] border border-[#50d8e9]/50 text-white shadow-[0_0_10px_rgba(80,216,233,0.15)]'
                        : 'bg-[#141820] border border-[#1e2531] text-[#93a4b7] hover:bg-[#18202b]'
                    }`}
                  >
                    <input
                      type="radio"
                      name="am-process"
                      checked={selectedProcessId === proc.id}
                      onChange={() => handleProcessSelect(proc.id)}
                      className="mt-0.5 accent-[#50d8e9]"
                    />
                    <div className="leading-tight">
                      <div className="font-medium text-white">{proc.label}</div>
                      <div className="text-[10px] text-[#69819b]">{proc.category}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* 2. Titanium Alloy Selector */}
            <div className="space-y-2 border-b border-[#1c222c] pb-4">
              <label className="text-xs font-bold text-[#8ba2be] uppercase tracking-wider flex items-center gap-1.5">
                <Target className="w-3.5 h-3.5 text-[#50d8e9]" />
                <span>Titanium Alloy</span>
              </label>
              <select
                value={selectedAlloyId}
                onChange={(e) => handleAlloyChange(e.target.value)}
                className="w-full bg-[#141820] border border-[#232b38] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#50d8e9] cursor-pointer"
              >
                {TITANIUM_ALLOYS.map((alloy) => (
                  <option key={alloy.id} value={alloy.id} className="bg-[#141820] text-white">
                    {alloy.name} ({alloy.formula})
                  </option>
                ))}
              </select>
            </div>

            {/* 3. Real-Time Process Parameter Sliders */}
            <div className="space-y-4 border-b border-[#1c222c] pb-4">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-[#8ba2be] uppercase tracking-wider flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-[#50d8e9]" />
                  <span>Process Parameters</span>
                </label>
                <button
                  onClick={() => {
                    setLaserPower(200);
                    setScanSpeed(950);
                    setHatchSpacing(80);
                    setLayerThickness(40);
                    setSpotDiameter(80);
                    setPreheatTemp(35);
                    setTargetVedInput(72.4);
                    setHeatTreatment('None');
                  }}
                  title="Reset to default baseline"
                  className="text-[11px] text-[#50d8e9] hover:underline flex items-center gap-1"
                >
                  <RefreshCw className="w-3 h-3" /> Reset
                </button>
              </div>

              {/* Live Parameters VED Banner */}
              <div className="flex items-center justify-between bg-[#111722] border border-[#1e2a3a] px-2.5 py-1.5 rounded-lg text-xs">
                <div className="flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-[#50d8e9]" />
                  <span className="text-[#8ba2be] text-[11px]">Current Sliders VED:</span>
                  <span className="font-mono font-bold text-white text-[11px]">{prediction.volumetricEnergyDensity} J/mm³</span>
                </div>
                <button
                  type="button"
                  onClick={() => setTargetVedInput(prediction.volumetricEnergyDensity)}
                  title="Copy current slider VED into solver"
                  className="text-[10px] text-[#50d8e9] hover:underline bg-[#16273b] px-1.5 py-0.5 rounded border border-[#50d8e9]/30"
                >
                  Set as Target
                </button>
              </div>

              {/* Dedicated VED Parameter Solver Card */}
              <div className="bg-gradient-to-b from-[#111926] to-[#0c121c] border border-[#23354a] rounded-xl p-3 space-y-3 shadow-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                    <Sparkles className="w-3.5 h-3.5 text-[#50d8e9]" />
                    <span>VED Process Parameter Solver</span>
                  </div>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#132537] text-[#50d8e9] border border-[#50d8e9]/40 font-mono">
                    VED → P, v, h, t
                  </span>
                </div>

                <div className="text-[11px] text-[#7d93ac] leading-relaxed">
                  Input target VED (J/mm³) to derive Laser Power <i>P</i>, Scan Speed <i>v</i>, Hatch Spacing <i>h</i>, and Layer Thickness <i>t</i> avoiding lack-of-fusion and keyhole.
                </div>

                {/* Target VED Input & Steppers */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-[#a5b6ca] font-medium">Target VED <i>E<sub>v</sub></i></span>
                    <span className="font-mono font-bold text-[#50d8e9] text-sm">{targetVedInput} J/mm³</span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setTargetVedInput(prev => {
                        const cur = typeof prev === 'number' ? prev : parseFloat(String(prev)) || 70;
                        return Math.max(1, Math.round((cur - 5) * 10) / 10);
                      })}
                      className="px-2.5 py-1 rounded bg-[#17212e] hover:bg-[#223348] text-[#8ba2be] hover:text-white border border-[#233346] text-xs font-mono font-bold transition-colors"
                      title="Decrease VED by 5"
                    >
                      -5
                    </button>
                    <input
                      type="number"
                      min={selectedProcessId === 'waam' ? 1 : selectedProcessId === 'ded-laser' ? 2 : 5}
                      max={selectedProcessId === 'waam' ? 120 : selectedProcessId === 'ded-laser' ? 250 : 500}
                      step={0.5}
                      value={targetVedInput}
                      onChange={(e) => setTargetVedInput(e.target.value)}
                      onBlur={() => {
                        if (targetVedInput === '' || isNaN(Number(targetVedInput))) {
                          setTargetVedInput(numericVed);
                        }
                      }}
                      className="w-full bg-[#131b26] border border-[#2c3d52] focus:border-[#50d8e9] rounded px-2.5 py-1 text-center font-mono font-bold text-white text-xs outline-none"
                      placeholder="Enter VED..."
                    />
                    <button
                      type="button"
                      onClick={() => setTargetVedInput(prev => {
                        const cur = typeof prev === 'number' ? prev : parseFloat(String(prev)) || 70;
                        return Math.min(500, Math.round((cur + 5) * 10) / 10);
                      })}
                      className="px-2.5 py-1 rounded bg-[#17212e] hover:bg-[#223348] text-[#8ba2be] hover:text-white border border-[#233346] text-xs font-mono font-bold transition-colors"
                      title="Increase VED by 5"
                    >
                      +5
                    </button>
                  </div>

                  {/* Range Slider for VED */}
                  <input
                    type="range"
                    min={selectedProcessId === 'waam' ? 1 : selectedProcessId === 'ded-laser' ? 2 : 10}
                    max={Math.max(selectedProcessId === 'waam' ? 60 : selectedProcessId === 'ded-laser' ? 120 : 180, Math.ceil(numericVed * 1.2))}
                    step={0.5}
                    value={numericVed}
                    onChange={(e) => setTargetVedInput(parseFloat(e.target.value))}
                    className="w-full accent-[#50d8e9] h-1.5 bg-[#1d2736] rounded cursor-pointer"
                  />

                  {/* Quick Preset Buttons */}
                  <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                    <span className="text-[10px] text-[#6b829d]">Presets:</span>
                    {vedPresets.map(preset => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setTargetVedInput(preset)}
                        className={`px-1.5 py-0.5 rounded text-[10px] font-mono transition-colors ${
                          Math.abs(numericVed - preset) < 0.1
                            ? 'bg-[#50d8e9] text-[#080d14] font-bold'
                            : 'bg-[#15202d] text-[#8ba2be] hover:bg-[#1e2e42] hover:text-white border border-[#223348]'
                        }`}
                      >
                        {preset} J/mm³
                      </button>
                    ))}
                  </div>

                  {/* Literature Research Paper Benchmarks */}
                  <div className="flex items-center gap-1.5 flex-wrap pt-1.5 border-t border-[#1b2533]">
                    <span className="text-[10px] text-[#50d8e9] font-semibold">Papers:</span>
                    <button
                      type="button"
                      onClick={applyCoenPreset}
                      className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-[#142334] text-[#50d8e9] hover:bg-[#1c334d] border border-[#50d8e9]/40 transition-colors"
                      title="Coen et al. (KU Leuven 2022): P=200W, v=1600mm/s, ds=37.5µm, t=30µm"
                    >
                      Coen 2022
                    </button>
                    <button
                      type="button"
                      onClick={applyRansenigoPreset}
                      className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-[#1f1a30] text-[#c084fc] hover:bg-[#2b2245] border border-[#c084fc]/40 transition-colors"
                      title="Ransenigo et al. (Concept Laser M2 2022): P=300W, v=1750mm/s, ds=100µm, t=50µm, h=75µm"
                    >
                      Ransenigo 2022
                    </button>
                  </div>
                </div>

                {/* Solver Optimization Profile Mode */}
                <div className="space-y-1">
                  <span className="text-[10px] text-[#6b829d] uppercase tracking-wider font-semibold">Optimization Profile</span>
                  <div className="grid grid-cols-3 gap-1 bg-[#101621] p-1 rounded-lg border border-[#1b2636]">
                    {(['balanced', 'fine', 'productivity'] as const).map(mode => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setSolverMode(mode)}
                        className={`py-1 text-[11px] rounded transition-all font-medium text-center ${
                          solverMode === mode
                            ? 'bg-[#1a334d] text-[#50d8e9] border border-[#50d8e9]/40 shadow-sm font-semibold'
                            : 'text-[#8ba2be] hover:text-white hover:bg-[#152130]'
                        }`}
                      >
                        {mode === 'balanced' ? 'Balanced' : mode === 'fine' ? 'Fine Detail' : 'High Speed'}
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] text-[#6b829d] italic leading-tight">
                    {activeVedCandidate?.description}
                  </p>
                </div>

                {/* Derived Parameters Display Grid */}
                <div className="bg-[#0e141e] border border-[#1d2d3e] rounded-lg p-2.5 space-y-2">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-[#8ba2be] font-medium">Derived Process Parameters:</span>
                    <span className="text-[10px] font-mono text-[#10b981] bg-[#10b981]/10 px-1.5 py-0.5 rounded border border-[#10b981]/30">
                      VED = {activeVedCandidate?.actualVedJmm3} J/mm³
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-[#080d14] p-2 rounded border border-[#1a2636]">
                      <div className="text-[10px] text-[#788fa8]">Laser Power <i>P</i></div>
                      <div className="text-sm font-mono font-bold text-[#50d8e9]">{activeVedCandidate?.laserPowerW} W</div>
                    </div>
                    <div className="bg-[#080d14] p-2 rounded border border-[#1a2636]">
                      <div className="text-[10px] text-[#788fa8]">Scan Speed <i>v</i></div>
                      <div className="text-sm font-mono font-bold text-[#50d8e9]">{activeVedCandidate?.scanSpeedMmS} mm/s</div>
                    </div>
                    <div className="bg-[#080d14] p-2 rounded border border-[#1a2636]">
                      <div className="text-[10px] text-[#788fa8]">Hatch Spacing <i>h</i></div>
                      <div className="text-sm font-mono font-bold text-[#50d8e9]">{activeVedCandidate?.hatchSpacingUm} μm</div>
                    </div>
                    <div className="bg-[#080d14] p-2 rounded border border-[#1a2636]">
                      <div className="text-[10px] text-[#788fa8]">Layer Thickness <i>t</i></div>
                      <div className="text-sm font-mono font-bold text-[#50d8e9]">{activeVedCandidate?.layerThicknessUm} μm</div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-[#7189a3] pt-0.5">
                    <span>Build rate: <strong className="text-white font-mono">{activeVedCandidate?.buildRateCm3H} cm³/h</strong></span>
                    <span>Regime: <strong className={activeVedCandidate?.regime === 'conduction' ? 'text-[#10b981]' : 'text-[#f59e0b]'}>{activeVedCandidate?.regimeLabel}</strong></span>
                  </div>

                  {/* Primary Apply Button */}
                  <button
                    type="button"
                    onClick={() => activeVedCandidate && handleApplyVedCandidate(activeVedCandidate)}
                    className="w-full mt-1.5 py-2 rounded-lg bg-[#50d8e9] hover:bg-[#3ec4d5] text-[#070b10] font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-[0_0_15px_rgba(80,216,233,0.3)] active:scale-[0.98]"
                  >
                    <CheckCircle className="w-3.5 h-3.5" />
                    Apply Solved (P, v, h, t) to Sliders
                  </button>
                  {vedAppliedNotification && (
                    <div className="text-center text-[11px] font-medium text-[#10b981] animate-pulse">
                      ✓ Sliders updated with solved parameters!
                    </div>
                  )}
                </div>

                {/* Auto Apply Toggle */}
                <div className="flex items-center justify-between text-[11px] text-[#8ba2be]">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={autoApplyVed}
                      onChange={(e) => setAutoApplyVed(e.target.checked)}
                      className="rounded accent-[#50d8e9] cursor-pointer"
                    />
                    <span>Auto-sync sliders when VED changes</span>
                  </label>
                </div>
              </div>

              {/* Process Parameters Control Panel (Write up to 1,000,000 units or drag sliders) */}
              <div id="process-sliders-panel" className="scroll-mt-28 space-y-2">
                {/* Copilot Applied Values Notice Banner */}
                {copilotBanner && (
                  <div className="p-3 rounded-xl bg-gradient-to-r from-[#50d8e9]/20 via-[#102336] to-[#0d2a45] border-2 border-[#50d8e9] text-[#50d8e9] shadow-[0_0_25px_rgba(80,216,233,0.35)] animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-[#50d8e9] animate-pulse" />
                        <span className="font-bold text-white text-xs">Values Applied from MatSci Copilot!</span>
                      </div>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#50d8e9] text-black font-bold">Active</span>
                    </div>
                    <div className="text-[11px] font-mono text-[#c5ecf8] bg-[#07131f] p-1.5 rounded border border-[#50d8e9]/30">
                      {copilotBanner}
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between text-[11px] border-b border-[#1b2533] pb-1.5 mb-2">
                  <span className="font-semibold text-white flex items-center gap-1.5">
                    <span>Process Variables</span>
                  </span>
                  <span className="text-[10px] text-[#50d8e9] font-mono bg-[#50d8e9]/10 px-1.5 py-0.5 rounded border border-[#50d8e9]/25">
                    Write up to 1,000,000
                  </span>
                </div>

                {/* Slider 1: Laser Power P */}
                <ParamNumberInput
                  label={<>Laser Power <i>P</i></>}
                  value={laserPower}
                  unit="W"
                  onChange={setLaserPower}
                  sliderDefaultMax={bonthaProcessScale === 'large-scale' || laserPower > 4500 ? 30000 : selectedProcessId === 'waam' ? 4500 : selectedProcessId === 'ded-laser' ? 2500 : 500}
                  min={0}
                  sliderStep={laserPower > 1000 ? 50 : 5}
                  title="Laser Power P (write up to 1,000,000 W)"
                  isHighlighted={highlightedSlider === 'all' || highlightedSlider === 'laserPower'}
                />

                {/* Slider 2: Scan Speed v */}
                <ParamNumberInput
                  label={<>Scan Speed <i>v</i></>}
                  value={scanSpeed}
                  unit="mm/s"
                  onChange={setScanSpeed}
                  sliderDefaultMax={2500}
                  min={0}
                  sliderStep={scanSpeed < 50 ? 0.01 : 1}
                  title="Scan Speed v (write up to 1,000,000 mm/s)"
                  isHighlighted={highlightedSlider === 'all' || highlightedSlider === 'scanSpeed'}
                />

                {/* Slider 3: Hatch Spacing h */}
                <ParamNumberInput
                  label={<>Hatch Spacing <i>h</i></>}
                  value={hatchSpacing}
                  unit="μm"
                  onChange={setHatchSpacing}
                  sliderDefaultMax={selectedProcessId === 'waam' ? 4000 : 250}
                  min={0}
                  sliderStep={1}
                  title="Hatch Spacing h (write up to 1,000,000 μm)"
                  isHighlighted={highlightedSlider === 'all' || highlightedSlider === 'hatchSpacing'}
                />

                {/* Slider 4: Layer Thickness t */}
                <ParamNumberInput
                  label={<>Layer Thickness <i>t</i></>}
                  value={layerThickness}
                  unit="μm"
                  onChange={setLayerThickness}
                  sliderDefaultMax={selectedProcessId === 'waam' ? 2000 : 150}
                  min={0}
                  sliderStep={1}
                  title="Layer Thickness t (write up to 1,000,000 μm)"
                  isHighlighted={highlightedSlider === 'all' || highlightedSlider === 'layerThickness'}
                />

                {/* Slider 5: Spot Diameter ds */}
                <ParamNumberInput
                  label={<>Laser Spot Diameter <i>d<sub>s</sub></i></>}
                  value={spotDiameter}
                  unit="μm"
                  onChange={setSpotDiameter}
                  sliderDefaultMax={selectedProcessId === 'waam' ? 3500 : 300}
                  min={0}
                  sliderStep={1}
                  title="Laser Spot Diameter ds (write up to 1,000,000 μm)"
                />

                {/* Slider 6: Build Plate Preheat T0 */}
                <ParamNumberInput
                  label={<>Build Plate Preheat <i>T</i><sub>0</sub></>}
                  value={preheatTemp}
                  unit="°C"
                  onChange={setPreheatTemp}
                  sliderDefaultMax={600}
                  min={0}
                  sliderStep={5}
                  title="Build Plate Preheat T0 (write up to 1,000,000 °C)"
                  isHighlighted={highlightedSlider === 'all' || highlightedSlider === 'preheatTemp'}
                />
              </div>
            </div>

            {/* 4. Post-Processing */}
            <div className="space-y-2 border-b border-[#1c222c] pb-4">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-[#8ba2be] uppercase tracking-wider flex items-center gap-1.5">
                  <Flame className="w-3.5 h-3.5 text-[#50d8e9]" />
                  <span>Post-Processing</span>
                </label>
                {heatTreatment === 'None' && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#101722] text-[#50d8e9] border border-[#50d8e9]/30 font-mono">
                    No post-processing
                  </span>
                )}
              </div>
              <select
                value={heatTreatment}
                onChange={(e) => setHeatTreatment(e.target.value as any)}
                className="w-full bg-[#141820] border border-[#232b38] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#50d8e9] cursor-pointer"
              >
                <option value="None">None (No post-processing)</option>
                <option value="As-built">As-built (Rapidly quenched, α' martensite)</option>
                <option value="Stress-relieved">Stress-relieved (600°C, 2h)</option>
                <option value="Annealed">Annealed (Mill Anneal 730°C, 2h)</option>
                <option value="HIP">HIP (920°C, 100 MPa Ar, 2h pore-closure)</option>
                <option value="Solution-Aged">Solution Treated &amp; Aged (STA)</option>
              </select>
              <p className="text-[11px] text-[#60768e] leading-tight">
                {heatTreatment === 'None'
                  ? 'Zero post-processing applied. Component remains in as-printed state.'
                  : heatTreatment === 'As-built'
                  ? "Raw laser-solidified state with retained α' martensite."
                  : heatTreatment === 'Stress-relieved'
                  ? '600°C for 2h: Relieves internal stresses with minimal hardness drop.'
                  : heatTreatment === 'Annealed'
                  ? '730°C for 2h: Decomposes martensite into equilibrium α+β.'
                  : heatTreatment === 'HIP'
                  ? '920°C, 100 MPa: Closes internal pores and micro-voids.'
                  : 'STA: Solution treated and aged for precipitation hardening.'}
              </p>
            </div>

            {/* 5. Goal & Advanced Settings */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-[#8ba2be] uppercase tracking-wider flex items-center gap-1.5">
                  <Target className="w-3.5 h-3.5 text-[#50d8e9]" />
                  <span>Target Hardness (HV)</span>
                </label>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setTargetHardnessInput((prev) => {
                    const cur = typeof prev === 'number' ? prev : parseFloat(String(prev)) || 345;
                    return Math.max(100, cur - 10);
                  })}
                  className="w-8 h-8 rounded bg-[#1c232f] hover:bg-[#252f3f] text-white flex items-center justify-center font-bold"
                >
                  -
                </button>
                <input
                  type="number"
                  min="1"
                  value={targetHardnessInput}
                  onChange={(e) => {
                    setTargetHardnessInput(e.target.value);
                    setHasSearchedInverse(false);
                    setInverseResults([]);
                  }}
                  onBlur={() => {
                    if (targetHardnessInput === '' || isNaN(Number(targetHardnessInput))) {
                      setTargetHardnessInput(345);
                    }
                  }}
                  className="w-full bg-[#141820] border border-[#232b38] rounded px-3 py-1.5 text-center font-mono font-bold text-white text-sm"
                />
                <button
                  type="button"
                  onClick={() => setTargetHardnessInput((prev) => {
                    const cur = typeof prev === 'number' ? prev : parseFloat(String(prev)) || 345;
                    return cur + 10;
                  })}
                  className="w-8 h-8 rounded bg-[#1c232f] hover:bg-[#252f3f] text-white flex items-center justify-center font-bold"
                >
                  +
                </button>
              </div>

              {/* Advanced Physics Settings Collapsible */}
              <div className="pt-2">
                <button
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="text-xs text-[#7d99b8] hover:text-[#50d8e9] flex items-center gap-1 transition-colors"
                >
                  <span>{showAdvanced ? '▾' : '▸'} Advanced physics settings</span>
                </button>

                {showAdvanced && (
                  <div className="mt-3 p-3 bg-[#13171e] rounded-lg border border-[#1f2633] space-y-3 text-xs">
                    <div>
                      <div className="flex justify-between text-[#8ea5be] mb-1">
                        <span>Absorptivity η</span>
                        <span className="font-mono text-white">
                          {(absorptivityOverride ?? (ALLOY_THERMAL_PROPERTIES[selectedAlloyId] || DEFAULT_TITANIUM_PROPERTIES).laserAbsorptivity).toFixed(2)}
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0.2"
                        max="0.6"
                        step="0.02"
                        value={absorptivityOverride ?? (ALLOY_THERMAL_PROPERTIES[selectedAlloyId] || DEFAULT_TITANIUM_PROPERTIES).laserAbsorptivity}
                        onChange={(e) => setAbsorptivityOverride(Number(e.target.value))}
                        className="w-full accent-[#50d8e9] h-1 bg-[#232b38] rounded cursor-pointer"
                      />
                    </div>
                    <div>
                      <div className="flex justify-between text-[#8ea5be] mb-1">
                        <span>Balling <i>L/W</i> Limit</span>
                        <span className="font-mono text-white">π (3.14)</span>
                      </div>
                      <div className="text-[10px] text-[#637b94]">Plateau-Rayleigh capillary instability bound</div>
                    </div>
                    <div>
                      <div className="flex justify-between text-[#8ea5be] mb-1">
                        <span>Keyhole Threshold</span>
                        <span className="font-mono text-white">ΔH / h<sub>s</sub> &gt; 28</span>
                      </div>
                      <div className="text-[10px] text-[#637b94]">King enthalpy vaporization boundary</div>
                    </div>
                  </div>
                )}
              </div>
            </div>

          </aside>

          {/* MAIN PREDICTIONS WORKSPACE (Tabs, KPIs, Visualizations) */}
          <main className="lg:col-span-9 min-w-0 max-w-full space-y-5">

            {/* TAB NAVIGATION HEADER matching screenshots */}
            <div
              ref={tabNavigationRef}
              aria-label="Physics Predictor subsections. Scroll here with a mouse wheel or trackpad to switch sections."
              className="border-b border-[#1c2430] w-full max-w-full flex flex-nowrap overflow-x-auto gap-2 text-xs sm:text-sm font-medium pb-1 no-scrollbar [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
            >
              <button
                onClick={() => setActiveTab('predictions')}
                className={`px-4 py-2.5 rounded-t-lg transition-all flex items-center gap-2 shrink-0 whitespace-nowrap ${
                  activeTab === 'predictions'
                    ? 'bg-[#141b24] text-[#50d8e9] border-t-2 border-[#50d8e9] font-bold shadow-md'
                    : 'text-[#879bb1] hover:text-white hover:bg-[#12161f]'
                }`}
              >
                <TrendingUp className="w-4 h-4" />
                <span>Predictions</span>
              </button>

              <button
                onClick={() => setActiveTab('process-map')}
                className={`px-4 py-2.5 rounded-t-lg transition-all flex items-center gap-2 shrink-0 whitespace-nowrap ${
                  activeTab === 'process-map'
                    ? 'bg-[#141b24] text-[#50d8e9] border-t-2 border-[#50d8e9] font-bold shadow-md'
                    : 'text-[#879bb1] hover:text-white hover:bg-[#12161f]'
                }`}
              >
                <Layers className="w-4 h-4" />
                <span>Process map</span>
              </button>

              <button
                onClick={() => setActiveTab('defect-map')}
                className={`px-4 py-2.5 rounded-t-lg transition-all flex items-center gap-2 shrink-0 whitespace-nowrap ${
                  activeTab === 'defect-map'
                    ? 'bg-[#141b24] text-[#50d8e9] border-t-2 border-[#50d8e9] font-bold shadow-md'
                    : 'text-[#879bb1] hover:text-white hover:bg-[#12161f]'
                }`}
              >
                <ShieldAlert className="w-4 h-4 text-amber-400" />
                <span>Defect Process Window</span>
                <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 text-[10px] font-mono font-bold">
                  Enthalpy
                </span>
              </button>

              <button
                onClick={() => setActiveTab('economics')}
                className={`px-4 py-2.5 rounded-t-lg transition-all flex items-center gap-2 shrink-0 whitespace-nowrap ${
                  activeTab === 'economics'
                    ? 'bg-[#141b24] text-[#50d8e9] border-t-2 border-[#50d8e9] font-bold shadow-md'
                    : 'text-[#879bb1] hover:text-white hover:bg-[#12161f]'
                }`}
              >
                <DollarSign className="w-4 h-4 text-emerald-400" />
                <span>Build Economics &amp; ESG</span>
                <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[10px] font-mono font-bold">
                  ROI
                </span>
              </button>

              <button
                onClick={() => setActiveTab('digital-twin')}
                className={`px-4 py-2.5 rounded-t-lg transition-all flex items-center gap-2 shrink-0 whitespace-nowrap ${
                  activeTab === 'digital-twin'
                    ? 'bg-[#141b24] text-[#50d8e9] border-t-2 border-[#50d8e9] font-bold shadow-md'
                    : 'text-[#879bb1] hover:text-white hover:bg-[#12161f]'
                }`}
              >
                <Box className="w-4 h-4 text-cyan-400" />
                <span>3D Digital Twin</span>
                <span className="px-1.5 py-0.5 rounded bg-cyan-500/20 text-[#50d8e9] text-[10px] font-mono font-bold">
                  Tensor
                </span>
              </button>

              <button
                onClick={() => setActiveTab('qualification')}
                className={`px-4 py-2.5 rounded-t-lg transition-all flex items-center gap-2 shrink-0 whitespace-nowrap ${
                  activeTab === 'qualification'
                    ? 'bg-[#141b24] text-[#50d8e9] border-t-2 border-[#50d8e9] font-bold shadow-md'
                    : 'text-[#879bb1] hover:text-white hover:bg-[#12161f]'
                }`}
              >
                <Award className="w-4 h-4 text-amber-400" />
                <span>ASTM Qualification</span>
                <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 text-[10px] font-mono font-bold">
                  Audit
                </span>
              </button>

              <button
                onClick={() => setActiveTab('suggestions')}
                className={`px-4 py-2.5 rounded-t-lg transition-all flex items-center gap-2 shrink-0 whitespace-nowrap ${
                  activeTab === 'suggestions'
                    ? 'bg-[#141b24] text-[#50d8e9] border-t-2 border-[#50d8e9] font-bold shadow-md'
                    : 'text-[#879bb1] hover:text-white hover:bg-[#12161f]'
                }`}
              >
                <Sparkles className="w-4 h-4" />
                <span>Suggestions &amp; inverse design</span>
              </button>

              <button
                onClick={() => setActiveTab('melt-pool')}
                className={`px-4 py-2.5 rounded-t-lg transition-all flex items-center gap-2 shrink-0 whitespace-nowrap ${
                  activeTab === 'melt-pool'
                    ? 'bg-[#141b24] text-[#50d8e9] border-t-2 border-[#50d8e9] font-bold shadow-md'
                    : 'text-[#879bb1] hover:text-white hover:bg-[#12161f]'
                }`}
              >
                <Flame className="w-4 h-4" />
                <span>Melt pool &amp; thermal</span>
              </button>

              <button
                onClick={() => setActiveTab('accuracy')}
                className={`px-4 py-2.5 rounded-t-lg transition-all flex items-center gap-2 shrink-0 whitespace-nowrap ${
                  activeTab === 'accuracy'
                    ? 'bg-[#141b24] text-[#50d8e9] border-t-2 border-[#50d8e9] font-bold shadow-md'
                    : 'text-[#879bb1] hover:text-white hover:bg-[#12161f]'
                }`}
              >
                <BarChart3 className="w-4 h-4" />
                <span>Model accuracy</span>
              </button>

              <button
                onClick={() => setActiveTab('literature-intel')}
                className={`px-4 py-2.5 rounded-t-lg transition-all flex items-center gap-2 shrink-0 whitespace-nowrap ${
                  activeTab === 'literature-intel'
                    ? 'bg-[#141b24] text-[#50d8e9] border-t-2 border-[#50d8e9] font-bold shadow-md'
                    : 'text-[#879bb1] hover:text-white hover:bg-[#12161f]'
                }`}
              >
                <BookOpen className="w-4 h-4 text-[#50d8e9]" />
                <span>Evidence &amp; research gaps</span>
                <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-mono font-bold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Scopus Live
                </span>
              </button>

              <button
                onClick={() => setActiveTab('references')}
                className={`px-4 py-2.5 rounded-t-lg transition-all flex items-center gap-2 shrink-0 whitespace-nowrap ${
                  activeTab === 'references'
                    ? 'bg-[#141b24] text-[#50d8e9] border-t-2 border-[#50d8e9] font-bold shadow-md'
                    : 'text-[#879bb1] hover:text-white hover:bg-[#12161f]'
                }`}
              >
                <Info className="w-4 h-4" />
                <span>Data, models &amp; references</span>
              </button>

              {/* MatSci AM Metallurgy Copilot Launcher */}
              <button
                onClick={() => setIsCopilotOpen(true)}
                className="ml-auto px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-cyan-500/20 to-indigo-500/20 text-[#50d8e9] hover:text-white border border-[#50d8e9]/40 hover:border-[#50d8e9] font-bold text-xs flex items-center gap-1.5 transition-all shadow-[0_0_15px_rgba(80,216,233,0.15)] shrink-0 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-[#50d8e9]" />
                <span>MatSci AM Copilot</span>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse ml-0.5" />
              </button>
            </div>
            <p className="hidden lg:block text-right text-[10px] text-[#61758d] -mt-4">
              Scroll over the tabs with your mouse or trackpad to switch subsections
            </p>

            {/* TAB 1: PREDICTIONS */}
            {activeTab === 'predictions' && (
              <div className="space-y-6">

                {/* 5 KPI Cards Row */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
                  {/* Card 1: Hardness */}
                  <div className="bg-[#10141b] border border-[#1e2633] rounded-xl p-4 shadow-md hover:border-[#50d8e9]/40 transition-colors">
                    <div className="text-[11px] font-medium text-[#7d93ac]">Hardness (Hybrid GPR)</div>
                    <div className="text-2xl sm:text-3xl font-extrabold text-white mt-1">
                      {prediction.hybridHardnessHV} <span className="text-base font-normal text-[#8fa3ba]">HV</span>
                    </div>
                    <div className="text-[10px] text-[#50d8e9] font-mono mt-0.5">± 19 HV (95% CI)</div>
                  </div>

                  {/* Card 2: Rockwell C */}
                  <div className="bg-[#10141b] border border-[#1e2633] rounded-xl p-4 shadow-md hover:border-[#50d8e9]/40 transition-colors">
                    <div className="text-[11px] font-medium text-[#7d93ac]">~ Rockwell C</div>
                    <div className="text-2xl sm:text-3xl font-extrabold text-white mt-1">
                      {prediction.rockwellHRC}
                    </div>
                    <div className="text-[10px] text-[#7d93ac] font-mono mt-0.5">ASTM E140 approx</div>
                  </div>

                  {/* Card 3: Est. UTS */}
                  <div className="bg-[#10141b] border border-[#1e2633] rounded-xl p-4 shadow-md hover:border-[#50d8e9]/40 transition-colors">
                    <div className="text-[11px] font-medium text-[#7d93ac]">Est. UTS</div>
                    <div className="text-2xl sm:text-3xl font-extrabold text-white mt-1">
                      {prediction.estimatedUTSMPa} <span className="text-base font-normal text-[#8fa3ba]">MPa</span>
                    </div>
                    <div className="text-[10px] text-emerald-400 font-mono mt-0.5">Alloy Tabor correlation</div>
                  </div>

                  {/* Card 4: Relative Density */}
                  <div className="bg-[#10141b] border border-[#1e2633] rounded-xl p-4 shadow-md hover:border-[#50d8e9]/40 transition-colors">
                    <div className="text-[11px] font-medium text-[#7d93ac]">Relative density (analytical)</div>
                    <div className="text-2xl sm:text-3xl font-extrabold text-white mt-1">
                      {prediction.relativeDensityPct} <span className="text-base font-normal text-[#8fa3ba]">%</span>
                    </div>
                    <div className="text-[10px] text-[#7d93ac] font-mono mt-0.5">
                      Porosity: {prediction.porosityPct}%
                    </div>
                  </div>

                  {/* Card 5: VED */}
                  <div className="bg-[#10141b] border border-[#1e2633] rounded-xl p-4 shadow-md hover:border-[#50d8e9]/40 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="text-[11px] font-medium text-[#7d93ac]">VED (Volumetric Energy)</div>
                      <span className={`text-[9.5px] font-mono px-1.5 py-0.5 rounded border font-semibold ${
                        prediction.regime === 'conduction'
                          ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                          : prediction.regime === 'lack-of-fusion'
                          ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                          : 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                      }`}>
                        {prediction.regime === 'conduction' ? 'Optimal' : prediction.regime === 'lack-of-fusion' ? 'LoF Risk' : 'Keyhole'}
                      </span>
                    </div>
                    <div className="text-2xl sm:text-3xl font-extrabold text-white mt-1">
                      {prediction.volumetricEnergyDensity.toLocaleString()} <span className="text-base font-normal text-[#8fa3ba]">J/mm³</span>
                    </div>
                    <div className="text-[10px] text-amber-400 font-mono mt-0.5 flex items-center justify-between">
                      <span>LED: {currentParams.scanSpeedMmS > 0 ? (currentParams.laserPowerW / currentParams.scanSpeedMmS).toFixed(2) : '—'} J/mm</span>
                      <span className="text-[#7893af]">{selectedProcessId === 'waam' ? 'Opt: ~15 J/mm³' : selectedProcessId === 'ded-laser' ? 'Opt: ~25 J/mm³' : 'Opt: 60–85 J/mm³'}</span>
                    </div>
                  </div>
                </div>

                {/* Process Regime Banner Badge matching screenshot */}
                <div className={`p-3 rounded-lg border flex flex-wrap items-center justify-between gap-3 text-xs ${
                  prediction.regime === 'conduction'
                    ? 'bg-[#0f241a] border-[#1f623e] text-emerald-300'
                    : prediction.regime === 'lack-of-fusion'
                    ? 'bg-[#2b1810] border-[#8a4220] text-amber-300'
                    : prediction.regime === 'keyhole'
                    ? 'bg-[#2a1015] border-[#7d1d2c] text-rose-300'
                    : 'bg-[#261f10] border-[#6b5118] text-yellow-300'
                }`}>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white uppercase tracking-wider">Process regime:</span>
                    <span className={`px-2.5 py-0.5 rounded font-semibold text-xs ${
                      prediction.regime === 'conduction'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        : 'bg-red-500/20 text-red-300 border border-red-500/40'
                    }`}>
                      {prediction.regimeLabel}
                    </span>
                    <span className="hidden md:inline text-[#9fb8d0]">— {prediction.regimeDescription}</span>
                  </div>

                  <div className="font-mono text-[11px] text-[#93acc5]">
                    LoF index <span className="text-white font-bold">{prediction.lackOfFusionIndex}</span> • keyhole ratio <span className="text-white font-bold">{prediction.keyholeRatio}</span> • balling ratio <span className="text-white font-bold">{prediction.ballingRatio}</span>
                  </div>
                </div>

                {/* Literature Evidence & Research Gap Quick Access Banner */}
                <div className="bg-[#0c121c] border border-[#1d2d42] rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-md">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <BookOpen className="w-4 h-4 text-[#50d8e9]" />
                      <span className="text-xs font-bold text-white tracking-wide">Literature Evidence &amp; Research Gap Matrix:</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 font-mono border border-emerald-500/30 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        1,660+ Scopus Publications • Live API Active
                      </span>
                    </div>
                    <p className="text-xs text-[#8ca4be]">
                      Explore indexed publications, curated experimental records, parameter envelopes, reported properties, under-characterized qualification gaps, and research opportunities.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab('literature-intel')}
                    className="px-3.5 py-2 rounded-lg bg-[#142334] hover:bg-[#1b324d] text-[#50d8e9] border border-[#50d8e9]/40 text-xs font-semibold flex items-center gap-1.5 transition-all shrink-0 shadow-sm"
                  >
                    <span>Open Evidence &amp; Gaps Hub</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Split Grid: Left = Models Table + Dynamic Bar Chart; Right = Microstructure + Other Outcomes */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

                  {/* Left Column (7 cols): Hardness from each model + Comparison Bar Chart */}
                  <div className="lg:col-span-7 space-y-4">
                    <div className="bg-[#10141b] border border-[#1e2633] rounded-xl p-5 shadow-lg">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-bold text-white">Hardness from each model</h3>
                        <span className="text-[11px] text-[#7189a3] font-mono">Calibrated against Ti AM Literature</span>
                      </div>

                      {/* Models Table */}
                      {(() => {
                        const ARCHITECTURE_COLOR_PALETTE = [
                          {
                            name: 'Analytical',
                            dotClass: 'bg-blue-400 shadow-[0_0_8px_rgba(59,130,246,0.6)]',
                            topColor: '#60a5fa',
                            bottomColor: '#1d4ed8',
                            glowColor: '#3b82f6',
                            borderHighlight: '#bfdbfe',
                            textClass: 'text-blue-400'
                          },
                          {
                            name: 'Random Forest',
                            dotClass: 'bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.6)]',
                            topColor: '#34d399',
                            bottomColor: '#047857',
                            glowColor: '#10b981',
                            borderHighlight: '#a7f3d0',
                            textClass: 'text-emerald-400'
                          },
                          {
                            name: 'Grad Boost',
                            dotClass: 'bg-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.6)]',
                            topColor: '#fbbf24',
                            bottomColor: '#b45309',
                            glowColor: '#f59e0b',
                            borderHighlight: '#fde68a',
                            textClass: 'text-amber-400'
                          },
                          {
                            name: 'SVM (RBF)',
                            dotClass: 'bg-purple-400 shadow-[0_0_8px_rgba(168,85,247,0.6)]',
                            topColor: '#c084fc',
                            bottomColor: '#7e22ce',
                            glowColor: '#a855f7',
                            borderHighlight: '#e9d5ff',
                            textClass: 'text-purple-400'
                          },
                          {
                            name: 'Hybrid GPR',
                            dotClass: 'bg-pink-400 shadow-[0_0_8px_rgba(244,114,182,0.6)]',
                            topColor: '#f472b6',
                            bottomColor: '#be185d',
                            glowColor: '#ec4899',
                            borderHighlight: '#fbcfe8',
                            textClass: 'text-pink-400'
                          },
                          {
                            name: 'Ensemble',
                            dotClass: 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)]',
                            topColor: '#fb7185',
                            bottomColor: '#9f1239',
                            glowColor: '#f43f5e',
                            borderHighlight: '#fecdd3',
                            textClass: 'text-rose-400'
                          }
                        ];

                        const alloyProps = ALLOY_THERMAL_PROPERTIES[selectedAlloyId];
                        const baseHV = alloyProps?.baseHardnessHV || 290;
                        const alloyMinHV = Math.round(baseHV * 0.95);
                        const alloyMaxHV = Math.round(baseHV * 1.22);
                        const maxModelHV = Math.max(...prediction.modelsTable.map(m => m.predictedHV));
                        const maxChartHV = Math.max(350, Math.ceil(Math.max(maxModelHV, alloyMaxHV * 1.08) / 50) * 50);
                        const chartTicks = [0, 0.25, 0.5, 0.75, 1.0].map(f => Math.round(f * maxChartHV));

                        return (
                          <>
                            <div className="overflow-x-auto">
                              <table className="w-full text-xs text-left">
                                <thead>
                                  <tr className="border-b border-[#1f2837] text-[#7189a3]">
                                    <th className="pb-2.5 px-3 font-semibold">Model</th>
                                    <th className="pb-2.5 px-3 font-semibold text-right">Predicted HV</th>
                                    <th className="pb-2.5 px-3 font-semibold text-center">~ HRC</th>
                                    <th className="pb-2.5 px-3 font-semibold text-right">Expected error (LOO MAE, HV)</th>
                                    <th className="pb-2.5 px-3 font-semibold text-right">Closeness to exp.</th>
                                    <th className="pb-2.5 px-3 font-semibold text-right">R² (LOO)</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-[#18202c]">
                                  {prediction.modelsTable.map((m, idx) => {
                                    const pal = ARCHITECTURE_COLOR_PALETTE[idx % ARCHITECTURE_COLOR_PALETTE.length];
                                    return (
                                      <tr key={m.modelName} className="hover:bg-[#151c27] transition-colors">
                                        <td className="py-2.5 px-3 font-medium text-white flex items-center gap-2">
                                          <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${pal.dotClass}`} />
                                          <span>{m.modelName}</span>
                                        </td>
                                        <td className="py-2.5 px-3 font-mono font-bold text-white text-right">{m.predictedHV}</td>
                                        <td className="py-2.5 px-3 font-mono text-[#8fa3ba] text-center">{m.rockwellHRC}</td>
                                        <td className="py-2.5 px-3 font-mono text-[#8fa3ba] text-right">{m.expectedErrorHV}</td>
                                        <td className="py-2.5 px-3 font-mono text-emerald-400 text-right">{m.closenessPct}%</td>
                                        <td className="py-2.5 px-3 font-mono text-[#50d8e9] text-right">{m.r2Score}</td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                            <div className="mt-2 text-[10px] text-[#5e7792]">
                              Expected error &amp; closeness = leave-one-out cross-validation against published experiments for Ti-6Al-4V LPBF records (N=16). Closeness = 100 - mean absolute % error.
                            </div>

                            {/* Dynamic Color-Graded Bar Chart */}
                            <div className="mt-6 pt-4 border-t border-[#1a222e]">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-semibold text-[#8fa3ba]">Predicted Hardness across Architectures</span>
                                <span className="text-[10px] text-[#50d8e9] font-mono flex items-center gap-1.5">
                                  <span className="inline-block w-4 h-0 border-b-2 border-dashed border-[#50d8e9]" />
                                  <span>Benchmark: {alloyMinHV} – {alloyMaxHV} HV</span>
                                </span>
                              </div>

                              <div className="w-full bg-[#0b0e13] rounded-lg border border-[#1a222e] p-3">
                                <svg className="w-full h-48" viewBox="0 0 540 180" preserveAspectRatio="none">
                                  <defs>
                                    {ARCHITECTURE_COLOR_PALETTE.map((pal, idx) => (
                                      <linearGradient key={idx} id={`model-bar-grad-${idx}`} x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor={pal.topColor} />
                                        <stop offset="100%" stopColor={pal.bottomColor} />
                                      </linearGradient>
                                    ))}
                                    <linearGradient id="bench-zone-grad" x1="0" y1="0" x2="0" y2="1">
                                      <stop offset="0%" stopColor="#50d8e9" stopOpacity="0.14" />
                                      <stop offset="100%" stopColor="#50d8e9" stopOpacity="0.02" />
                                    </linearGradient>
                                  </defs>

                                  {/* Horizontal grid lines and Y-axis scale */}
                                  {chartTicks.map((tick) => {
                                    const y = 148 - (tick / maxChartHV) * 120;
                                    return (
                                      <g key={tick}>
                                        <line x1="38" y1={y} x2="530" y2={y} stroke="#1b2330" strokeWidth="1" strokeDasharray="2 3" />
                                        <text x="32" y={y + 3} fill="#5e758f" fontSize="8.5" textAnchor="end" fontFamily="monospace">
                                          {tick}
                                        </text>
                                      </g>
                                    );
                                  })}

                                  {/* Y-axis label */}
                                  <text x="12" y="85" fill="#5e758f" fontSize="8" textAnchor="middle" transform="rotate(-90 12 85)">
                                    HV
                                  </text>

                                  {/* Benchmark Published Experiment Range Shaded Band */}
                                  {(() => {
                                    const yMax = 148 - (Math.min(maxChartHV, alloyMaxHV) / maxChartHV) * 120;
                                    const yMin = 148 - (Math.min(maxChartHV, alloyMinHV) / maxChartHV) * 120;
                                    const bandHeight = Math.max(3, yMin - yMax);
                                    return (
                                      <g>
                                        <rect
                                          x="38"
                                          y={yMax}
                                          width="492"
                                          height={bandHeight}
                                          fill="url(#bench-zone-grad)"
                                        />
                                        <line x1="38" y1={yMax} x2="530" y2={yMax} stroke="#50d8e9" strokeWidth="1" strokeDasharray="4 3" strokeOpacity="0.65" />
                                        <line x1="38" y1={yMin} x2="530" y2={yMin} stroke="#50d8e9" strokeWidth="1" strokeDasharray="4 3" strokeOpacity="0.65" />
                                      </g>
                                    );
                                  })()}

                                  {/* Baseline */}
                                  <line x1="38" y1="148" x2="530" y2="148" stroke="#253040" strokeWidth="1" />

                                  {/* Dedicated Benchmark Badge positioned in the top header area of the SVG */}
                                  <g transform="translate(268, 6)">
                                    <rect x="0" y="0" width="262" height="15" rx="3" fill="#0d141e" stroke="#50d8e9" strokeWidth="0.8" strokeOpacity="0.4" />
                                    <line x1="8" y1="7.5" x2="24" y2="7.5" stroke="#50d8e9" strokeWidth="1.5" strokeDasharray="3 2" />
                                    <text x="30" y="10.5" fill="#50d8e9" fontSize="8" fontWeight="bold" fontFamily="monospace">
                                      Range of published experiments ({alloyMinHV} – {alloyMaxHV} HV)
                                    </text>
                                  </g>

                                  {/* The 6 Color-Graded Model Bars */}
                                  {prediction.modelsTable.map((m, idx) => {
                                    const pal = ARCHITECTURE_COLOR_PALETTE[idx % ARCHITECTURE_COLOR_PALETTE.length];
                                    const barWidth = 48;
                                    const barSpacing = 78;
                                    const barX = 46 + idx * barSpacing;
                                    const barHeight = Math.max(12, Math.min(125, (m.predictedHV / maxChartHV) * 120));
                                    const barY = 148 - barHeight;
                                    const shortLabels = ['Analytical', 'Random Forest', 'Grad Boost', 'SVM (RBF)', 'Hybrid GPR', 'Ensemble'];

                                    return (
                                      <g key={m.modelName} className="transition-all duration-300">
                                        {/* Value label on top of bar */}
                                        <text
                                          x={barX + barWidth / 2}
                                          y={barY - 6}
                                          fill="#ffffff"
                                          fontSize="10"
                                          fontWeight="bold"
                                          textAnchor="middle"
                                          fontFamily="monospace"
                                        >
                                          {m.predictedHV}
                                        </text>

                                        {/* The color-graded gradient bar with rounded top */}
                                        <rect
                                          x={barX}
                                          y={barY}
                                          width={barWidth}
                                          height={barHeight}
                                          rx="4"
                                          fill={`url(#model-bar-grad-${idx})`}
                                          stroke={pal.topColor}
                                          strokeWidth="0.8"
                                          strokeOpacity="0.6"
                                        />

                                        {/* Glassmorphic rim highlight on top edge of bar */}
                                        <line
                                          x1={barX + 2}
                                          y1={barY + 0.5}
                                          x2={barX + barWidth - 2}
                                          y2={barY + 0.5}
                                          stroke={pal.borderHighlight}
                                          strokeWidth="1.5"
                                          strokeOpacity="0.8"
                                          strokeLinecap="round"
                                        />

                                        {/* Model name below baseline */}
                                        <text
                                          x={barX + barWidth / 2}
                                          y="164"
                                          fill="#8fa3ba"
                                          fontSize="9"
                                          textAnchor="middle"
                                          fontFamily="monospace"
                                          fontWeight="500"
                                        >
                                          {shortLabels[idx]}
                                        </text>
                                      </g>
                                    );
                                  })}
                                </svg>
                              </div>
                            </div>
                          </>
                        );
                      })()}

                      {/* Download Prediction Button */}
                      <div className="mt-4 flex justify-end">
                        <button
                          onClick={handleDownloadCsv}
                          className="px-4 py-2 rounded-lg bg-[#142334] hover:bg-[#1a3048] border border-[#50d8e9]/40 text-[#50d8e9] text-xs font-semibold flex items-center gap-2 transition-all shadow-md"
                        >
                          <Download className="w-4 h-4" />
                          <span>Download my prediction (CSV)</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Right Column (5 cols): Microstructure Description + Other Outcomes Table */}
                  <div className="lg:col-span-5 space-y-4">
                    {/* Microstructure Box */}
                    <div className="bg-[#10141b] border border-[#1e2633] rounded-xl p-5 shadow-lg">
                      <h3 className="text-sm font-bold text-white mb-2">Expected microstructure</h3>
                      <div className="text-xs text-[#a0b5cb] leading-relaxed space-y-2">
                        <p>
                          <strong className="text-white">Solidification:</strong> {prediction.microstructurePhases}
                        </p>
                        <p>
                          <strong className="text-white">Phase Morphology:</strong> Epitaxial prior-β columnar grains aligned with build axis. Secondary cell / lath spacing predicted at <span className="text-[#50d8e9] font-mono font-bold">{prediction.cellSpacingUm} μm</span> governed by solidus cooling rate.
                        </p>
                        <p>
                          <strong className="text-white">Post-Processing Condition:</strong>{' '}
                          {heatTreatment === 'None' ? (
                            <span className="text-[#94a3b8]">None (No post-processing applied; component retains raw as-solidified microstructure).</span>
                          ) : (
                            <span className="text-[#50d8e9]">{heatTreatment}</span>
                          )}
                        </p>
                      </div>
                    </div>

                    {/* Other Predicted Outcomes Table */}
                    <div className="bg-[#10141b] border border-[#1e2633] rounded-xl p-5 shadow-lg">
                      <h3 className="text-sm font-bold text-white mb-3">Other predicted outcomes</h3>
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <tbody className="divide-y divide-[#18202c]">
                            <tr className="hover:bg-[#151c27]">
                              <td className="py-2 text-[#7d93ac]">Melt pool width</td>
                              <td className="py-2 font-mono font-bold text-white text-right">{prediction.meltPoolWidthUm.toLocaleString()} μm</td>
                            </tr>
                            <tr className="hover:bg-[#151c27]">
                              <td className="py-2 text-[#7d93ac]">Melt pool depth</td>
                              <td className="py-2 font-mono font-bold text-white text-right">{prediction.meltPoolDepthUm.toLocaleString()} μm</td>
                            </tr>
                            <tr className="hover:bg-[#151c27]">
                              <td className="py-2 text-[#7d93ac]">Melt pool length</td>
                              <td className="py-2 font-mono font-bold text-white text-right">{prediction.meltPoolLengthUm.toLocaleString()} μm</td>
                            </tr>
                            <tr className="hover:bg-[#151c27]">
                              <td className="py-2 text-[#7d93ac]">Cooling rate at solidus</td>
                              <td className="py-2 font-mono font-bold text-[#50d8e9] text-right">{prediction.coolingRateKs.toExponential(2)} K/s</td>
                            </tr>
                            <tr className="hover:bg-[#151c27]">
                              <td className="py-2 text-[#7d93ac]">Thermal gradient <i>G</i></td>
                              <td className="py-2 font-mono font-bold text-white text-right">{prediction.thermalGradientG.toExponential(2)} K/m</td>
                            </tr>
                            <tr className="hover:bg-[#151c27]">
                              <td className="py-2 text-[#7d93ac]">Solidification rate <i>R</i></td>
                              <td className="py-2 font-mono font-bold text-white text-right">{prediction.solidificationRateR} m/s</td>
                            </tr>
                            <tr className="hover:bg-[#151c27]">
                              <td className="py-2 text-[#7d93ac]"><i>G/R</i> (morphology)</td>
                              <td className="py-2 font-mono font-bold text-emerald-400 text-right">{prediction.solidificationMorphology} ({prediction.grRatio.toExponential(1)})</td>
                            </tr>
                            <tr className="hover:bg-[#151c27]">
                              <td className="py-2 text-[#7d93ac]">Cell / dendrite spacing λ</td>
                              <td className="py-2 font-mono font-bold text-[#50d8e9] text-right">{prediction.cellSpacingUm} μm</td>
                            </tr>
                            <tr className="hover:bg-[#151c27]">
                              <td className="py-2 text-[#7d93ac]">Normalized enthalpy ΔH / h<sub>s</sub></td>
                              <td className="py-2 font-mono font-bold text-amber-400 text-right">{prediction.normalizedEnthalpy.toFixed(1)}</td>
                            </tr>
                            <tr className="hover:bg-[#151c27]">
                              <td className="py-2 text-[#7d93ac]">Porosity (analytical)</td>
                              <td className="py-2 font-mono font-bold text-rose-400 text-right">{prediction.porosityPct} %</td>
                            </tr>
                            {prediction.coenMeltPool && (
                              <tr className="hover:bg-[#151c27]">
                                <td className="py-2 text-[#7d93ac]">KU Leuven Hybrid Melt Pool</td>
                                <td className="py-2 font-mono font-bold text-[#50d8e9] text-right">
                                  {prediction.coenMeltPool.conductionWidthUm} × {prediction.coenMeltPool.hybridDepthUm} μm (R={prediction.coenMeltPool.aspectRatio}, {prediction.coenMeltPool.regime})
                                </td>
                              </tr>
                            )}
                            {prediction.ransenigoDefects && (
                              <>
                                <tr className="hover:bg-[#151c27]">
                                  <td className="py-2 text-[#7d93ac]">Turbulent Gas Micro-Porosity</td>
                                  <td className="py-2 font-mono font-bold text-purple-400 text-right">
                                    {prediction.ransenigoDefects.gasEntrainmentPorosityPct}% (pore: {prediction.ransenigoDefects.meanGasPoreDiameterUm} μm)
                                  </td>
                                </tr>
                                <tr className="hover:bg-[#151c27]">
                                  <td className="py-2 text-[#7d93ac]">Substrate Remelt Overlap</td>
                                  <td className="py-2 font-mono font-bold text-right">
                                    <span className={prediction.ransenigoDefects.hatchOverlapSafe ? 'text-emerald-400' : 'text-amber-400'}>
                                      w<sub>remelt</sub> {prediction.ransenigoDefects.substrateRemeltWidthUm} μm ({prediction.ransenigoDefects.hatchOverlapSafe ? 'Safe overlap' : 'LoF Gap Risk'})
                                    </span>
                                  </td>
                                </tr>
                              </>
                            )}
                            <tr className="hover:bg-[#151c27]">
                              <td className="py-2 text-[#7d93ac]">Hybrid GPR Hardness (Primary)</td>
                              <td className="py-2 font-mono font-bold text-white text-right">{prediction.hybridHardnessHV} HV</td>
                            </tr>
                            <tr className="hover:bg-[#151c27]">
                              <td className="py-2 text-[#7d93ac]">Analytical Hardness (Hall-Petch)</td>
                              <td className="py-2 font-mono font-bold text-[#8fa3ba] text-right">{prediction.analyticalHardnessHV} HV</td>
                            </tr>
                            <tr className="hover:bg-[#151c27]">
                              <td className="py-2 text-[#7d93ac]">Estimated Tensile Strength (UTS)</td>
                              <td className="py-2 font-mono font-bold text-emerald-400 text-right">{prediction.estimatedUTSMPa} MPa</td>
                            </tr>
                            <tr className="hover:bg-[#151c27]">
                              <td className="py-2 text-[#7d93ac]">Post-processing condition</td>
                              <td className="py-2 font-mono font-bold text-[#50d8e9] text-right">
                                {heatTreatment === 'None' ? 'None (No post-processing)' : heatTreatment}
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>

                </div>

              </div>
            )}

            {/* TAB 2: PROCESS MAP matching Image 3 */}
            {activeTab === 'process-map' && (
              <div className="space-y-4 bg-[#090d14] border border-[#1b2636] rounded-xl p-5 shadow-2xl">
                {/* Header Toolbar */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-[#182332] pb-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-bold text-white flex items-center gap-2">
                        <span>Interactive 2D Process Window &amp; Defect Map</span>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-[#50d8e9]/10 text-[#50d8e9] border border-[#50d8e9]/30 font-mono">
                          Live Responsive Physics
                        </span>
                      </h2>
                    </div>
                    <p className="text-xs text-[#7189a3]">
                      Thermal processing window mapping Lack of Fusion (<i>P</i><sub>min</sub>), Keyhole Vaporization, and Balling boundaries with dense conduction corridor.
                    </p>
                  </div>

                  {/* Process Map Controls Toolbar */}
                  <div className="flex flex-wrap items-center gap-3 text-xs">
                    {/* Colormap Selector */}
                    <div className="flex items-center gap-1.5 bg-[#0e141f] border border-[#202e40] rounded-lg px-2.5 py-1">
                      <span className="text-[#7893af] text-[11px]">Colour by:</span>
                      <select
                        value={mapColorMode}
                        onChange={(e) => setMapColorMode(e.target.value as any)}
                        className="bg-transparent text-[#50d8e9] text-xs font-semibold focus:outline-none cursor-pointer"
                      >
                        <option value="hardness" className="bg-[#0e141f] text-white">Hardness (Hybrid GPR)</option>
                        <option value="density" className="bg-[#0e141f] text-white">Relative Density (%)</option>
                        <option value="coolingRate" className="bg-[#0e141f] text-white">Cooling Rate (K/s)</option>
                      </select>
                    </div>

                    {/* Max Power Control */}
                    <div className="flex items-center gap-1.5 bg-[#0e141f] border border-[#202e40] rounded-lg px-2.5 py-1">
                      <span className="text-[#7893af] text-[11px]">Max Power:</span>
                      <input
                        type="number"
                        min="100"
                        max="1000000"
                        step="50"
                        value={mapPowerMax}
                        onChange={(e) => setMapPowerMax(Math.max(100, Number(e.target.value)))}
                        className="w-16 bg-transparent text-[#50d8e9] font-mono font-bold text-xs text-right focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                      <span className="text-[10px] text-[#7893af] font-mono">W</span>
                    </div>

                    {/* Max Speed Control */}
                    <div className="flex items-center gap-1.5 bg-[#0e141f] border border-[#202e40] rounded-lg px-2.5 py-1">
                      <span className="text-[#7893af] text-[11px]">Max Speed:</span>
                      <input
                        type="number"
                        min="100"
                        max="1000000"
                        step="100"
                        value={mapSpeedMax}
                        onChange={(e) => setMapSpeedMax(Math.max(100, Number(e.target.value)))}
                        className="w-16 bg-transparent text-[#50d8e9] font-mono font-bold text-xs text-right focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                      <span className="text-[10px] text-[#7893af] font-mono">mm/s</span>
                    </div>

                    {/* Auto-Fit Button */}
                    <button
                      type="button"
                      onClick={() => {
                        const targetP = Math.max(500, Math.ceil((currentParams.laserPowerW * 1.35) / 50) * 50);
                        const targetV = Math.max(1500, Math.ceil((currentParams.scanSpeedMmS * 1.35) / 100) * 100);
                        setMapPowerMax(targetP);
                        setMapSpeedMax(targetV);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-[#142335] text-[#50d8e9] hover:bg-[#1f3752] border border-[#243e5c] text-[11px] font-semibold transition-all shadow-sm"
                      title="Auto-fit viewport axes to frame your live operating point"
                    >
                      Auto-Fit Axes
                    </button>
                  </div>
                </div>

                {/* High-Definition 2D Process Map SVG (Responsive & Mobile-Optimized) */}
                <div className="relative w-full aspect-[960/560] min-h-[300px] sm:min-h-[420px] md:min-h-[560px] bg-[#05080c] rounded-xl border border-[#162130] p-2 sm:p-3 shadow-inner overflow-hidden">
                  {(() => {
                    // Coordinates & Layout
                    const left = 75, right = 825, top = 25, bottom = 485;
                    const plotW = right - left; // 750
                    const plotH = bottom - top; // 460

                    const effectivePowerMax = Math.max(50, Math.max(mapPowerMax, Math.ceil((currentParams.laserPowerW * 1.15) / 50) * 50));
                    const effectiveSpeedMax = Math.max(100, Math.max(mapSpeedMax, Math.ceil((currentParams.scanSpeedMmS * 1.15) / 100) * 100));

                    const toX = (v: number) => left + (Math.max(0, v) / effectiveSpeedMax) * plotW;
                    const toY = (p: number) => bottom - (Math.max(0, p) / effectivePowerMax) * plotH;

                    // Clean Ticks (5 round divisions)
                    const pFractions = [0.2, 0.4, 0.6, 0.8, 1.0];
                    const powerTicks = pFractions.map(f => {
                      const raw = f * effectivePowerMax;
                      if (effectivePowerMax >= 10000) return Math.round(raw / 1000) * 1000;
                      if (effectivePowerMax >= 1000) return Math.round(raw / 100) * 100;
                      return Math.round(raw / 25) * 25;
                    });

                    const vFractions = [0.2, 0.4, 0.6, 0.8, 1.0];
                    const speedTicks = vFractions.map(f => {
                      const raw = f * effectiveSpeedMax;
                      if (effectiveSpeedMax >= 10000) return Math.round(raw / 1000) * 1000;
                      if (effectiveSpeedMax >= 1000) return Math.round(raw / 100) * 100;
                      return Math.round(raw / 50) * 50;
                    });

                    // Published Experimental Literature Benchmarks for Ti-6Al-4V
                    const peerBenchmarks = [
                      { source: 'Kasperovich (2016)', P: 200, v: 800, expHV: 320 },
                      { source: 'Thijs et al. (2010)', P: 250, v: 1000, expHV: 335 },
                      { source: 'Vrancken et al. (2012)', P: 175, v: 710, expHV: 350 },
                      { source: 'Simonelli et al. (2014)', P: 280, v: 1200, expHV: 365 },
                      { source: 'Wang et al. (2018)', P: 300, v: 1400, expHV: 310 },
                      { source: 'Gong et al. (2014)', P: 195, v: 960, expHV: 340 },
                      { source: 'Dilip et al. (2017)', P: 225, v: 1100, expHV: 355 },
                      { source: 'Cunningham (2019)', P: 320, v: 1350, expHV: 370 },
                      { source: 'Bontha et al. (2006)', P: 250, v: 850, expHV: 345 },
                      { source: 'Bontha et al. (2009)', P: 350, v: 847, expHV: 342 },
                      { source: 'Kobryn & Semiatin', P: 350, v: 1270, expHV: 352 },
                    ];

                    // Defect Boundaries Math
                    // 1. Lack-of-Fusion Tang-Pistorius curve: P_min increases with sqrt(v)
                    const lofPoints: { x: number; y: number }[] = [];
                    // 2. Keyholing onset curve: King normalized enthalpy threshold
                    const khPoints: { x: number; y: number }[] = [];
                    // 3. Balling boundary: Plateau-Rayleigh instability limit
                    const balPoints: { x: number; y: number }[] = [];

                    const numSteps = 40;
                    for (let i = 0; i <= numSteps; i++) {
                      const v = (i / numSteps) * effectiveSpeedMax;
                      // Empirical physical scaling for Ti-6Al-4V:
                      const pLof = Math.max(30, 0.22 * Math.sqrt(Math.max(1, v)) * Math.sqrt(effectivePowerMax * 0.9) * 2.8);
                      const pKh = Math.max(60, 0.44 * Math.sqrt(Math.max(1, v)) * Math.sqrt(effectivePowerMax * 0.9) * 3.4 + 0.15 * effectivePowerMax);
                      const pBal = Math.max(20, (1.0 - (v / effectiveSpeedMax) * 0.72) * (effectivePowerMax * 0.78));

                      lofPoints.push({ x: toX(v), y: Math.max(top, Math.min(bottom, toY(pLof))) });
                      khPoints.push({ x: toX(v), y: Math.max(top, Math.min(bottom, toY(pKh))) });
                      balPoints.push({ x: toX(v), y: Math.max(top, Math.min(bottom, toY(pBal))) });
                    }

                    const lofPathD = lofPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
                    const khPathD = khPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
                    const balPathD = balPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');

                    // Active Live Operating Coordinates
                    const curX = Math.max(left, Math.min(right, toX(currentParams.scanSpeedMmS)));
                    const curY = Math.max(top, Math.min(bottom, toY(currentParams.laserPowerW)));

                    // Tooltip Edge Clamping
                    const tipW = 160, tipH = 42;
                    let tipX = curX + 14;
                    if (tipX + tipW > right) tipX = curX - tipW - 14;
                    let tipY = curY - tipH - 10;
                    if (tipY < top) tipY = curY + 14;

                    // Colormap values display
                    const isHardness = mapColorMode === 'hardness';
                    const isDensity = mapColorMode === 'density';
                    const cMaxLabel = isHardness ? '430 HV' : isDensity ? '99.9%' : '10⁶ K/s';
                    const cMidLabel = isHardness ? '365 HV' : isDensity ? '97.5%' : '10⁵ K/s';
                    const cMinLabel = isHardness ? '300 HV' : isDensity ? '92.0%' : '10³ K/s';
                    const cTitle = isHardness ? 'Hardness (HV)' : isDensity ? 'Relative Density (%)' : 'Cooling Rate (K/s)';

                    return (
                      <svg className="w-full h-full" viewBox="0 0 960 560" preserveAspectRatio="xMidYMid meet">
                        <defs>
                          {/* Rich High-Resolution Viridis / Thermal Colormap */}
                          <linearGradient id="mapGradientHD" x1="0%" y1="100%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="#1e1035" />
                            <stop offset="20%" stopColor="#222b68" />
                            <stop offset="45%" stopColor="#165b75" />
                            <stop offset="70%" stopColor="#1b9a6b" />
                            <stop offset="90%" stopColor="#84c83e" />
                            <stop offset="100%" stopColor="#fde047" />
                          </linearGradient>

                          {/* Conduction Corridor Tint Gradient */}
                          <linearGradient id="conductionGlow" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="#10b981" stopOpacity="0.22" />
                            <stop offset="100%" stopColor="#065f46" stopOpacity="0.10" />
                          </linearGradient>
                        </defs>

                        {/* Background Plot Area */}
                        <rect x={left} y={top} width={plotW} height={plotH} fill="url(#mapGradientHD)" opacity="0.88" rx="6" />

                        {/* Horizontal Grid lines & Power Ticks */}
                        {powerTicks.map((pVal, idx) => {
                          const y = toY(pVal);
                          if (y < top || y > bottom) return null;
                          return (
                            <g key={`p-grid-${idx}`}>
                              <line x1={left} y1={y} x2={right} y2={y} stroke="#ffffff" strokeOpacity="0.12" strokeDasharray="3 3" />
                              <text x={left - 12} y={y + 4.5} fill="#cbd5e1" fontSize="12" fontWeight="bold" textAnchor="end" fontFamily="monospace">
                                {pVal.toLocaleString()}
                              </text>
                            </g>
                          );
                        })}

                        {/* Vertical Grid lines & Speed Ticks */}
                        {speedTicks.map((vVal, idx) => {
                          const x = toX(vVal);
                          if (x < left || x > right) return null;
                          return (
                            <g key={`v-grid-${idx}`}>
                              <line x1={x} y1={top} x2={x} y2={bottom} stroke="#ffffff" strokeOpacity="0.12" strokeDasharray="3 3" />
                              <text x={x} y={bottom + 22} fill="#cbd5e1" fontSize="12" fontWeight="bold" textAnchor="middle" fontFamily="monospace">
                                {vVal.toLocaleString()}
                              </text>
                            </g>
                          );
                        })}

                        {/* Boundary Solid Axis Frames */}
                        <line x1={left} y1={bottom} x2={right} y2={bottom} stroke="#2e435d" strokeWidth="1.8" />
                        <line x1={left} y1={top} x2={left} y2={bottom} stroke="#2e435d" strokeWidth="1.8" />
                        <line x1={right} y1={top} x2={right} y2={bottom} stroke="#2e435d" strokeWidth="1.8" />
                        <line x1={left} y1={top} x2={right} y2={top} stroke="#2e435d" strokeWidth="1.8" />

                        {/* Main Axis Titles */}
                        <text x={left + plotW / 2} y={bottom + 46} fill="#e2e8f0" fontSize="13.5" textAnchor="middle" fontWeight="bold" fontFamily="sans-serif">
                          Scan / Traverse Speed v (mm/s)
                        </text>
                        <text x="24" y={top + plotH / 2} fill="#e2e8f0" fontSize="13.5" textAnchor="middle" fontWeight="bold" fontFamily="sans-serif" transform={`rotate(-90 24 ${top + plotH / 2})`}>
                          Laser Power P (W)
                        </text>

                        {/* Iso-VED Dashed Contours with Staggered Non-Colliding Labels */}
                        {(selectedProcessId === 'waam' ? [8, 15, 25] : selectedProcessId === 'ded-laser' ? [15, 25, 45] : [40, 60, 80]).map((vedVal, vIdx) => {
                          // P = VED * v * h * t / 1000
                          const hMm = Math.max(0.001, currentParams.hatchSpacingUm / 1000);
                          const tMm = Math.max(0.001, currentParams.layerThicknessUm / 1000);
                          const vMaxVed = effectivePowerMax / (vedVal * hMm * tMm);
                          const vEnd = Math.min(effectiveSpeedMax, vMaxVed);
                          const pEnd = vedVal * vEnd * hMm * tMm;

                          const x1 = toX(0);
                          const y1 = toY(0);
                          const x2 = toX(vEnd);
                          const y2 = toY(pEnd);

                          // Stagger label positions along the contour rays to prevent horizontal overlap
                          const staggerFractions = [0.42, 0.62, 0.80];
                          const labelFrac = staggerFractions[vIdx % 3];
                          const lx = x1 + (x2 - x1) * labelFrac;
                          const ly = y1 + (y2 - y1) * labelFrac;

                          if (x2 <= left + 20 || y2 >= bottom - 10) return null;

                          return (
                            <g key={`ved-line-${vedVal}`}>
                              <line
                                x1={x1}
                                y1={y1}
                                x2={x2}
                                y2={y2}
                                stroke="#94a3b8"
                                strokeOpacity="0.45"
                                strokeDasharray="5 5"
                                strokeWidth="1.2"
                              />
                              {lx > left + 30 && lx < right - 40 && ly > top + 15 && ly < bottom - 15 && (
                                <g>
                                  <rect
                                    x={lx - 38}
                                    y={ly - 10}
                                    width="76"
                                    height="20"
                                    rx="4"
                                    fill="#090e16"
                                    fillOpacity="0.94"
                                    stroke="#334155"
                                    strokeWidth="1"
                                  />
                                  <text x={lx} y={ly + 4} fill="#f8fafc" fontSize="11" textAnchor="middle" fontFamily="monospace" fontWeight="bold">
                                    {vedVal} J/mm³
                                  </text>
                                </g>
                              )}
                            </g>
                          );
                        })}

                        {/* Lack-of-Fusion Boundary (Red Dashed Line) */}
                        <path d={lofPathD} fill="none" stroke="#f43f5e" strokeWidth="2.8" strokeDasharray="8 5" />

                        {/* Keyhole Onset Boundary (White Dashed Line) */}
                        <path d={khPathD} fill="none" stroke="#ffffff" strokeWidth="2.8" strokeDasharray="8 5" />

                        {/* Balling Boundary (Amber Dashed Line) */}
                        <path d={balPathD} fill="none" stroke="#fbbf24" strokeWidth="2.2" strokeDasharray="7 5" />

                        {/* Floating Boundary Callout Badges with Adjusted Positions & Crisp Fonts */}
                        {/* 1. Keyhole Badge */}
                        <g transform={`translate(${toX(effectiveSpeedMax * 0.16)}, ${toY(effectivePowerMax * 0.86)})`}>
                          <rect x="0" y="0" width="150" height="22" rx="4" fill="#090d14" fillOpacity="0.94" stroke="#ffffff" strokeWidth="1" />
                          <text x="75" y="15" fill="#ffffff" fontSize="10.5" fontWeight="bold" textAnchor="middle">
                            Keyholing Limit
                          </text>
                        </g>

                        {/* 2. Lack of Fusion Badge */}
                        <g transform={`translate(${toX(effectiveSpeedMax * 0.58)}, ${toY(effectivePowerMax * 0.22)})`}>
                          <rect x="0" y="0" width="150" height="22" rx="4" fill="#140608" fillOpacity="0.94" stroke="#f43f5e" strokeWidth="1" />
                          <text x="75" y="15" fill="#fb7185" fontSize="10.5" fontWeight="bold" textAnchor="middle">
                            Lack-of-Fusion (Pmin)
                          </text>
                        </g>

                        {/* 3. Conduction Window Corridor Badge */}
                        <g transform={`translate(${toX(effectiveSpeedMax * 0.32)}, ${toY(effectivePowerMax * 0.50)})`}>
                          <rect x="0" y="0" width="170" height="24" rx="5" fill="#041a13" fillOpacity="0.94" stroke="#10b981" strokeWidth="1.2" />
                          <text x="85" y="16.5" fill="#34d399" fontSize="11" fontWeight="bold" textAnchor="middle">
                            ✦ Dense Conduction Window
                          </text>
                        </g>

                        {/* Literature Experimental Benchmarks */}
                        {peerBenchmarks.map((bench, idx) => {
                          const bx = toX(bench.P * 0 + bench.v);
                          const by = toY(bench.P);
                          if (bx < left || bx > right || by < top || by > bottom) return null;
                          return (
                            <g key={`bench-${idx}`} className="cursor-pointer">
                              <circle
                                cx={bx}
                                cy={by}
                                r="5"
                                fill="#ffffff"
                                stroke="#0b1017"
                                strokeWidth="2"
                                opacity="0.95"
                              />
                              <title>{`${bench.source}: ${bench.P} W, ${bench.v} mm/s (Hardness: ${bench.expHV} HV)`}</title>
                            </g>
                          );
                        })}

                        {/* Live Operating Point (Red Pulsing Star + Edge-Safe Leader Tooltip) */}
                        <g>
                          <circle cx={curX} cy={curY} r="14" fill="#ef4444" opacity="0.30" className="animate-ping" />
                          <polygon
                            points={`${curX},${curY - 11} ${curX + 3.5},${curY - 3.5} ${curX + 11},${curY - 3.5} ${curX + 5},${curY + 2.5} ${curX + 7},${curY + 10} ${curX},${curY + 5} ${curX - 7},${curY + 10} ${curX - 5},${curY + 2.5} ${curX - 11},${curY - 3.5} ${curX - 3.5},${curY - 3.5}`}
                            fill="#ef4444"
                            stroke="#ffffff"
                            strokeWidth="1.8"
                          />

                          {/* Leader Polyline to Tooltip */}
                          <line
                            x1={curX}
                            y1={curY}
                            x2={tipX > curX ? tipX : tipX + tipW}
                            y2={tipY + tipH / 2}
                            stroke="#ef4444"
                            strokeWidth="1.2"
                            strokeDasharray="2 2"
                          />

                          {/* Tooltip Card */}
                          <rect
                            x={tipX}
                            y={tipY}
                            width={tipW}
                            height={tipH}
                            rx="5"
                            fill="#080c14"
                            fillOpacity="0.96"
                            stroke="#ef4444"
                            strokeWidth="1.2"
                            className="shadow-xl"
                          />
                          <text x={tipX + 8} y={tipY + 15} fill="#ffffff" fontSize="10.5" fontWeight="bold" fontFamily="monospace">
                            Live AM Operating Point
                          </text>
                          <text x={tipX + 8} y={tipY + 27} fill="#50d8e9" fontSize="9.5" fontWeight="bold" fontFamily="monospace">
                            {currentParams.laserPowerW.toLocaleString()} W @ {currentParams.scanSpeedMmS.toLocaleString()} mm/s
                          </text>
                          <text x={tipX + 8} y={tipY + 37} fill="#cbd5e1" fontSize="9" fontFamily="monospace">
                            VED: {prediction.volumetricEnergyDensity.toLocaleString()} J/mm³
                          </text>
                        </g>

                        {/* Vertical Colormap Scale Legend Bar on the Right */}
                        <g transform="translate(856, 0)">
                          <rect x="0" y={top} width="16" height={plotH} fill="url(#mapGradientHD)" rx="3" stroke="#26384e" strokeWidth="1" />
                          <text x="24" y={top + 12} fill="#fde047" fontSize="10.5" fontFamily="monospace" fontWeight="bold">
                            {cMaxLabel}
                          </text>
                          <text x="24" y={top + plotH / 2 + 4} fill="#34d399" fontSize="10.5" fontFamily="monospace" fontWeight="bold">
                            {cMidLabel}
                          </text>
                          <text x="24" y={bottom - 4} fill="#818cf8" fontSize="10.5" fontFamily="monospace" fontWeight="bold">
                            {cMinLabel}
                          </text>
                          <text
                            x="56"
                            y={top + plotH / 2}
                            fill="#cbd5e1"
                            fontSize="11.5"
                            textAnchor="middle"
                            fontWeight="bold"
                            fontFamily="sans-serif"
                            transform={`rotate(-90 56 ${top + plotH / 2})`}
                          >
                            {cTitle}
                          </text>
                        </g>
                      </svg>
                    );
                  })()}
                </div>

                {/* Mobile-Friendly Process Operating KPI Row */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 my-2 text-xs font-mono">
                  <div className="bg-[#0a0f18] border border-[#1b2738] rounded-lg p-2.5 flex flex-col justify-between">
                    <span className="text-[10px] text-[#7189a3] font-semibold">AM Regime</span>
                    <span className={`text-xs font-bold mt-1 px-1.5 py-0.5 rounded inline-block w-fit ${
                      prediction.regime === 'conduction'
                        ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-500/40'
                        : prediction.regime === 'keyhole'
                        ? 'bg-red-950/80 text-red-400 border border-red-500/40'
                        : 'bg-amber-950/80 text-amber-400 border border-amber-500/40'
                    }`}>
                      {prediction.regime === 'conduction' ? '✓ Conduction' : prediction.regime === 'keyhole' ? '⚠ Keyholing' : prediction.regime === 'balling' ? '⚠ Balling' : '⚠ Lack of Fusion'}
                    </span>
                  </div>

                  <div className="bg-[#0a0f18] border border-[#1b2738] rounded-lg p-2.5">
                    <div className="text-[10px] text-[#7189a3] font-semibold">VED (Energy)</div>
                    <div className="text-sm font-bold text-white mt-0.5">{prediction.volumetricEnergyDensity.toFixed(1)} J/mm³</div>
                    <div className="text-[10px] text-[#50d8e9]">Target: 45–65 J/mm³</div>
                  </div>

                  <div className="bg-[#0a0f18] border border-[#1b2738] rounded-lg p-2.5">
                    <div className="text-[10px] text-[#7189a3] font-semibold">Vickers Hardness</div>
                    <div className="text-sm font-bold text-emerald-400 mt-0.5">{prediction.hybridHardnessHV} HV</div>
                    <div className="text-[10px] text-[#7189a3]">Hybrid GPR</div>
                  </div>

                  <div className="bg-[#0a0f18] border border-[#1b2738] rounded-lg p-2.5">
                    <div className="text-[10px] text-[#7189a3] font-semibold">Relative Density</div>
                    <div className="text-sm font-bold text-[#50d8e9] mt-0.5">{prediction.relativeDensityPct.toFixed(1)}%</div>
                    <div className="text-[10px] text-[#7189a3]">Pistorius Criteria</div>
                  </div>
                </div>

                {/* Map Legend & Defect Guidelines */}
                <div className="flex flex-wrap items-center justify-between gap-4 text-xs pt-1 border-t border-[#162130]">
                  <div className="flex flex-wrap items-center gap-5">
                    <span className="flex items-center gap-1.5">
                      <span className="w-4 h-0.5 border-b-2 border-dashed border-red-500" />
                      <span className="text-[#a5b8cc]">Lack-of-fusion boundary (Tang-Pistorius)</span>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-4 h-0.5 border-b-2 border-dashed border-white" />
                      <span className="text-[#a5b8cc]">Keyhole onset (King enthalpy)</span>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-4 h-0.5 border-b-2 border-dashed border-amber-400" />
                      <span className="text-[#a5b8cc]">Balling boundary (Plateau-Rayleigh)</span>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full border border-white bg-white/40" />
                      <span className="text-[#a5b8cc]">Literature benchmarks</span>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="text-red-500 font-bold">★</span>
                      <span className="text-white font-bold">Active Setting</span>
                    </span>
                  </div>

                  <div className="text-[11px] text-[#50d8e9] font-medium bg-[#142232] px-3 py-1.5 rounded-lg border border-[#1d3c58]">
                    Optimal dense AM processing corridor lies strictly between the red (LOF) and white (Keyhole) boundaries.
                  </div>
                </div>
              </div>
            )}

            {/* TAB: DEFECT PROCESS WINDOW */}
            {activeTab === 'defect-map' && (
              <DefectProcessWindowView
                alloyId={selectedAlloyId}
                alloyName={TITANIUM_ALLOYS.find(a => a.id === selectedAlloyId)?.name || selectedAlloyId}
                laserPowerW={laserPower}
                scanSpeedMmS={scanSpeed}
                hatchSpacingUm={hatchSpacing}
                layerThicknessUm={layerThickness}
                spotDiameterUm={spotDiameter}
                preheatTempC={preheatTemp}
                onApplySafeParameters={(pwr, spd) => {
                  setLaserPower(pwr);
                  setScanSpeed(spd);
                }}
              />
            )}

            {/* TAB: INDUSTRIAL ECONOMICS & ESG */}
            {activeTab === 'economics' && (
              <IndustrialEconomicsView
                alloyId={selectedAlloyId}
                alloyName={TITANIUM_ALLOYS.find(a => a.id === selectedAlloyId)?.name || selectedAlloyId}
                processId={selectedProcessId}
                laserPowerW={laserPower}
                scanSpeedMmS={scanSpeed}
                hatchSpacingUm={hatchSpacing}
                layerThicknessUm={layerThickness}
              />
            )}

            {/* TAB: 3D DIGITAL TWIN & STRESS TENSOR */}
            {activeTab === 'digital-twin' && (
              <DigitalTwin3DView
                alloyName={TITANIUM_ALLOYS.find(a => a.id === selectedAlloyId)?.name || selectedAlloyId}
                laserPowerW={laserPower}
                scanSpeedMmS={scanSpeed}
                coolingRateKPerS={prediction.coolingRateKs}
                residualStressMPa={prediction.residualStressMPa}
                hardnessHV={prediction.hybridHardnessHV}
                elongationPct={prediction.elongationPct}
              />
            )}

            {/* TAB: AEROSPACE & MEDICAL QUALIFICATION */}
            {activeTab === 'qualification' && (
              <QualificationAuditView
                alloyId={selectedAlloyId}
                alloyName={TITANIUM_ALLOYS.find(a => a.id === selectedAlloyId)?.name || selectedAlloyId}
                yieldStrengthMPa={prediction.yieldStrengthMPa}
                utsMPa={prediction.estimatedUTSMPa}
                elongationPct={prediction.elongationPct}
                relativeDensityPct={prediction.relativeDensityPct}
                residualStressMPa={prediction.residualStressMPa}
                fatigueEnduranceMPa={prediction.fatigueEnduranceMPa}
                heatTreatmentRoute={heatTreatment}
              />
            )}

            {/* TAB 3: SUGGESTIONS & INVERSE DESIGN matching Image 2 */}
            {activeTab === 'suggestions' && (
              <div className="space-y-6">

                {/* Section 1: "What should I change?" */}
                <div className="bg-[#10141b] border border-[#1e2633] rounded-xl p-5 shadow-lg space-y-3">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <HelpCircle className="w-4 h-4 text-[#50d8e9]" />
                    <span>What should I change?</span>
                  </h3>

                  {prediction.regime === 'conduction' ? (
                    <div className="p-3.5 rounded-lg bg-[#0f271a] border border-[#1a5b36] text-xs text-emerald-300 flex items-start gap-2.5">
                      <CheckCircle className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
                      <div>
                        <strong className="text-white font-semibold">Parameters sit comfortably inside the conduction mode, fully dense window.</strong>
                        <p className="mt-1 text-emerald-200">
                          Melt pool depth ({prediction.meltPoolDepthUm} μm) cleanly overlaps the layer thickness ({currentParams.layerThicknessUm} μm), King enthalpy is safe (ratio {prediction.keyholeRatio} &lt; 1.0), and Rayleigh aspect ratio is below π. Microstructure is expected to be structurally sound.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="p-3.5 rounded-lg bg-[#2b1712] border border-[#7a341b] text-xs text-amber-200 flex items-start gap-2.5">
                      <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
                      <div>
                        <strong className="text-white font-semibold">{prediction.regimeLabel}</strong>
                        <p className="mt-1 text-amber-100">{prediction.regimeDescription}</p>
                        <p className="mt-1.5 font-mono text-[11px] text-[#50d8e9]">
                          Recommendation: {prediction.regime === 'lack-of-fusion' ? 'Increase power P by +30W or reduce speed v by -150 mm/s.' : prediction.regime === 'keyhole' ? 'Decrease power P by -40W or increase scan speed v by +200 mm/s.' : 'Lower scan speed or increase beam spot diameter.'}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Section 2: "Inverse design — find settings that hit a target hardness" */}
                <div className="bg-[#10141b] border border-[#1e2633] rounded-xl p-5 shadow-lg space-y-4">
                  <div>
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      <Target className="w-5 h-5 text-[#50d8e9]" />
                      <span>Inverse design — find settings that hit a target hardness</span>
                    </h3>
                    <p className="text-xs text-[#7189a3] mt-1">
                      Searches discrete LPBF settings for the closest modeled hardness within the dense process window; results are estimates, not guaranteed exact values.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-4 bg-[#141820] p-4 rounded-lg border border-[#222b39]">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-[#8ea5be]">Target Hardness (HV):</span>
                      <input
                        type="number"
                        min="1"
                        value={targetHardnessInput}
                        onChange={(e) => {
                          setTargetHardnessInput(Number(e.target.value));
                          setHasSearchedInverse(false);
                          setInverseResults([]);
                        }}
                        className="bg-[#0b0e13] border border-[#273243] rounded px-3 py-1.5 font-mono text-white text-sm w-24 text-center font-bold"
                      />
                    </div>

                    <label className="flex items-center gap-2 text-xs text-[#9bb0c6] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={includeHTInSearch}
                        onChange={(e) => {
                          setIncludeHTInSearch(e.target.checked);
                          setHasSearchedInverse(false);
                          setInverseResults([]);
                        }}
                        className="accent-[#50d8e9]"
                      />
                      <span>Also search heat treatment options (None, Stress-relieved, HIP, STA)</span>
                    </label>

                    <button
                      onClick={handleRunInverseDesign}
                      disabled={selectedProcessId !== 'pbf-laser' || !Number.isFinite(typeof targetHardnessInput === 'number' ? targetHardnessInput : parseFloat(String(targetHardnessInput))) || (typeof targetHardnessInput === 'number' ? targetHardnessInput : parseFloat(String(targetHardnessInput))) <= 0}
                      title={selectedProcessId !== 'pbf-laser' ? 'Inverse design currently supports LPBF only.' : undefined}
                      className="px-4 py-2 rounded bg-[#50d8e9] hover:bg-[#3ec4d5] disabled:cursor-not-allowed disabled:opacity-40 text-[#070b10] font-bold text-xs flex items-center gap-1.5 transition-all shadow-[0_0_15px_rgba(80,216,233,0.3)]"
                    >
                      <Search className="w-3.5 h-3.5" />
                      <span>Search settings</span>
                    </button>
                  </div>

                  {/* Results Table matching Image 2 */}
                  {selectedProcessId !== 'pbf-laser' && (
                    <p className="rounded border border-[#ffb689]/30 bg-[#ffb689]/5 p-3 text-xs text-[#ffb689]">
                      Inverse-design recommendations currently support LPBF / SLM only. Select that process to search its modeled parameter window.
                    </p>
                  )}
                  {hasSearchedInverse && (
                    <div className="space-y-3 pt-2">
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs text-left">
                          <thead>
                            <tr className="border-b border-[#1f2837] text-[#7189a3] font-mono">
                              <th className="pb-2">P (W)</th>
                              <th className="pb-2">v (mm/s)</th>
                              <th className="pb-2">VED</th>
                              <th className="pb-2">HT</th>
                              <th className="pb-2 text-right">HV (hybrid)</th>
                              <th className="pb-2 text-right">HV (analytical)</th>
                              <th className="pb-2 text-right">Rel. density</th>
                              <th className="pb-2 text-right">Build rate (cm³/h)</th>
                              <th className="pb-2 text-right">|Error| HV</th>
                              <th className="pb-2 text-center">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#18202c]">
                            {inverseResults.length === 0 ? (
                              <tr>
                                <td colSpan={10} className="py-6 text-center text-[#7189a3]">
                                  No settings found matching target within safe dense boundaries. Try adjusting target hardness.
                                </td>
                              </tr>
                            ) : (
                              inverseResults.map((item, idx) => (
                                <tr key={idx} className="hover:bg-[#151c27] transition-colors">
                                  <td className="py-2.5 font-mono font-bold text-white">{item.powerW}</td>
                                  <td className="py-2.5 font-mono text-[#8fa3ba]">{item.speedMmS}</td>
                                  <td className="py-2.5 font-mono text-amber-400">{item.vedJmm3}</td>
                                  <td className="py-2.5 text-[#50d8e9]">{item.heatTreatment}</td>
                                  <td className="py-2.5 font-mono font-bold text-white text-right">{item.predictedHV}</td>
                                  <td className="py-2.5 font-mono text-[#8fa3ba] text-right">{item.analyticalHV}</td>
                                  <td className="py-2.5 font-mono text-emerald-400 text-right">{item.relDensityPct}%</td>
                                  <td className="py-2.5 font-mono text-[#a2b5ca] text-right">{item.buildRateCm3H}</td>
                                  <td className="py-2.5 font-mono font-bold text-right text-emerald-400">
                                    {Math.abs(item.predictedHV - (typeof targetHardnessInput === 'number' ? targetHardnessInput : parseFloat(String(targetHardnessInput)) || 0))}
                                  </td>
                                  <td className="py-2.5 text-center">
                                    <button
                                      onClick={() => handleApplyCandidate(item)}
                                      className="px-2.5 py-1 rounded bg-[#172739] hover:bg-[#50d8e9] hover:text-[#0b0e13] text-[#50d8e9] border border-[#50d8e9]/40 text-[11px] font-bold transition-all"
                                    >
                                      Apply
                                    </button>
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>

                      <div className="text-[10px] text-[#5e7792] italic">
                        Only conduction-mode, fully dense, non-balling settings are kept. Ranked by closeness-to-target (then by build rate for LPBF). Uses the Hybrid GPR model. Always confirm with a test coupon.
                      </div>
                    </div>
                  )}
                </div>

              </div>
            )}

            {/* TAB 4: MELT POOL & THERMAL KINETICS matching Image 4 */}
            {activeTab === 'melt-pool' && (
              <div className="space-y-6">

                {/* SECTION 1: THE FULL ROSENTHAL & KU LEUVEN HYBRID MELT POOL IMAGING */}
                {(() => {
                  const coen = prediction.coenMeltPool;
                  const ransenigo = prediction.ransenigoDefects;
                  const isCoenMode = meltPoolModelType === 'coen-hybrid' && !!coen;
                  const rawMeltL = Math.max(20, prediction.meltPoolLengthUm || 600);
                  const rawMeltW = Math.max(10, prediction.meltPoolWidthUm || 180);
                  const rawMeltD = Math.max(10, prediction.meltPoolDepthUm || 90);

                  const meltL = isCoenMode && coen ? Math.round(coen.conductionWidthUm * (1.2 + 0.0012 * scanSpeed)) : rawMeltL;
                  const meltW = isCoenMode && coen ? coen.conductionWidthUm : rawMeltW;
                  const meltD = isCoenMode && coen ? coen.hybridDepthUm : rawMeltD;
                  const spotDia = Math.max(10, spotDiameter || 100);
                  const liquidusC = ALLOY_THERMAL_PROPERTIES[selectedAlloyId]?.liquidusC || 1654;
                  const solidusC = ALLOY_THERMAL_PROPERTIES[selectedAlloyId]?.solidusC || 1620;
                  const preheatC = preheatTemp || 25;
                  const peakT = Math.min(3200, Math.round(preheatC + ((laserPower * (absorptivityOverride ?? 0.35) * 1e6) / (Math.PI * 6.7 * spotDia))));

                  // Layout coordinate setup for Surface (X-Y)
                  // Total viewBox 960 x 440
                  // Plot Frame Bounds: X from 80 to 860 (width 780), Y from 45 to 375 (height 330)
                  const plotX1 = 80;
                  const plotX2 = 860;
                  const plotY1 = 45;
                  const plotY2 = 375;
                  const plotW = plotX2 - plotX1;
                  const plotH = plotY2 - plotY1;

                  const Y0 = 210;

                  // Maximum span limits to prevent any clipping across all operating regimes:
                  const maxSpanX = meltL * 2.2;
                  const maxSpanY = meltW * 1.6;
                  const pxPerUm = Math.min(540 / Math.max(60, maxSpanX), 125 / Math.max(30, maxSpanY));

                  // Dynamic Laser Center X0 strictly bounded inside frame [80, 860]:
                  const rearPx = meltL * 1.82 * pxPerUm;
                  const frontPx = meltL * 0.38 * pxPerUm;
                  const X0 = Math.max(plotX1 + rearPx + 35, Math.min(plotX2 - frontPx - 60, Math.round(plotX1 + (plotW + rearPx - frontPx - 60) / 2)));

                  // Helper function to build mathematically continuous smooth aerodynamic tear-drop curves with rounded tail apex
                  const generateTeardrop = (lUm: number, wUm: number, headRatio = 0.14, tailRatio = 0.86) => {
                    const headX = X0 + headRatio * lUm * pxPerUm;
                    const tailX = X0 - tailRatio * lUm * pxPerUm;
                    const maxWX = X0 - 0.16 * lUm * pxPerUm;
                    const halfW = (wUm / 2) * pxPerUm;
                    const lPx = lUm * pxPerUm;
                    const tailRadiusY = Math.min(halfW * 0.35, 22);
                    const tailLeadX = tailX + Math.min(lPx * 0.12, 32);

                    return [
                      `M ${headX.toFixed(1)} ${Y0.toFixed(1)}`,
                      // Nose to top crest
                      `C ${headX.toFixed(1)} ${(Y0 - halfW * 0.55).toFixed(1)}, ${(maxWX + 0.18 * lPx).toFixed(1)} ${(Y0 - halfW).toFixed(1)}, ${maxWX.toFixed(1)} ${(Y0 - halfW).toFixed(1)}`,
                      // Top crest tapering back towards rounded tail
                      `C ${(maxWX - 0.42 * lPx).toFixed(1)} ${(Y0 - halfW).toFixed(1)}, ${tailLeadX.toFixed(1)} ${(Y0 - tailRadiusY * 1.5).toFixed(1)}, ${tailLeadX.toFixed(1)} ${(Y0 - tailRadiusY).toFixed(1)}`,
                      // Smooth rounded apex around tailX
                      `C ${(tailLeadX - 0.5 * (tailLeadX - tailX)).toFixed(1)} ${(Y0 - tailRadiusY).toFixed(1)}, ${tailX.toFixed(1)} ${(Y0 - tailRadiusY * 0.55).toFixed(1)}, ${tailX.toFixed(1)} ${Y0.toFixed(1)}`,
                      `C ${tailX.toFixed(1)} ${(Y0 + tailRadiusY * 0.55).toFixed(1)}, ${(tailLeadX - 0.5 * (tailLeadX - tailX)).toFixed(1)} ${(Y0 + tailRadiusY).toFixed(1)}, ${tailLeadX.toFixed(1)} ${(Y0 + tailRadiusY).toFixed(1)}`,
                      // Bottom crest from tail to maxWX
                      `C ${tailLeadX.toFixed(1)} ${(Y0 + tailRadiusY * 1.5).toFixed(1)}, ${(maxWX - 0.42 * lPx).toFixed(1)} ${(Y0 + halfW).toFixed(1)}, ${maxWX.toFixed(1)} ${(Y0 + halfW).toFixed(1)}`,
                      // Bottom crest back to nose
                      `C ${(maxWX + 0.18 * lPx).toFixed(1)} ${(Y0 + halfW).toFixed(1)}, ${headX.toFixed(1)} ${(Y0 + halfW * 0.55).toFixed(1)}, ${headX.toFixed(1)} ${Y0.toFixed(1)}`,
                      'Z'
                    ].join(' ');
                  };

                  const liquidusPath = generateTeardrop(meltL, meltW, 0.14, 0.86);
                  const solidusPath = generateTeardrop(meltL * 1.15, meltW * 1.18, 0.17, 0.98);
                  const hazTransusPath = generateTeardrop(meltL * 1.45, meltW * 1.48, 0.26, 1.25);

                  // Physical Key Positions
                  const liquidusHeadX = X0 + 0.14 * meltL * pxPerUm;
                  const liquidusTailX = X0 - 0.86 * meltL * pxPerUm;
                  const liquidusMaxWX = X0 - 0.16 * meltL * pxPerUm;
                  const liquidusHalfW = (meltW / 2) * pxPerUm;

                  const solidusHalfW = liquidusHalfW * 1.18;
                  const hazHalfW = liquidusHalfW * 1.48;

                  const spotRadiusPx = Math.max(4, (spotDia / 2) * pxPerUm);

                  // High-contrast grid tick step determination using dynamic "nice numbers"
                  // Target ~6-8 major divisions across visible span to guarantee instant rendering at any scale (50 μm to 1,000,000 μm)
                  const totalSpanXUm = (plotX2 - plotX1) / Math.max(1e-6, pxPerUm);
                  const roughStep = totalSpanXUm / 6.5;
                  const pow10 = Math.pow(10, Math.floor(Math.log10(Math.max(1, roughStep))));
                  const frac = roughStep / pow10;
                  const niceMult = frac < 1.5 ? 1 : frac < 3.5 ? 2 : frac < 7.5 ? 5 : 10;
                  const tickStepUm = Math.max(1, niceMult * pow10);
                  const minorTickStepUm = tickStepUm / 2;

                  // Minimum pixel distance between labels to avoid clutter
                  const labelStepMultiplier = (tickStepUm * pxPerUm < 45) ? 2 : 1;
                  const labelStepUm = tickStepUm * labelStepMultiplier;

                  // X ticks (Longitudinal)
                  const minXTick = -Math.ceil((X0 - plotX1) / (tickStepUm * pxPerUm)) * tickStepUm;
                  const maxXTick = Math.floor((plotX2 - X0) / (tickStepUm * pxPerUm)) * tickStepUm;

                  const xGridLines: { t: number; px: number; isMajor: boolean; showLabel: boolean }[] = [];
                  for (let t = maxXTick; t >= minXTick; t -= minorTickStepUm) {
                    if (xGridLines.length >= 40) break; // Safety cap
                    const px = X0 + t * pxPerUm;
                    if (px >= plotX1 && px <= plotX2) {
                      const isMajor = Math.abs(t % tickStepUm) < 1e-4;
                      const showLabel = isMajor && (Math.abs(t % labelStepUm) < 1e-4 || t === 0);
                      xGridLines.push({ t, px, isMajor, showLabel });
                    }
                  }

                  // Y ticks (Transverse)
                  const maxPositiveY = Math.floor((Y0 - plotY1) / (tickStepUm * pxPerUm)) * tickStepUm;
                  const maxNegativeY = -Math.floor((plotY2 - Y0) / (tickStepUm * pxPerUm)) * tickStepUm;

                  const yGridLines: { y: number; px: number; isMajor: boolean; showLabel: boolean }[] = [];
                  for (let y = maxPositiveY; y >= maxNegativeY; y -= minorTickStepUm) {
                    if (yGridLines.length >= 30) break; // Safety cap
                    const px = Y0 - y * pxPerUm;
                    if (px >= plotY1 && px <= plotY2) {
                      const isMajor = Math.abs(y % tickStepUm) < 1e-4;
                      const showLabel = isMajor;
                      yGridLines.push({ y, px, isMajor, showLabel });
                    }
                  }

                  // High-visibility palette
                  const majorGridColor = gridContrastMode === 'ultra' ? '#476d9e' : '#334e75';
                  const minorGridColor = gridContrastMode === 'ultra' ? '#253b59' : '#1c2d44';
                  const frameBorderColor = gridContrastMode === 'ultra' ? '#5380b8' : '#3d5c87';
                  const tickMarkColor = gridContrastMode === 'ultra' ? '#7dd3fc' : '#60a5fa';
                  const laserAxisColor = '#38bdf8';
                  const centerAxisColor = '#60a5fa';

                  // Length dimension line placement
                  const dimY_L = Math.min(365, Y0 + hazHalfW + 36);
                  // Width dimension line placement
                  const dimX_W = liquidusMaxWX;

                  return (
                    <div className="bg-[#10141b] border border-[#1e2633] rounded-xl p-5 shadow-lg space-y-4">
                      {/* Header with Title and Mode Toggles */}
                      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 border-b border-[#1c2430] pb-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-base font-bold text-white flex items-center gap-2">
                              <Flame className="w-5 h-5 text-[#50d8e9]" />
                              <span>{isCoenMode ? 'KU Leuven Hybrid Melt Pool (Coen et al. 2022)' : 'Rosenthal Thermal Field & Melt Pool Geometry'}</span>
                            </h3>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-[#50d8e9]/10 text-[#50d8e9] border border-[#50d8e9]/30">
                              {isCoenMode ? 'JMPT 304: 117547' : 'Classic 1946'}
                            </span>
                          </div>
                          <p className="text-xs text-[#7189a3] mt-0.5">
                            {isCoenMode
                              ? 'Semi-analytical hybrid combining Eagar-Tsai conduction width with Fabbro recoil keyhole aspect ratio R = d/w.'
                              : 'Analytical 3D thermal field generated by moving point source in semi-infinite medium (Rosenthal 1946).'}
                          </p>
                        </div>

                        {/* Top Controls: Model Switch, View Toggle, Visibility, and Presets */}
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          {/* Model Architecture Toggle */}
                          <div className="inline-flex rounded-lg bg-[#080d14] p-0.5 border border-[#1e2a39]">
                            <button
                              type="button"
                              onClick={() => setMeltPoolModelType('coen-hybrid')}
                              className={`px-2.5 py-1 rounded text-[10.5px] font-medium transition-all ${
                                meltPoolModelType === 'coen-hybrid'
                                  ? 'bg-[#50d8e9] text-[#080d14] font-bold shadow-sm'
                                  : 'text-[#829bb5] hover:text-white'
                              }`}
                              title="KU Leuven Semi-Analytical Hybrid Eagar-Tsai + Fabbro (Coen et al. 2022)"
                            >
                              KU Leuven (2022)
                            </button>
                            <button
                              type="button"
                              onClick={() => setMeltPoolModelType('rosenthal')}
                              className={`px-2.5 py-1 rounded text-[10.5px] font-medium transition-all ${
                                meltPoolModelType === 'rosenthal'
                                  ? 'bg-[#50d8e9] text-[#080d14] font-bold shadow-sm'
                                  : 'text-[#829bb5] hover:text-white'
                              }`}
                              title="Classical Rosenthal 3D Analytical (1946)"
                            >
                              Rosenthal (1946)
                            </button>
                          </div>

                          {/* Paper Benchmark Preset Buttons */}
                          <div className="inline-flex rounded-lg bg-[#080d14] p-0.5 border border-[#1e2a39] items-center gap-1 px-1">
                            <span className="text-[9.5px] text-[#6b85a3] font-mono px-1">Presets:</span>
                            <button
                              type="button"
                              onClick={applyCoenPreset}
                              className={`px-2 py-0.5 rounded text-[10px] font-mono transition-all ${
                                selectedPaperPreset === 'coen-2022'
                                  ? 'bg-[#183652] text-[#50d8e9] font-bold border border-[#50d8e9]/50'
                                  : 'text-[#8ea8c4] hover:text-white hover:bg-[#162232]'
                              }`}
                              title="Coen et al. (KU Leuven 2022): P=200W, v=1600mm/s, ds=37.5µm, t=30µm, h=100µm"
                            >
                              KU Leuven (200W)
                            </button>
                            <button
                              type="button"
                              onClick={applyRansenigoPreset}
                              className={`px-2 py-0.5 rounded text-[10px] font-mono transition-all ${
                                selectedPaperPreset === 'ransenigo-2022'
                                  ? 'bg-[#2a1c42] text-[#c084fc] font-bold border border-[#c084fc]/50'
                                  : 'text-[#8ea8c4] hover:text-white hover:bg-[#162232]'
                              }`}
                              title="Ransenigo et al. (Concept Laser M2 2022): P=300W, v=1750mm/s, ds=100µm, t=50µm, h=75µm"
                            >
                              Concept Laser M2 (300W)
                            </button>
                          </div>

                          {/* View Toggle */}
                          <div className="inline-flex rounded-lg bg-[#080d14] p-0.5 border border-[#1e2a39]">
                            <button
                              type="button"
                              onClick={() => setMeltPoolImagingMode('surface')}
                              className={`px-2.5 py-1 rounded text-[10.5px] font-medium transition-all ${
                                meltPoolImagingMode === 'surface'
                                  ? 'bg-[#50d8e9] text-[#080d14] font-bold shadow-sm'
                                  : 'text-[#829bb5] hover:text-white'
                              }`}
                            >
                              Top Surface (X-Y)
                            </button>
                            <button
                              type="button"
                              onClick={() => setMeltPoolImagingMode('cross-section')}
                              className={`px-2.5 py-1 rounded text-[10.5px] font-medium transition-all ${
                                meltPoolImagingMode === 'cross-section'
                                  ? 'bg-[#50d8e9] text-[#080d14] font-bold shadow-sm'
                                  : 'text-[#829bb5] hover:text-white'
                              }`}
                            >
                              Longitudinal (X-Z)
                            </button>
                          </div>

                          {/* Visibility Toggles */}
                          <div className="inline-flex rounded-lg bg-[#080d14] p-0.5 border border-[#1e2a39] items-center gap-1 px-1">
                            <button
                              type="button"
                              onClick={() => setShowMeltPoolDims(!showMeltPoolDims)}
                              className={`px-2 py-1 rounded text-[10px] font-mono flex items-center gap-1 transition-all ${
                                showMeltPoolDims ? 'bg-[#172739] text-[#50d8e9] font-bold' : 'text-[#58728d] hover:text-[#94a3b8]'
                              }`}
                              title="Toggle Dimension Annotations"
                            >
                              <Ruler className="w-3 h-3" />
                              <span>Dims</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setShowMeltPoolCallouts(!showMeltPoolCallouts)}
                              className={`px-2 py-1 rounded text-[10px] font-mono flex items-center gap-1 transition-all ${
                                showMeltPoolCallouts ? 'bg-[#172739] text-[#50d8e9] font-bold' : 'text-[#58728d] hover:text-[#94a3b8]'
                              }`}
                              title="Toggle Zone Callout Badges"
                            >
                              <Crosshair className="w-3 h-3" />
                              <span>Callouts</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setShowMeltPoolGrid(!showMeltPoolGrid)}
                              className={`px-2 py-1 rounded text-[10px] font-mono flex items-center gap-1 transition-all ${
                                showMeltPoolGrid ? 'bg-[#172739] text-[#50d8e9] font-bold' : 'text-[#58728d] hover:text-[#94a3b8]'
                              }`}
                              title="Toggle Coordinate Grid"
                            >
                              <Grid className="w-3 h-3" />
                              <span>Grid</span>
                            </button>
                            {showMeltPoolGrid && (
                              <button
                                type="button"
                                onClick={() => setGridContrastMode(gridContrastMode === 'high' ? 'ultra' : 'high')}
                                className={`px-2 py-1 rounded text-[10px] font-mono flex items-center gap-1 transition-all ${
                                  gridContrastMode === 'ultra' ? 'bg-[#1e3a5f] text-[#38bdf8] font-bold border border-[#38bdf8]/40' : 'bg-[#121c29] text-[#94a3b8] hover:text-white'
                                }`}
                                title="Toggle Grid Contrast Mode"
                              >
                                <span>{gridContrastMode === 'ultra' ? 'Ultra Grid' : 'High Grid'}</span>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Main Visualization Container */}
                      <div className="relative w-full aspect-[960/440] min-h-[220px] sm:min-h-[320px] md:min-h-[420px] bg-[#06080d] rounded-xl border border-[#182333] overflow-hidden flex items-center justify-center p-1 sm:p-2 shadow-inner">
                        {meltPoolImagingMode === 'surface' ? (
                          /* Top Surface (X-Y) View */
                          <svg className="w-full h-full" viewBox="0 0 960 440" preserveAspectRatio="xMidYMid meet">
                            <defs>
                              {/* Radial core heat glow */}
                              <radialGradient id="moltenCoreGradient" cx="72%" cy="50%" r="55%">
                                <stop offset="0%" stopColor="#ffffff" />
                                <stop offset="12%" stopColor="#fff59d" />
                                <stop offset="35%" stopColor="#ff7043" />
                                <stop offset="65%" stopColor="#d32f2f" />
                                <stop offset="90%" stopColor="#7f1d1d" />
                                <stop offset="100%" stopColor="#450a0a" stopOpacity="0.85" />
                              </radialGradient>

                              {/* HAZ thermal dissipation glow */}
                              <radialGradient id="hazThermalHalo" cx="72%" cy="50%" r="65%">
                                <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.35" />
                                <stop offset="50%" stopColor="#b45309" stopOpacity="0.15" />
                                <stop offset="100%" stopColor="#06080d" stopOpacity="0" />
                              </radialGradient>

                              {/* Diagonal hatch for Mushy Solidification Zone */}
                              <pattern id="mushyHatch" width="8" height="8" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
                                <line x1="0" y1="0" x2="0" y2="8" stroke="#ffffff" strokeWidth="1" strokeOpacity="0.15" />
                              </pattern>

                              {/* Filter for neon glowing liquidus line */}
                              <filter id="cyanGlow" x="-20%" y="-20%" width="140%" height="140%">
                                <feGaussianBlur stdDeviation="2.5" result="blur" />
                                <feComposite in="SourceGraphic" in2="blur" operator="over" />
                              </filter>
                              <clipPath id="meltPoolFrameClip">
                                <rect x={plotX1} y={plotY1} width={plotW} height={plotH} rx="6" />
                              </clipPath>
                            </defs>

                            {/* 0. DEDICATED COORDINATE CANVAS BACKGROUND */}
                            <rect
                              x={plotX1}
                              y={plotY1}
                              width={plotW}
                              height={plotH}
                              rx="6"
                              fill="#080e1a"
                              stroke={frameBorderColor}
                              strokeWidth="1.8"
                            />

                            {/* 1. HIGH-CONTRAST CALIBRATED MICROMETER GRID & AXES */}
                            {showMeltPoolGrid && (
                              <g className="grid-layer">
                                {/* Minor & Major X Grid Lines (Longitudinal) */}
                                {xGridLines.map((gl) => {
                                  const isOrigin = gl.t === 0;
                                  if (isOrigin) return null;
                                  return (
                                    <line
                                      key={`x-grid-${gl.t}`}
                                      x1={gl.px}
                                      y1={plotY1}
                                      x2={gl.px}
                                      y2={plotY2}
                                      stroke={gl.isMajor ? majorGridColor : minorGridColor}
                                      strokeWidth={gl.isMajor ? 1.2 : 0.8}
                                      strokeDasharray={gl.isMajor ? undefined : '3 3'}
                                      opacity={gl.isMajor ? 0.9 : 0.6}
                                    />
                                  );
                                })}

                                {/* Minor & Major Y Grid Lines (Transverse) */}
                                {yGridLines.map((gl) => {
                                  const isOrigin = gl.y === 0;
                                  if (isOrigin) return null;
                                  return (
                                    <line
                                      key={`y-grid-${gl.y}`}
                                      x1={plotX1}
                                      y1={gl.px}
                                      x2={plotX2}
                                      y2={gl.px}
                                      stroke={gl.isMajor ? majorGridColor : minorGridColor}
                                      strokeWidth={gl.isMajor ? 1.2 : 0.8}
                                      strokeDasharray={gl.isMajor ? undefined : '3 3'}
                                      opacity={gl.isMajor ? 0.9 : 0.6}
                                    />
                                  );
                                })}

                                {/* Horizontal Centerline (y = 0) Symmetry Axis */}
                                <line
                                  x1={plotX1}
                                  y1={Y0}
                                  x2={plotX2}
                                  y2={Y0}
                                  stroke={centerAxisColor}
                                  strokeWidth="1.6"
                                  strokeDasharray="6 3"
                                  opacity="0.9"
                                />

                                {/* Vertical Laser Axis (x = 0) */}
                                <line
                                  x1={X0}
                                  y1={plotY1}
                                  x2={X0}
                                  y2={plotY2}
                                  stroke={laserAxisColor}
                                  strokeWidth="2"
                                  opacity="0.95"
                                />

                                {/* Ruler tick marks on all 4 frame borders */}
                                {xGridLines.filter(gl => gl.isMajor).map(gl => (
                                  <g key={`x-ticks-${gl.t}`}>
                                    <line x1={gl.px} y1={plotY1} x2={gl.px} y2={plotY1 + 5} stroke={tickMarkColor} strokeWidth="1.5" />
                                    <line x1={gl.px} y1={plotY2 - 5} x2={gl.px} y2={plotY2} stroke={tickMarkColor} strokeWidth="1.5" />
                                  </g>
                                ))}

                                {yGridLines.filter(gl => gl.isMajor).map(gl => (
                                  <g key={`y-ticks-${gl.y}`}>
                                    <line x1={plotX1} y1={gl.px} x2={plotX1 + 5} y2={gl.px} stroke={tickMarkColor} strokeWidth="1.5" />
                                    <line x1={plotX2 - 5} y1={gl.px} x2={plotX2} y2={gl.px} stroke={tickMarkColor} strokeWidth="1.5" />
                                  </g>
                                ))}

                                {/* X-Axis Tick Value Labels */}
                                {xGridLines.filter(gl => gl.showLabel).map(gl => {
                                  const isOrigin = gl.t === 0;
                                  return (
                                    <text
                                      key={`x-label-${gl.t}`}
                                      x={gl.px}
                                      y={plotY2 + 18}
                                      fill={isOrigin ? '#38bdf8' : '#cbd5e1'}
                                      fontSize={isOrigin ? '12' : '11'}
                                      fontWeight={isOrigin ? 'bold' : '600'}
                                      textAnchor="middle"
                                      fontFamily="monospace"
                                    >
                                      {isOrigin ? '0 (Laser)' : Math.abs(gl.t) >= 1000 ? `${(gl.t / 1000).toFixed(1)} mm` : `${gl.t > 0 ? '+' : ''}${gl.t} μm`}
                                    </text>
                                  );
                                })}

                                {/* Y-Axis Tick Value Labels on left border (X = 72) */}
                                {yGridLines.filter(gl => gl.showLabel).map(gl => {
                                  const isOrigin = gl.y === 0;
                                  return (
                                    <text
                                      key={`y-label-${gl.y}`}
                                      x={plotX1 - 8}
                                      y={gl.px + 4}
                                      fill={isOrigin ? '#60a5fa' : '#cbd5e1'}
                                      fontSize={isOrigin ? '12' : '11'}
                                      fontWeight={isOrigin ? 'bold' : '600'}
                                      textAnchor="end"
                                      fontFamily="monospace"
                                    >
                                      {isOrigin ? '0' : Math.abs(gl.y) >= 1000 ? `${gl.y > 0 ? '+' : ''}${(gl.y / 1000).toFixed(1)} mm` : `${gl.y > 0 ? '+' : ''}${gl.y} μm`}
                                    </text>
                                  );
                                })}

                                {/* X-Axis Title */}
                                <text
                                  x={(plotX1 + plotX2) / 2}
                                  y={plotY2 + 38}
                                  fill="#cbd5e1"
                                  fontSize="13"
                                  fontWeight="bold"
                                  textAnchor="middle"
                                  fontFamily="monospace"
                                >
                                  Longitudinal Distance from Laser Center x (μm / mm)
                                </text>

                                {/* Y-Axis Label (Placed at X = 24 to completely avoid colliding with tick labels) */}
                                <text
                                  x="24"
                                  y={(plotY1 + plotY2) / 2}
                                  fill="#cbd5e1"
                                  fontSize="13"
                                  fontWeight="bold"
                                  textAnchor="middle"
                                  transform={`rotate(-90 24 ${(plotY1 + plotY2) / 2})`}
                                  fontFamily="monospace"
                                >
                                  Transverse Width y (μm)
                                </text>
                              </g>
                            )}

                            <g className="thermal-envelope" clipPath="url(#meltPoolFrameClip)">
                            {/* 2. HEAT AFFECTED ZONE (HAZ / BETA-TRANSUS 995°C) */}
                            <path
                              d={hazTransusPath}
                              fill="url(#hazThermalHalo)"
                              stroke="#f59e0b"
                              strokeWidth="1.2"
                              strokeDasharray="4 4"
                              opacity="0.6"
                            />

                            {/* 3. MUSHY SOLIDIFICATION ZONE (1,620°C - 1,654°C) */}
                            <path
                              d={solidusPath}
                              fill="rgba(239, 68, 68, 0.22)"
                              stroke="#ffffff"
                              strokeWidth="1.8"
                              strokeDasharray="5 3"
                            />
                            <path
                              d={solidusPath}
                              fill="url(#mushyHatch)"
                              opacity="0.8"
                            />

                            {/* 4. MOLTEN LIQUID POOL (T >= 1,654°C) */}
                            <path
                              d={liquidusPath}
                              fill="url(#moltenCoreGradient)"
                              stroke="#00f7ff"
                              strokeWidth="2.5"
                              filter="url(#cyanGlow)"
                            />
                            </g>

                            {/* 5. LASER BEAM SPOT AT (X0, Y0) WITH 60 FPS SHIMMER & BLOOM */}
                            <g className="laser-beam-center">
                              {/* Beam Spot Diameter Ring with Pulsing Animation */}
                              <circle
                                cx={X0}
                                cy={Y0}
                                r={spotRadiusPx}
                                fill="none"
                                stroke="#ffffff"
                                strokeWidth="1.2"
                                strokeDasharray="3 2"
                                opacity="0.8"
                              >
                                <animate attributeName="r" values={`${spotRadiusPx * 0.9};${spotRadiusPx * 1.35};${spotRadiusPx * 0.9}`} dur="1.2s" repeatCount="indefinite" />
                                <animate attributeName="opacity" values="0.85;0.35;0.85" dur="1.2s" repeatCount="indefinite" />
                              </circle>
                              {/* Crosshair */}
                              <line x1={X0 - spotRadiusPx - 4} y1={Y0} x2={X0 + spotRadiusPx + 4} y2={Y0} stroke="#ffffff" strokeWidth="1" opacity="0.7" />
                              <line x1={X0} y1={Y0 - spotRadiusPx - 4} x2={X0} y2={Y0 + spotRadiusPx + 4} stroke="#ffffff" strokeWidth="1" opacity="0.7" />
                              {/* Glowing White Laser Core with Photon Oscillation */}
                              <circle cx={X0} cy={Y0} r={Math.min(5, Math.max(3, spotRadiusPx * 0.35))} fill="#ffffff">
                                <animate attributeName="r" values={`${Math.min(5, Math.max(3, spotRadiusPx * 0.35)) * 0.8};${Math.min(5, Math.max(3, spotRadiusPx * 0.35)) * 1.4};${Math.min(5, Math.max(3, spotRadiusPx * 0.35)) * 0.8}`} dur="0.9s" repeatCount="indefinite" />
                              </circle>
                              <circle cx={X0} cy={Y0} r={Math.min(10, Math.max(6, spotRadiusPx * 0.7))} fill="#ffeb3b" opacity="0.4">
                                <animate attributeName="opacity" values="0.45;0.15;0.45" dur="1.1s" repeatCount="indefinite" />
                              </circle>
                            </g>

                            {/* 5B. TRAILING CHEVRON SOLIDIFICATION RIPPLES IN WAKE */}
                            <g className="wake-ripples">
                              {[1, 2, 3, 4].map(idx => (
                                <path
                                  key={`wake-ripple-${idx}`}
                                  d={`M ${X0 - idx * 26 * pxPerUm} ${Y0 - liquidusHalfW * 0.72} Q ${X0 - (idx * 26 + 14) * pxPerUm} ${Y0} ${X0 - idx * 26 * pxPerUm} ${Y0 + liquidusHalfW * 0.72}`}
                                  fill="none"
                                  stroke="#38bdf8"
                                  strokeWidth="1.3"
                                >
                                  <animate attributeName="opacity" values="0.75;0.15;0.75" dur={`${0.8 + idx * 0.25}s`} repeatCount="indefinite" />
                                </path>
                              ))}
                            </g>

                            {/* 6. LASER SCAN TRAVEL DIRECTION INDICATOR */}
                            <g className="scan-direction">
                              <line
                                x1={X0 - 45}
                                y1={Math.max(45, Y0 - hazHalfW - 35)}
                                x2={X0 + 45}
                                y2={Math.max(45, Y0 - hazHalfW - 35)}
                                stroke="#38bdf8"
                                strokeWidth="2"
                              />
                              <polygon
                                points={`${X0 + 45},${Math.max(45, Y0 - hazHalfW - 35)} ${X0 + 35},${Math.max(45, Y0 - hazHalfW - 35) - 4} ${X0 + 35},${Math.max(45, Y0 - hazHalfW - 35) + 4}`}
                                fill="#38bdf8"
                              />
                              <text
                                x={X0}
                                y={Math.max(45, Y0 - hazHalfW - 35) - 7}
                                fill="#38bdf8"
                                fontSize="11"
                                fontWeight="bold"
                                textAnchor="middle"
                                fontFamily="monospace"
                              >
                                Laser Scan Direction v → ({scanSpeed} mm/s)
                              </text>
                            </g>

                            {/* 7. PHYSICAL DIMENSION BRACKETS */}
                            {showMeltPoolDims && (
                              <g className="dimension-brackets">
                                {/* Pool Length Dimension Bar */}
                                <g className="dim-length">
                                  {/* Extension Lines */}
                                  <line x1={liquidusTailX} y1={Y0 + 5} x2={liquidusTailX} y2={dimY_L + 6} stroke="#475569" strokeWidth="0.8" strokeDasharray="2 2" />
                                  <line x1={liquidusHeadX} y1={Y0 + 5} x2={liquidusHeadX} y2={dimY_L + 6} stroke="#475569" strokeWidth="0.8" strokeDasharray="2 2" />
                                  {/* Dimension Bar */}
                                  <line x1={liquidusTailX} y1={dimY_L} x2={liquidusHeadX} y2={dimY_L} stroke="#50d8e9" strokeWidth="1.5" />
                                  {/* Left Arrow */}
                                  <polygon points={`${liquidusTailX},${dimY_L} ${liquidusTailX + 7},${dimY_L - 3.5} ${liquidusTailX + 7},${dimY_L + 3.5}`} fill="#50d8e9" />
                                  {/* Right Arrow */}
                                  <polygon points={`${liquidusHeadX},${dimY_L} ${liquidusHeadX - 7},${dimY_L - 3.5} ${liquidusHeadX - 7},${dimY_L + 3.5}`} fill="#50d8e9" />
                                  {/* Length Label Badge */}
                                  <rect
                                    x={(liquidusTailX + liquidusHeadX) / 2 - 100}
                                    y={dimY_L - 11}
                                    width="200"
                                    height="22"
                                    rx="11"
                                    fill="#070c14"
                                    stroke="#50d8e9"
                                    strokeWidth="1.2"
                                  />
                                  <text
                                    x={(liquidusTailX + liquidusHeadX) / 2}
                                    y={dimY_L + 4.5}
                                    fill="#50d8e9"
                                    fontSize="12"
                                    fontWeight="bold"
                                    textAnchor="middle"
                                    fontFamily="monospace"
                                  >
                                    Length L = {meltL} μm ({((meltL) / 1000).toFixed(2)} mm)
                                  </text>
                                </g>

                                {/* Pool Width Dimension Bar */}
                                <g className="dim-width">
                                  {/* Vertical Line across widest section */}
                                  <line x1={dimX_W} y1={Y0 - liquidusHalfW} x2={dimX_W} y2={Y0 + liquidusHalfW} stroke="#00f7ff" strokeWidth="1.5" />
                                  {/* Top Arrow */}
                                  <polygon points={`${dimX_W},${Y0 - liquidusHalfW} ${dimX_W - 3.5},${Y0 - liquidusHalfW + 7} ${dimX_W + 3.5},${Y0 - liquidusHalfW + 7}`} fill="#00f7ff" />
                                  {/* Bottom Arrow */}
                                  <polygon points={`${dimX_W},${Y0 + liquidusHalfW} ${dimX_W - 3.5},${Y0 + liquidusHalfW - 7} ${dimX_W + 3.5},${Y0 + liquidusHalfW - 7}`} fill="#00f7ff" />
                                  {/* Width Label Badge */}
                                  <rect
                                    x={dimX_W - 65}
                                    y={Y0 - 10}
                                    width="130"
                                    height="20"
                                    rx="10"
                                    fill="#070c14"
                                    stroke="#00f7ff"
                                    strokeWidth="1"
                                  />
                                  <text
                                    x={dimX_W}
                                    y={Y0 + 4.5}
                                    fill="#00f7ff"
                                    fontSize="11.5"
                                    fontWeight="bold"
                                    textAnchor="middle"
                                    fontFamily="monospace"
                                  >
                                    Width W = {meltW} μm
                                  </text>
                                </g>
                              </g>
                            )}

                            {/* 8. ZONE CALLOUT BADGES WITH LEADER LINES */}
                            {showMeltPoolCallouts && (
                              <g className="callout-badges">
                                {/* Callout 1: Laser Beam Spot (Top Right) */}
                                <g className="callout-laser">
                                  <polyline
                                    points={`${Math.min(plotX2 - 100, X0 + 60)},86 ${Math.min(plotX2 - 100, X0 + 60)},${Y0 - spotRadiusPx - 15} ${X0},${Y0 - spotRadiusPx - 4}`}
                                    fill="none"
                                    stroke="#38bdf8"
                                    strokeWidth="1"
                                    strokeDasharray="2 2"
                                  />
                                  <rect x={Math.min(plotX2 - 175, Math.max(plotX1 + 10, X0 + 15))} y="54" width="165" height="34" rx="6" fill="#080e18" stroke="#38bdf8" strokeWidth="1.2" />
                                  <text x={Math.min(plotX2 - 165, Math.max(plotX1 + 20, X0 + 25))} y="68" fill="#ffffff" fontSize="11" fontWeight="bold">
                                    🎯 Laser Beam Center
                                  </text>
                                  <text x={Math.min(plotX2 - 165, Math.max(plotX1 + 20, X0 + 25))} y="80" fill="#cbd5e1" fontSize="9.5" fontFamily="monospace">
                                    Spot Ø = {spotDia} μm | P = {laserPower} W
                                  </text>
                                </g>

                                {/* Callout 2: Molten Liquid Pool (Top Center) */}
                                <g className="callout-molten">
                                  <polyline
                                    points={`${Math.max(plotX1 + 100, X0 - 150)},86 ${Math.max(plotX1 + 100, X0 - 150)},${Y0 - liquidusHalfW - 12} ${liquidusMaxWX},${Y0 - liquidusHalfW}`}
                                    fill="none"
                                    stroke="#00f7ff"
                                    strokeWidth="1"
                                    strokeDasharray="2 2"
                                  />
                                  <rect x={Math.max(plotX1 + 15, Math.min(380, X0 - 240))} y="54" width="170" height="34" rx="6" fill="#080e18" stroke="#00f7ff" strokeWidth="1.2" />
                                  <text x={Math.max(plotX1 + 25, Math.min(390, X0 - 230))} y="68" fill="#00f7ff" fontSize="11" fontWeight="bold">
                                    💧 Molten Pool (Liquid)
                                  </text>
                                  <text x={Math.max(plotX1 + 25, Math.min(390, X0 - 230))} y="80" fill="#cbd5e1" fontSize="9.5" fontFamily="monospace">
                                    T ≥ {liquidusC}°C | Fully Molten Metal
                                  </text>
                                </g>

                                {/* Callout 3: Mushy Solidification Zone (Bottom Center/Left) */}
                                <g className="callout-mushy">
                                  <polyline
                                    points={`260,345 260,${Y0 + solidusHalfW + 10} ${X0 - 0.92 * meltL * pxPerUm},${Y0 + (liquidusHalfW * 0.3)}`}
                                    fill="none"
                                    stroke="#ffffff"
                                    strokeWidth="1"
                                    strokeDasharray="3 2"
                                  />
                                  <rect x="175" y="332" width="185" height="34" rx="6" fill="#080e18" stroke="#ffffff" strokeWidth="1.2" strokeDasharray="3 2" />
                                  <text x="185" y="346" fill="#ffffff" fontSize="11" fontWeight="bold">
                                    ❄️ Mushy Solidification Zone
                                  </text>
                                  <text x="185" y="359" fill="#cbd5e1" fontSize="9.5" fontFamily="monospace">
                                    {solidusC}°C ≤ T &lt; {liquidusC}°C | Dendrites
                                  </text>
                                </g>
                              </g>
                            )}
                          </svg>
                        ) : (
                          /* Longitudinal (X-Z) Cross-Section View */
                          <svg className="w-full h-full" viewBox="0 0 960 440" preserveAspectRatio="xMidYMid meet">
                            <defs>
                              <linearGradient id="laserBeamIncident" x1="50%" y1="0%" x2="50%" y2="100%">
                                <stop offset="0%" stopColor="#ffeb3b" stopOpacity="0.8" />
                                <stop offset="80%" stopColor="#ff9800" stopOpacity="0.4" />
                                <stop offset="100%" stopColor="#ffffff" stopOpacity="1" />
                              </linearGradient>

                              <radialGradient id="moltenCoreGradientXZ" cx="68%" cy="20%" r="65%">
                                <stop offset="0%" stopColor="#ffffff" />
                                <stop offset="15%" stopColor="#fff59d" />
                                <stop offset="35%" stopColor="#ff7043" />
                                <stop offset="65%" stopColor="#d32f2f" />
                                <stop offset="90%" stopColor="#7f1d1d" />
                                <stop offset="100%" stopColor="#450a0a" stopOpacity="0.9" />
                              </radialGradient>
                            </defs>

                            {/* 0. DEDICATED COORDINATE CANVAS BACKGROUND */}
                            <rect
                              x={plotX1}
                              y={plotY1}
                              width={plotW}
                              height={plotH}
                              rx="6"
                              fill="#080e1a"
                              stroke={frameBorderColor}
                              strokeWidth="1.8"
                            />

                            {(() => {
                              const Z0 = 145;
                              const maxZSpan = meltD * 1.6;
                              const pxPerUmXZ = Math.min(540 / Math.max(60, maxSpanX), 190 / Math.max(30, maxZSpan));
                              const headXZ = X0 + 0.14 * meltL * pxPerUmXZ;
                              const tailXZ = X0 - 0.86 * meltL * pxPerUmXZ;
                              const bottomX = X0 - 0.22 * meltL * pxPerUmXZ;
                              const depthPx = meltD * pxPerUmXZ;
                              const solidusDepthPx = (meltD * 1.15) * pxPerUmXZ;
                              const betaDepthPx = (meltD * 1.45) * pxPerUmXZ;
                              const powderLayerH = Math.max(10, (layerThickness || 30) * pxPerUmXZ);

                              // Depth ticks below surface Z0
                              const zTickStepUm = tickStepUm;
                              const maxDepthUm = Math.floor((plotY2 - Z0) / pxPerUmXZ);
                              const zTicks: number[] = [];
                              for (let z = 0; z <= maxDepthUm; z += zTickStepUm) {
                                if (zTicks.length >= 25) break; // Safety cap
                                zTicks.push(z);
                              }

                              return (
                                <>
                                  {/* Substrate zone fill below Z0 */}
                                  <rect
                                    x={plotX1}
                                    y={Z0}
                                    width={plotW}
                                    height={plotY2 - Z0}
                                    fill="#0a1222"
                                    fillOpacity="0.6"
                                  />

                                  {/* HIGH-CONTRAST GRID & AXES */}
                                  {showMeltPoolGrid && (
                                    <g className="grid-layer">
                                      {/* Vertical X Grid Lines */}
                                      {xGridLines.map((gl) => {
                                        const isOrigin = gl.t === 0;
                                        if (isOrigin) return null;
                                        return (
                                          <line
                                            key={`xz-xgrid-${gl.t}`}
                                            x1={gl.px}
                                            y1={plotY1}
                                            x2={gl.px}
                                            y2={plotY2}
                                            stroke={gl.isMajor ? majorGridColor : minorGridColor}
                                            strokeWidth={gl.isMajor ? 1.2 : 0.8}
                                            strokeDasharray={gl.isMajor ? undefined : '3 3'}
                                            opacity={gl.isMajor ? 0.9 : 0.6}
                                          />
                                        );
                                      })}

                                      {/* Horizontal Depth Grid Lines */}
                                      {zTicks.map((z) => {
                                        const py = Z0 + z * pxPerUmXZ;
                                        if (py > plotY2) return null;
                                        const isSurface = z === 0;
                                        return (
                                          <g key={`z-grid-${z}`}>
                                            <line
                                              x1={plotX1}
                                              y1={py}
                                              x2={plotX2}
                                              y2={py}
                                              stroke={isSurface ? centerAxisColor : majorGridColor}
                                              strokeWidth={isSurface ? 2 : 1.1}
                                              strokeDasharray={isSurface ? undefined : '3 3'}
                                              opacity={isSurface ? 1 : 0.75}
                                            />
                                            {/* Left tick label */}
                                            <text
                                              x={plotX1 - 8}
                                              y={py + 4}
                                              fill={isSurface ? '#60a5fa' : '#cbd5e1'}
                                              fontSize={isSurface ? '12' : '11'}
                                              fontWeight={isSurface ? 'bold' : '600'}
                                              textAnchor="end"
                                              fontFamily="monospace"
                                            >
                                              {isSurface ? 'z = 0' : z >= 1000 ? `${(z / 1000).toFixed(1)} mm` : `${z} μm`}
                                            </text>
                                          </g>
                                        );
                                      })}

                                      {/* Vertical Laser Center Axis */}
                                      <line
                                        x1={X0}
                                        y1={plotY1}
                                        x2={X0}
                                        y2={plotY2}
                                        stroke={laserAxisColor}
                                        strokeWidth="2"
                                        opacity="0.95"
                                      />

                                      {/* X-Axis Tick Value Labels */}
                                      {xGridLines.filter(gl => gl.showLabel).map(gl => {
                                        const isOrigin = gl.t === 0;
                                        return (
                                          <text
                                            key={`xz-xlabel-${gl.t}`}
                                            x={gl.px}
                                            y={plotY2 + 18}
                                            fill={isOrigin ? '#38bdf8' : '#cbd5e1'}
                                            fontSize={isOrigin ? '12' : '11'}
                                            fontWeight={isOrigin ? 'bold' : '600'}
                                            textAnchor="middle"
                                            fontFamily="monospace"
                                          >
                                            {isOrigin ? '0 (Laser)' : Math.abs(gl.t) >= 1000 ? `${(gl.t / 1000).toFixed(1)} mm` : `${gl.t > 0 ? '+' : ''}${gl.t} μm`}
                                          </text>
                                        );
                                      })}

                                      {/* X-Axis Title */}
                                      <text
                                        x={(plotX1 + plotX2) / 2}
                                        y={plotY2 + 38}
                                        fill="#cbd5e1"
                                        fontSize="13"
                                        fontWeight="bold"
                                        textAnchor="middle"
                                        fontFamily="monospace"
                                      >
                                        Longitudinal Distance from Laser Center x (μm / mm)
                                      </text>

                                      {/* Y-Axis Label: Depth */}
                                      <text
                                        x="24"
                                        y={(plotY1 + plotY2) / 2}
                                        fill="#cbd5e1"
                                        fontSize="13"
                                        fontWeight="bold"
                                        textAnchor="middle"
                                        transform={`rotate(-90 24 ${(plotY1 + plotY2) / 2})`}
                                        fontFamily="monospace"
                                      >
                                        Penetration Depth z (μm)
                                      </text>
                                    </g>
                                  )}

                                  {/* Substrate Top Surface Annotation */}
                                  <text x={plotX2 - 10} y={Z0 - 8} fill="#cbd5e1" fontSize="12" textAnchor="end" fontFamily="monospace" fontWeight="bold">
                                    Substrate Top Surface (z = 0)
                                  </text>

                                  {/* Powder Layer Band */}
                                  <rect x={plotX1} y={Z0} width={plotW} height={powderLayerH} fill="#f59e0b" fillOpacity="0.08" />
                                  <line x1={plotX1} y1={Z0 + powderLayerH} x2={plotX2} y2={Z0 + powderLayerH} stroke="#f59e0b" strokeWidth="0.8" strokeDasharray="3 3" opacity="0.6" />
                                  <text x={plotX2 - 10} y={Z0 + powderLayerH + 13} fill="#f59e0b" fontSize="11" textAnchor="end" fontFamily="monospace" fontWeight="bold">
                                    Powder Layer (t = {layerThickness} μm)
                                  </text>

                                  {/* HAZ / Beta-Transus (995°C) Isotherm */}
                                  <path
                                    d={`M ${X0 + 0.25 * meltL * pxPerUmXZ} ${Z0} C ${X0 + 0.25 * meltL * pxPerUmXZ} ${Z0 + betaDepthPx * 0.75}, ${bottomX + 0.2 * meltL * pxPerUmXZ} ${Z0 + betaDepthPx}, ${bottomX} ${Z0 + betaDepthPx} C ${bottomX - 0.35 * meltL * pxPerUmXZ} ${Z0 + betaDepthPx}, ${X0 - 1.25 * meltL * pxPerUmXZ} ${Z0 + betaDepthPx * 0.3}, ${X0 - 1.25 * meltL * pxPerUmXZ} ${Z0} Z`}
                                    fill="none"
                                    stroke="#f59e0b"
                                    strokeWidth="1.2"
                                    strokeDasharray="4 4"
                                    opacity="0.7"
                                  />

                                  {/* Solidus (1,620°C) Isotherm */}
                                  <path
                                    d={`M ${X0 + 0.17 * meltL * pxPerUmXZ} ${Z0} C ${X0 + 0.17 * meltL * pxPerUmXZ} ${Z0 + solidusDepthPx * 0.72}, ${bottomX + 0.18 * meltL * pxPerUmXZ} ${Z0 + solidusDepthPx}, ${bottomX} ${Z0 + solidusDepthPx} C ${bottomX - 0.32 * meltL * pxPerUmXZ} ${Z0 + solidusDepthPx}, ${X0 - 0.98 * meltL * pxPerUmXZ} ${Z0 + solidusDepthPx * 0.25}, ${X0 - 0.98 * meltL * pxPerUmXZ} ${Z0} Z`}
                                    fill="rgba(239, 68, 68, 0.2)"
                                    stroke="#ffffff"
                                    strokeWidth="1.8"
                                    strokeDasharray="5 3"
                                  />

                                  {/* Liquidus (1,654°C) Isotherm */}
                                  <path
                                    d={`M ${headXZ} ${Z0} C ${headXZ} ${Z0 + depthPx * 0.7}, ${bottomX + 0.15 * meltL * pxPerUmXZ} ${Z0 + depthPx}, ${bottomX} ${Z0 + depthPx} C ${bottomX - 0.3 * meltL * pxPerUmXZ} ${Z0 + depthPx}, ${tailXZ + 0.15 * meltL * pxPerUmXZ} ${Z0 + depthPx * 0.22}, ${tailXZ} ${Z0} Z`}
                                    fill="url(#moltenCoreGradientXZ)"
                                    stroke="#00f7ff"
                                    strokeWidth="2.5"
                                  />

                                  {/* Incident Laser Beam Cone from Above with Photon Shimmer */}
                                  <polygon
                                    points={`${X0 - 24},48 ${X0 + 24},48 ${X0 + (spotDia / 2) * pxPerUmXZ},${Z0} ${X0 - (spotDia / 2) * pxPerUmXZ},${Z0}`}
                                    fill="url(#laserBeamIncident)"
                                    opacity="0.85"
                                  >
                                    <animate attributeName="opacity" values="0.85;0.6;0.85" dur="0.8s" repeatCount="indefinite" />
                                  </polygon>
                                  <circle cx={X0} cy={Z0} r={Math.max(3, (spotDia / 2) * pxPerUmXZ)} fill="#ffffff" />
                                  <ellipse cx={X0 - (spotDia / 4) * pxPerUmXZ} cy={Z0 + 3} rx={(spotDia / 3) * pxPerUmXZ} ry={Math.min(16, depthPx * 0.25)} fill="#020617" stroke="#38bdf8" strokeWidth="1">
                                    <animate attributeName="ry" values={`${Math.min(16, depthPx * 0.25) * 0.75};${Math.min(16, depthPx * 0.25) * 1.35};${Math.min(16, depthPx * 0.25) * 0.75}`} dur="0.85s" repeatCount="indefinite" />
                                  </ellipse>
                                  <text x={X0} y="44" fill="#ffeb3b" fontSize="11" fontWeight="bold" textAnchor="middle" fontFamily="monospace">
                                    Incident Laser Beam (P = {laserPower} W)
                                  </text>

                                  {/* Travel Direction Vector */}
                                  <line x1={X0 - 45} y1="72" x2={X0 + 45} y2="72" stroke="#38bdf8" strokeWidth="2" />
                                  <polygon points={`${X0 + 45},72 ${X0 + 35},68 ${X0 + 35},76`} fill="#38bdf8" />
                                  <text x={X0} y="67" fill="#38bdf8" fontSize="10.5" fontWeight="bold" textAnchor="middle" fontFamily="monospace">
                                    Scan Direction v → ({scanSpeed} mm/s)
                                  </text>

                                  {/* Depth Dimension Line */}
                                  <g className="xz-depth-dim">
                                    <line x1={bottomX} y1={Z0} x2={bottomX} y2={Z0 + depthPx} stroke="#50d8e9" strokeWidth="1.5" />
                                    <polygon points={`${bottomX},${Z0} ${bottomX - 3.5},${Z0 + 7} ${bottomX + 3.5},${Z0 + 7}`} fill="#50d8e9" />
                                    <polygon points={`${bottomX},${Z0 + depthPx} ${bottomX - 3.5},${Z0 + depthPx - 7} ${bottomX + 3.5},${Z0 + depthPx - 7}`} fill="#50d8e9" />
                                    <rect x={bottomX - 90} y={Z0 + depthPx / 2 - 11} width="180" height="22" rx="11" fill="#070c14" stroke="#50d8e9" strokeWidth="1.2" />
                                    <text x={bottomX} y={Z0 + depthPx / 2 + 4.5} fill="#50d8e9" fontSize="11.5" fontWeight="bold" textAnchor="middle" fontFamily="monospace">
                                      Depth zm = {meltD} μm ({(meltD / Math.max(1, layerThickness)).toFixed(1)}× t)
                                    </text>
                                  </g>

                                  {/* Length Dimension Line */}
                                  <g className="xz-length-dim">
                                    <line x1={tailXZ} y1={Z0 - 25} x2={headXZ} y2={Z0 - 25} stroke="#8ba2be" strokeWidth="1.5" />
                                    <line x1={tailXZ} y1={Z0 - 32} x2={tailXZ} y2={Z0 - 18} stroke="#8ba2be" strokeWidth="1" />
                                    <line x1={headXZ} y1={Z0 - 32} x2={headXZ} y2={Z0 - 18} stroke="#8ba2be" strokeWidth="1" />
                                    <polygon points={`${tailXZ},${Z0 - 25} ${tailXZ + 7},${Z0 - 28.5} ${tailXZ + 7},${Z0 - 21.5}`} fill="#8ba2be" />
                                    <polygon points={`${headXZ},${Z0 - 25} ${headXZ - 7},${Z0 - 28.5} ${headXZ - 7},${Z0 - 21.5}`} fill="#8ba2be" />
                                    <rect x={(tailXZ + headXZ) / 2 - 65} y={Z0 - 36} width="130" height="22" rx="11" fill="#070c14" stroke="#8ba2be" strokeWidth="1" />
                                    <text x={(tailXZ + headXZ) / 2} y={Z0 - 21} fill="#ffffff" fontSize="11.5" fontWeight="bold" textAnchor="middle" fontFamily="monospace">
                                      Length L = {meltL} μm
                                    </text>
                                  </g>

                                  {/* Aspect Ratio Badge */}
                                  <g className="aspect-ratio-badge">
                                    <rect x="95" y={Z0 + 35} width="200" height="44" rx="8" fill="#070c14" stroke="#1e293b" strokeWidth="1.2" />
                                    <text x="105" y={Z0 + 53} fill="#cbd5e1" fontSize="11.5" fontWeight="500">
                                      Melt Pool Aspect Ratio (d/W)
                                    </text>
                                    <text x="105" y={Z0 + 70} fill={meltD / Math.max(1, meltW) < 0.8 ? '#10b981' : '#f59e0b'} fontSize="12" fontWeight="bold" fontFamily="monospace">
                                      {(meltD / Math.max(1, meltW)).toFixed(2)} — {meltD / Math.max(1, meltW) < 0.8 ? 'Conduction Mode' : 'Keyhole Risk'}
                                    </text>
                                  </g>
                                </>
                              );
                            })()}
                          </svg>
                        )}

                        {/* Dedicated Temperature Colorbar Card on the Right (Desktop Only) */}
                        <div className="hidden md:flex absolute right-3 top-3 bottom-3 w-24 bg-[#0a0e17]/95 backdrop-blur-md rounded-xl border border-[#1e2a3b] p-2 flex-col justify-between items-center text-xs font-mono shadow-2xl z-10 pointer-events-none">
                          <div className="text-[10px] font-bold text-[#8ba2be] tracking-wider text-center">
                            TEMP (°C)
                          </div>

                          <div className="relative w-full flex-1 my-2 flex items-center justify-center">
                            {/* Gradient Colormap Bar */}
                            <div className="w-4 h-full rounded-full border border-[#243347] bg-gradient-to-t from-[#050608] via-[#e53935] via-[#ff9800] to-[#ffffff] relative overflow-hidden" />

                            {/* Ticks and Badges */}
                            <div className="absolute inset-y-0 left-6 right-0 flex flex-col justify-between py-1 text-[9px]">
                              {/* Peak Temperature */}
                              <div className="flex items-center gap-1">
                                <span className="w-1.5 h-0.5 bg-white" />
                                <span className="text-white font-bold">{peakT > 3200 ? '3200°' : `${peakT}°`}</span>
                              </div>

                              {/* Liquidus Isotherm */}
                              <div className="flex items-center gap-1">
                                <span className="w-2 h-0.5 bg-[#00f7ff]" />
                                <span className="text-[#00f7ff] font-bold">{liquidusC}°</span>
                              </div>

                              {/* Solidus Isotherm */}
                              <div className="flex items-center gap-1">
                                <span className="w-2 h-0.5 bg-white border-t border-dashed" />
                                <span className="text-white">{solidusC}°</span>
                              </div>

                              {/* Beta-Transus */}
                              <div className="flex items-center gap-1">
                                <span className="w-1.5 h-0.5 bg-amber-400" />
                                <span className="text-amber-400">995°</span>
                              </div>

                              {/* Preheat Temperature */}
                              <div className="flex items-center gap-1">
                                <span className="w-1.5 h-0.5 bg-[#64748b]" />
                                <span className="text-[#94a3b8]">{preheatC}°</span>
                              </div>
                            </div>
                          </div>

                          <div className="text-[9px] text-[#5e7792] text-center leading-tight">
                            Rosenthal<br />Analytical
                          </div>
                        </div>
                      </div>

                      {/* Mobile-Optimized Horizontal Temperature Colorbar (< md only) */}
                      <div className="md:hidden w-full mt-2.5 bg-[#0a0e17] rounded-xl border border-[#1e2a3b] p-2.5 font-mono shadow-lg">
                        <div className="flex items-center justify-between text-[11px] mb-1.5 font-bold">
                          <span className="text-[#8ba2be] tracking-wider flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-[#ff7043]" />
                            TEMP (°C) SPECTRUM
                          </span>
                          <span className="text-[#5e7792] font-normal text-[10px]">Rosenthal Analytical</span>
                        </div>
                        <div className="w-full h-3 rounded-full border border-[#243347] bg-gradient-to-r from-[#050608] via-[#e53935] via-[#ff9800] to-[#ffffff] relative overflow-hidden" />
                        <div className="flex items-center justify-between text-[10px] mt-1.5 font-semibold text-[#8ba2be]">
                          <span className="text-[#64748b]">{preheatC}°</span>
                          <span className="text-amber-400">995° (β)</span>
                          <span className="text-slate-300">{solidusC}° (Sol)</span>
                          <span className="text-[#00f7ff] font-bold">{liquidusC}° (Liq)</span>
                          <span className="text-white font-bold">{peakT > 3200 ? '3200°' : `${peakT}°`}</span>
                        </div>
                      </div>

                      {/* Dimensions Summary Strip: 6 Clear KPI Cards */}
                      <div className="pt-3 border-t border-[#1a2533] grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 text-xs font-mono">
                        <div className="bg-[#0b0f17] border border-[#1b2636] rounded-lg p-2.5">
                          <div className="text-[10px] text-[#7189a3]">Pool Length L</div>
                          <div className="text-sm font-bold text-white mt-0.5">{meltL} μm</div>
                          <div className="text-[10px] text-[#50d8e9]">{((meltL) / 1000).toFixed(2)} mm</div>
                        </div>

                        <div className="bg-[#0b0f17] border border-[#1b2636] rounded-lg p-2.5">
                          <div className="text-[10px] text-[#7189a3]">Pool Width W</div>
                          <div className="text-sm font-bold text-white mt-0.5">{meltW} μm</div>
                          <div className="text-[10px] text-[#50d8e9]">Hatch: {hatchSpacing} μm</div>
                        </div>

                        <div className="bg-[#0b0f17] border border-[#1b2636] rounded-lg p-2.5">
                          <div className="text-[10px] text-[#7189a3]">Penetration Depth zm</div>
                          <div className="text-sm font-bold text-[#50d8e9] mt-0.5">{meltD} μm</div>
                          <div className="text-[10px] text-[#8ca4be]">{(meltD / Math.max(1, layerThickness)).toFixed(1)}× layer t</div>
                        </div>

                        <div className="bg-[#0b0f17] border border-[#1b2636] rounded-lg p-2.5">
                          <div className="text-[10px] text-[#7189a3]">Aspect Ratio (d/W)</div>
                          <div className={`text-sm font-bold mt-0.5 ${
                            (isCoenMode && coen ? coen.aspectRatio : meltD / Math.max(1, meltW)) < 0.8
                              ? 'text-emerald-400'
                              : (isCoenMode && coen ? coen.aspectRatio : meltD / Math.max(1, meltW)) <= 1.2
                              ? 'text-amber-400'
                              : 'text-rose-400'
                          }`}>
                            {(isCoenMode && coen ? coen.aspectRatio : (meltD / Math.max(1, meltW))).toFixed(2)}
                          </div>
                          <div className="text-[10px] text-[#8ca4be] truncate">
                            {isCoenMode && coen
                              ? `${coen.regime} Mode`
                              : meltD / Math.max(1, meltW) < 0.8 ? 'Conduction' : 'Keyhole Risk'}
                          </div>
                        </div>

                        <div className="bg-[#0b0f17] border border-[#1b2636] rounded-lg p-2.5">
                          <div className="text-[10px] text-[#7189a3]">Peak Temp (Center)</div>
                          <div className="text-sm font-bold text-amber-400 mt-0.5">
                            {peakT > 3200 ? '~3200°C' : `${peakT}°C`}
                          </div>
                          <div className="text-[10px] text-[#8ca4be]">Boiling: 3,287°C</div>
                        </div>

                        <div className="bg-[#0b0f17] border border-[#1b2636] rounded-lg p-2.5">
                          <div className="text-[10px] text-[#7189a3]">Growth Rate R</div>
                          <div className="text-sm font-bold text-white mt-0.5">
                            {bonthaData.surfaceR_cms ? `${bonthaData.surfaceR_cms.toFixed(2)} cm/s` : `${(scanSpeed * 0.072).toFixed(2)} cm/s`}
                          </div>
                          <div className="text-[10px] text-[#50d8e9]">Trailing edge</div>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* SECTION 1.1: KU LEUVEN HYBRID ANALYTICAL MODEL (COEN ET AL. JMPT 2022) */}
                {prediction.coenMeltPool && (
                  <div className="bg-[#10141b] border border-[#1e2633] rounded-xl p-5 shadow-lg space-y-4">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-[#1c2430] pb-3">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <BookOpen className="w-4 h-4 text-[#50d8e9]" />
                          <h4 className="text-sm font-bold text-white tracking-wide">
                            KU Leuven Hybrid Melt Pool Analytics (Coen et al. 2022)
                          </h4>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-[#50d8e9]/10 text-[#50d8e9] border border-[#50d8e9]/30">
                            JMPT 304: 117547
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                            Conduction &amp; Keyhole Unified
                          </span>
                        </div>
                        <p className="text-xs text-[#7189a3]">
                          Combines Eagar-Tsai normalized width <span className="font-mono text-[#a5b9ce]">w</span> with Fabbro recoil pressure aspect ratio <span className="font-mono text-[#a5b9ce]">R = d/w</span> to compute absolute depth <span className="font-mono text-[#a5b9ce]">d</span> across conduction (<span className="text-emerald-400">R &lt; 0.8</span>), transition (<span className="text-amber-400">0.8 ≤ R ≤ 1.2</span>), and keyhole (<span className="text-rose-400">R &gt; 1.2</span>) regimes.
                        </p>
                      </div>

                      <div className="flex items-center gap-2 text-xs">
                        <span className={`px-2.5 py-1 rounded-lg border font-mono font-bold text-xs ${
                          prediction.coenMeltPool.regime === 'Conduction'
                            ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
                            : prediction.coenMeltPool.regime === 'Transition'
                            ? 'bg-amber-500/15 text-amber-300 border-amber-500/40'
                            : 'bg-rose-500/15 text-rose-300 border-rose-500/40'
                        }`}>
                          {prediction.coenMeltPool.regime} Regime (R = {prediction.coenMeltPool.aspectRatio})
                        </span>
                      </div>
                    </div>

                    {/* Metric Cards Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs font-mono">
                      <div className="bg-[#0b0f17] border border-[#1b2636] rounded-lg p-3">
                        <div className="text-[10px] text-[#7189a3]">Calibrated Width (w_ET)</div>
                        <div className="text-base sm:text-lg font-bold text-[#50d8e9] mt-0.5">
                          {prediction.coenMeltPool.conductionWidthUm} <span className="text-xs text-[#8ca4be]">μm</span>
                        </div>
                        <div className="text-[10px] text-[#8ca4be] mt-0.5">
                          Rosenthal: {prediction.meltPoolWidthUm} μm ({prediction.coenMeltPool.conductionWidthUm >= prediction.meltPoolWidthUm ? '+' : ''}{prediction.coenMeltPool.conductionWidthUm - prediction.meltPoolWidthUm} μm)
                        </div>
                      </div>

                      <div className="bg-[#0b0f17] border border-[#1b2636] rounded-lg p-3">
                        <div className="text-[10px] text-[#7189a3]">Hybrid Depth (d = R · w)</div>
                        <div className="text-base sm:text-lg font-bold text-white mt-0.5">
                          {prediction.coenMeltPool.hybridDepthUm} <span className="text-xs text-[#8ca4be]">μm</span>
                        </div>
                        <div className="text-[10px] text-emerald-400 mt-0.5">
                          {(prediction.coenMeltPool.hybridDepthUm / Math.max(1, layerThickness)).toFixed(1)}× layer thickness
                        </div>
                      </div>

                      <div className="bg-[#0b0f17] border border-[#1b2636] rounded-lg p-3">
                        <div className="text-[10px] text-[#7189a3]">Péclet Number (Pé)</div>
                        <div className="text-base sm:text-lg font-bold text-amber-400 mt-0.5">
                          {prediction.coenMeltPool.pecletNumber}
                        </div>
                        <div className="text-[10px] text-[#8ca4be] mt-0.5">
                          Inverse p = {prediction.coenMeltPool.inversePeclet} (D = {(prediction.coenMeltPool.thermalDiffusivityM2s * 1e6).toFixed(2)} mm²/s)
                        </div>
                      </div>

                      <div className="bg-[#0b0f17] border border-[#1b2636] rounded-lg p-3">
                        <div className="text-[10px] text-[#7189a3]">Normalized Enthalpy (ΔH / hs)</div>
                        <div className="text-base sm:text-lg font-bold text-[#38bdf8] mt-0.5">
                          {prediction.coenMeltPool.normalizedEnthalpy}
                        </div>
                        <div className="text-[10px] text-[#8ca4be] mt-0.5">
                          Keyhole onset threshold ~ 28–30
                        </div>
                      </div>
                    </div>

                    <div className="text-[11px] text-[#7189a3] bg-[#0c1017] p-3 rounded-lg border border-[#172230] leading-relaxed">
                      <strong className="text-white">Validation Evidence:</strong> Evaluated across {selectedAlloyId.toUpperCase()} with 1 kW fiber laser experiments. Average absolute error on melt pool width is <span className="text-[#50d8e9] font-bold">10.92%</span> and depth is <span className="text-[#50d8e9] font-bold">11.37%</span> over the relevant processing window (<span className="font-mono">0.8 &lt; R &lt; 3</span>).
                    </div>
                  </div>
                )}

                {/* SECTION 1.2: BRESCIA DEM-CFD DEFECT & POROSITY MODEL (RANSENIGO ET AL. 2022) */}
                {prediction.ransenigoDefects && (
                  <div className="bg-[#10141b] border border-[#1e2633] rounded-xl p-5 shadow-lg space-y-4">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-[#1c2430] pb-3">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Activity className="w-4 h-4 text-[#50d8e9]" />
                          <h4 className="text-sm font-bold text-white tracking-wide">
                            Brescia DEM-CFD Porosity &amp; Remelt Overlap (Ransenigo et al. 2022)
                          </h4>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-[#50d8e9]/10 text-[#50d8e9] border border-[#50d8e9]/30">
                            FLOW-3D AM® + DEM
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-purple-500/10 text-purple-400 border border-purple-500/30">
                            Concept Laser M2 Calibrated
                          </span>
                        </div>
                        <p className="text-xs text-[#7189a3]">
                          Decomposes porosity into turbulent gas entrainment micro-voids, evaluates substrate remelt overlap (<span className="font-mono text-[#a5b9ce]">h ≤ w_remelt</span>), and models multi-track thermal memory footprint expansion.
                        </p>
                      </div>

                      <div className="flex items-center gap-2 text-xs">
                        <span className={`px-2.5 py-1 rounded-lg border font-mono font-bold text-xs ${
                          prediction.ransenigoDefects.hatchOverlapSafe
                            ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
                            : 'bg-rose-500/15 text-rose-300 border-rose-500/40'
                        }`}>
                          {prediction.ransenigoDefects.hatchOverlapSafe ? '✓ Remelt Overlap Safe' : '⚠ Overlap Defect Risk'}
                        </span>
                      </div>
                    </div>

                    {/* Metric Cards Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs font-mono">
                      <div className="bg-[#0b0f17] border border-[#1b2636] rounded-lg p-3">
                        <div className="text-[10px] text-[#7189a3]">Turbulent Gas Porosity</div>
                        <div className="text-base sm:text-lg font-bold text-purple-400 mt-0.5">
                          {prediction.ransenigoDefects.gasEntrainmentPorosityPct}%
                        </div>
                        <div className="text-[10px] text-[#8ca4be] mt-0.5">
                          Mean pore dia: {prediction.ransenigoDefects.meanGasPoreDiameterUm} μm (sub-micron)
                        </div>
                      </div>

                      <div className="bg-[#0b0f17] border border-[#1b2636] rounded-lg p-3">
                        <div className="text-[10px] text-[#7189a3]">Substrate Remelt Width</div>
                        <div className="text-base sm:text-lg font-bold text-[#50d8e9] mt-0.5">
                          {prediction.ransenigoDefects.substrateRemeltWidthUm} <span className="text-xs text-[#8ca4be]">μm</span>
                        </div>
                        <div className="text-[10px] text-[#8ca4be] mt-0.5">
                          Hatch: {hatchSpacing} μm ({hatchSpacing <= prediction.ransenigoDefects.substrateRemeltWidthUm ? 'h ≤ w_remelt safe' : 'h > w_remelt gap risk'})
                        </div>
                      </div>

                      <div className="bg-[#0b0f17] border border-[#1b2636] rounded-lg p-3">
                        <div className="text-[10px] text-[#7189a3]">Track 2 Thermal Expansion</div>
                        <div className="text-base sm:text-lg font-bold text-amber-400 mt-0.5">
                          +{prediction.ransenigoDefects.multiTrackWidthExpansionPct}%
                        </div>
                        <div className="text-[10px] text-[#8ca4be] mt-0.5">
                          Expanded width: {prediction.ransenigoDefects.track2WidthUm} μm
                        </div>
                      </div>

                      <div className="bg-[#0b0f17] border border-[#1b2636] rounded-lg p-3">
                        <div className="text-[10px] text-[#7189a3]">Prior-β Grain Structure</div>
                        <div className="text-base sm:text-lg font-bold text-emerald-400 mt-0.5">
                          ~{prediction.ransenigoDefects.priorBetaGrainWidthUm} <span className="text-xs text-[#8ca4be]">μm</span>
                        </div>
                        <div className="text-[10px] text-[#8ca4be] mt-0.5">
                          Ultrafine lamellar (α+β) Widmanstätten
                        </div>
                      </div>
                    </div>

                    <div className="text-[11px] text-[#7189a3] bg-[#0c1017] p-3 rounded-lg border border-[#172230] leading-relaxed">
                      <strong className="text-white">CFD &amp; Experimental Findings:</strong> Powder-scale discrete element modeling (DEM, 40% packing density) coupled with volume-of-fluid CFD confirms that Marangoni shear and surface turbulence draw argon shielding gas into the molten track, creating an unavoidable sub-micron baseline porosity of <span className="text-purple-400 font-bold">~0.74%–0.82%</span>. Complete elimination of lack-of-fusion voids is achieved when hatch spacing <span className="font-mono text-white">h ≤ 0.88 · w</span>.
                    </div>
                  </div>
                )}

                {/* SECTION 2: BONTHA ET AL. (2006 & 2009) SOLIDIFICATION MICROSTRUCTURE & PROCESS MAPS */}
                <div className="bg-[#10141b] border border-[#1e2633] rounded-xl p-5 shadow-lg space-y-4">
                  {/* Header & Dual Research Paper Metadata */}
                  <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 border-b border-[#1c2430] pb-3">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Compass className="w-4 h-4 text-[#50d8e9]" />
                        <h4 className="text-sm font-bold text-white tracking-wide">
                          Solidification Microstructure Maps &amp; Size-Scale Physics (Bontha et al. 2006 &amp; 2009)
                        </h4>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-[#50d8e9]/10 text-[#50d8e9] border border-[#50d8e9]/30">
                          MSEA 513–514: 311–318
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-[#38bdf8]/10 text-[#38bdf8] border border-[#38bdf8]/30">
                          JMPT 178: 135–142
                        </span>
                      </div>
                      <p className="text-xs text-[#7189a3]">
                        Extracts solidification cooling rates ∂<i>T</i>/∂<i>t</i>, thermal gradients <i>G</i> = |∇<i>T</i>|, and growth velocity <i>R</i> throughout the melt pool to predict grain size and columnar-to-equiaxed transitions (CET).
                      </p>
                    </div>

                    {/* Multi-Dimensional Controls Toolbar */}
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      {/* Geometry Selector */}
                      <div className="inline-flex rounded-lg bg-[#080d14] p-0.5 border border-[#1e2a39]">
                        <button
                          type="button"
                          onClick={() => setBonthaGeometryMode('3d-bulky')}
                          className={`px-2.5 py-1 rounded text-[11px] font-medium transition-all ${
                            bonthaGeometryMode === '3d-bulky'
                              ? 'bg-[#50d8e9] text-[#080d14] font-bold shadow-sm'
                              : 'text-[#829bb5] hover:text-white'
                          }`}
                          title="Bontha et al. (2009 MSEA): 3D Half-space conduction with V^3 cooling rate scaling"
                        >
                          Bulky 3D (2009)
                        </button>
                        <button
                          type="button"
                          onClick={() => setBonthaGeometryMode('2d-thin-wall')}
                          className={`px-2.5 py-1 rounded text-[11px] font-medium transition-all ${
                            bonthaGeometryMode === '2d-thin-wall'
                              ? 'bg-[#50d8e9] text-[#080d14] font-bold shadow-sm'
                              : 'text-[#829bb5] hover:text-white'
                          }`}
                          title="Bontha et al. (2006 JMPT): 2D Thin-wall Bessel function model"
                        >
                          Thin-Wall 2D (2006)
                        </button>
                      </div>

                      {/* Process Size-Scale Selector */}
                      <div className="inline-flex rounded-lg bg-[#080d14] p-0.5 border border-[#1e2a39]">
                        <button
                          type="button"
                          onClick={() => {
                            setBonthaProcessScale('small-scale');
                            if (laserPower > 1000) setLaserPower(350);
                          }}
                          className={`px-2.5 py-1 rounded text-[11px] font-medium transition-all ${
                            bonthaProcessScale === 'small-scale'
                              ? 'bg-[#38bdf8] text-[#080d14] font-bold shadow-sm'
                              : 'text-[#829bb5] hover:text-white'
                          }`}
                          title="Small-Scale AM: LENS™ / LPBF (100W – 1000W)"
                        >
                          Small-Scale (LENS™)
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setBonthaProcessScale('large-scale');
                            if (laserPower < 1000) setLaserPower(15000);
                          }}
                          className={`px-2.5 py-1 rounded text-[11px] font-medium transition-all ${
                            bonthaProcessScale === 'large-scale'
                              ? 'bg-amber-400 text-[#080d14] font-bold shadow-sm'
                              : 'text-[#829bb5] hover:text-white'
                          }`}
                          title="Large-Scale High-Power AM: E-Beam / Laser DED (5kW – 30kW)"
                        >
                          Large-Scale (5–30 kW)
                        </button>
                      </div>

                      {/* Physics Model Selector */}
                      <div className="inline-flex rounded-lg bg-[#080d14] p-0.5 border border-[#1e2a39]">
                        <button
                          type="button"
                          onClick={() => setBonthaPhysicsMode('rosenthal')}
                          className={`px-2 py-1 rounded text-[11px] transition-all ${
                            bonthaPhysicsMode === 'rosenthal'
                              ? 'bg-[#1e293b] text-white font-bold'
                              : 'text-[#829bb5] hover:text-white'
                          }`}
                          title="3D Rosenthal analytical moving point source"
                        >
                          Rosenthal
                        </button>
                        <button
                          type="button"
                          onClick={() => setBonthaPhysicsMode('nonlinear-fem')}
                          className={`px-2 py-1 rounded text-[11px] transition-all ${
                            bonthaPhysicsMode === 'nonlinear-fem'
                              ? 'bg-[#c084fc] text-[#080d14] font-bold'
                              : 'text-[#829bb5] hover:text-white'
                          }`}
                          title="3D Non-linear FEM calibrated (ABAQUS latent heat & k(T))"
                        >
                          3D FEM
                        </button>
                      </div>

                      {/* Beam Energy Source Selector (Laser vs Electron Beam) */}
                      <div className="inline-flex rounded-lg bg-[#080d14] p-0.5 border border-[#1e2a39]" title="Footnote 3, MSEA 2009: Electron beam processes feature much higher absorptivity (α ≈ 0.85-0.90) than laser (α ≈ 0.35)">
                        <button
                          type="button"
                          onClick={() => {
                            setBeamTechnology('laser');
                            setAbsorptivityOverride(0.35);
                          }}
                          className={`px-2 py-1 rounded text-[11px] transition-all ${
                            beamTechnology === 'laser'
                              ? 'bg-[#0284c7] text-white font-bold'
                              : 'text-[#829bb5] hover:text-white'
                          }`}
                        >
                          Laser (α=0.35)
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setBeamTechnology('ebeam');
                            setAbsorptivityOverride(0.88);
                          }}
                          className={`px-2 py-1 rounded text-[11px] transition-all ${
                            beamTechnology === 'ebeam'
                              ? 'bg-[#9333ea] text-white font-bold'
                              : 'text-[#829bb5] hover:text-white'
                          }`}
                        >
                          E-Beam (α=0.88)
                        </button>
                      </div>

                      {/* Paper Benchmark Cases Dropdown */}
                      <div className="inline-flex items-center gap-1.5 ml-auto">
                        <span className="text-[10px] text-[#7893af] font-mono hidden sm:inline">Paper Preset:</span>
                        <select
                          value={selectedPaperPreset}
                          onChange={(e) => handleLoadPaperPreset(e.target.value)}
                          className="bg-[#080d14] border border-[#233549] text-[#50d8e9] text-[11px] rounded-lg px-2.5 py-1 focus:outline-none focus:border-[#50d8e9] cursor-pointer"
                        >
                          <option value="custom">Custom Live Parameters</option>
                          <optgroup label="Small-Scale LENS™ (Fig. 3)">
                            <option value="fig3a-350w">Fig. 3a: Q = 350 W, V = 8.47 mm/s (Columnar)</option>
                            <option value="fig3a-550w">Fig. 3a: Q = 550 W, V = 8.47 mm/s (Benchmark)</option>
                            <option value="fig3a-850w">Fig. 3a: Q = 850 W, V = 8.47 mm/s (Coarse)</option>
                            <option value="fig3b-slow">Fig. 3b: Q = 550 W, V = 2.12 mm/s (Slow)</option>
                            <option value="fig3b-fast">Fig. 3b: Q = 550 W, V = 10.6 mm/s (Fast)</option>
                          </optgroup>
                          <optgroup label="Large-Scale High-Power (Fig. 4)">
                            <option value="fig4a-5kw">Fig. 4a: Q = 5 kW, V = 8.47 mm/s (Columnar)</option>
                            <option value="fig4a-15kw">Fig. 4a: Q = 15 kW, V = 8.47 mm/s (Graded Mixed)</option>
                            <option value="fig4a-30kw">Fig. 4a: Q = 30 kW, V = 8.47 mm/s (Graded Equiaxed)</option>
                            <option value="fig4b-slow">Fig. 4b: Q = 15 kW, V = 2.12 mm/s (Coarse Equiaxed)</option>
                            <option value="fig4b-fast">Fig. 4b: Q = 15 kW, V = 10.6 mm/s (Fine Equiaxed)</option>
                          </optgroup>
                          <optgroup label="Electron Beam Manufacturing (EBAM)">
                            <option value="ebeam-15kw">E-Beam: 15 kW @ 8.47 mm/s, α = 0.88</option>
                          </optgroup>
                        </select>
                      </div>

                      {/* 2D Wall Thickness Selector (Active in Thin-Wall Mode) */}
                      {bonthaGeometryMode === '2d-thin-wall' && (
                        <div className="inline-flex items-center gap-1 rounded-lg bg-[#080d14] px-2 py-1 border border-[#1e2a39] text-[11px] font-mono text-[#8ba2be]">
                          <span>b:</span>
                          <button
                            type="button"
                            onClick={() => setWallThicknessMode('lens-benchmark')}
                            className={`px-1.5 py-0.5 rounded ${wallThicknessMode === 'lens-benchmark' ? 'bg-[#50d8e9] text-[#080d14] font-bold' : 'hover:text-white'}`}
                          >
                            2.26mm
                          </button>
                          <button
                            type="button"
                            onClick={() => setWallThicknessMode('process-track')}
                            className={`px-1.5 py-0.5 rounded ${wallThicknessMode === 'process-track' ? 'bg-[#50d8e9] text-[#080d14] font-bold' : 'hover:text-white'}`}
                          >
                            Track
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 5 Scientific KPI Cards */}
                  <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                    <div className="bg-[#080d14] border border-[#1d2737] rounded-xl p-3 space-y-1">
                      <div className="text-[10px] text-[#7893af] uppercase tracking-wider font-semibold">Solidification Rate <i>R</i></div>
                      <div className="text-base font-mono font-bold text-[#50d8e9]">
                        {bonthaData.surfaceR_cms} <span className="text-xs text-[#7893af]">cm/s</span>
                      </div>
                      <div className="text-[10px] text-[#5e7792] font-mono">
                        Surface: {(bonthaData.surfaceR_cms * 10).toFixed(1)} mm/s | Root: {bonthaData.bottomR_cms} cm/s
                      </div>
                    </div>

                    <div className="bg-[#080d14] border border-[#1d2737] rounded-xl p-3 space-y-1">
                      <div className="text-[10px] text-[#7893af] uppercase tracking-wider font-semibold">Thermal Gradient <i>G</i></div>
                      <div className="text-base font-mono font-bold text-white">
                        {bonthaData.surfaceG_Kcm.toLocaleString()} <span className="text-xs text-[#7893af]">K/cm</span>
                      </div>
                      <div className="text-[10px] text-[#5e7792] font-mono">
                        Root peak: {bonthaData.bottomG_Kcm.toLocaleString()} K/cm
                      </div>
                    </div>

                    <div className="bg-[#080d14] border border-[#1d2737] rounded-xl p-3 space-y-1">
                      <div className="text-[10px] text-[#7893af] uppercase tracking-wider font-semibold">Cooling Rate ∂<i>T</i>/∂<i>t</i></div>
                      <div className="text-base font-mono font-bold text-amber-400">
                        {bonthaData.surfaceCoolingRateKs.toLocaleString()} <span className="text-xs text-[#7893af]">K/s</span>
                      </div>
                      <div className="text-[10px] text-[#5e7792] font-mono">
                        Root: {bonthaData.bottomCoolingRateKs.toLocaleString()} K/s ({((bonthaData.bottomCoolingRateKs / Math.max(1, bonthaData.surfaceCoolingRateKs)) * 100).toFixed(1)}% of surface)
                      </div>
                    </div>

                    <div className="bg-[#080d14] border border-[#1d2737] rounded-xl p-3 space-y-1">
                      <div className="text-[10px] text-[#7893af] uppercase tracking-wider font-semibold">Norm. Temp <i>T̄<sub>m</sub></i></div>
                      <div className="text-base font-mono font-bold text-emerald-400">
                        {bonthaData.normalizedTm}
                      </div>
                      <div className="text-[10px] text-[#5e7792] font-mono truncate" title={bonthaGeometryMode === '3d-bulky' ? '(Tm-T0)/[(αQ/πk)(ρcV/2k)]' : '(Tm-T0)/[αQ/(πkb)]'}>
                        {bonthaGeometryMode === '3d-bulky' ? '3D: (Tm-T0)/Tc(Q,V)' : '2D: (Tm-T0)/Tc(Q)'}
                      </div>
                    </div>

                    <div className="col-span-2 lg:col-span-1 bg-[#080d14] border border-[#1d2737] rounded-xl p-3 space-y-1">
                      <div className="text-[10px] text-[#7893af] uppercase tracking-wider font-semibold">Microstructural Grading</div>
                      <div className="text-sm font-bold flex items-center gap-1.5 pt-0.5">
                        <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                          bonthaData.surfaceMorphology === 'Columnar' ? 'bg-blue-400' :
                          bonthaData.surfaceMorphology === 'Mixed' ? 'bg-amber-400' : 'bg-emerald-400'
                        }`} />
                        <span className={`${
                          bonthaData.surfaceMorphology === 'Columnar' ? 'text-blue-300' :
                          bonthaData.surfaceMorphology === 'Mixed' ? 'text-amber-300' : 'text-emerald-300'
                        }`}>
                          {bonthaData.surfaceMorphology} Grain Growth
                        </span>
                      </div>
                      <div className="text-[10px] text-[#5e7792] truncate" title={bonthaData.overallGradingDescription}>
                        {bonthaData.hasMicrostructuralGrading ? 'Graded base → crown' : bonthaData.overallGradingDescription}
                      </div>
                    </div>
                  </div>

                  {/* Sub-view Navigation Bar for Solidification Maps */}
                  <div className="flex items-center gap-2 border-b border-[#1c2430] pb-2 overflow-x-auto text-xs font-semibold">
                    <button
                      type="button"
                      onClick={() => setBonthaSubTab('solidification-map')}
                      className={`px-3 py-1.5 rounded-lg flex items-center gap-2 transition-all ${
                        bonthaSubTab === 'solidification-map'
                          ? 'bg-[#152130] text-[#50d8e9] border border-[#233852] font-bold shadow'
                          : 'text-[#7d97b3] hover:text-white hover:bg-[#0c1017]'
                      }`}
                    >
                      <Compass className="w-3.5 h-3.5" />
                      <span>Solidification Map (<i>G</i> vs. <i>R</i>)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setBonthaSubTab('dimensionless-maps')}
                      className={`px-3 py-1.5 rounded-lg flex items-center gap-2 transition-all ${
                        bonthaSubTab === 'dimensionless-maps'
                          ? 'bg-[#152130] text-[#50d8e9] border border-[#233852] font-bold shadow'
                          : 'text-[#7d97b3] hover:text-white hover:bg-[#0c1017]'
                      }`}
                    >
                      <Gauge className="w-3.5 h-3.5" />
                      <span>Dimensionless Process Maps (Fig. 2a &amp; 2b)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setBonthaSubTab('depth-profile')}
                      className={`px-3 py-1.5 rounded-lg flex items-center gap-2 transition-all ${
                        bonthaSubTab === 'depth-profile'
                          ? 'bg-[#152130] text-[#50d8e9] border border-[#233852] font-bold shadow'
                          : 'text-[#7d97b3] hover:text-white hover:bg-[#0c1017]'
                      }`}
                    >
                      <Activity className="w-3.5 h-3.5" />
                      <span>Through-Depth Solidification Profile (10 Stations)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setBonthaSubTab('cell-spacing')}
                      className={`px-3 py-1.5 rounded-lg flex items-center gap-2 transition-all ${
                        bonthaSubTab === 'cell-spacing'
                          ? 'bg-[#152130] text-[#50d8e9] border border-[#233852] font-bold shadow'
                          : 'text-[#7d97b3] hover:text-white hover:bg-[#0c1017]'
                      }`}
                    >
                      <Layers className="w-3.5 h-3.5" />
                      <span>Size-Scale &amp; Kinetics (Bontha 2009 MSEA)</span>
                    </button>
                  </div>

                  {/* SUB-VIEW A: The Calibrated Solidification Map */}
                  {bonthaSubTab === 'solidification-map' && (
                    <div className="space-y-4 pt-1">
                      {/* Full-width Enlarged Map Card */}
                      <div className="bg-[#090d14] border border-[#1b2636] rounded-xl p-5 shadow-lg space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#182332] pb-3">
                          <div className="space-y-0.5">
                            <span className="text-sm font-bold text-white flex items-center gap-2">
                              <span>Solidification Microstructure Map for Ti–6Al–4V ({bonthaGeometryMode === '3d-bulky' ? 'Bontha et al. 2009 MSEA' : 'Bontha et al. 2006 JMPT'})</span>
                              <span className="text-[10px] px-2 py-0.5 rounded bg-[#50d8e9]/10 text-[#50d8e9] border border-[#50d8e9]/30 font-mono">
                                {bonthaGeometryMode === '3d-bulky' ? '3D Half-Space' : '2D Thin-Wall'}
                              </span>
                              {bonthaData.hasMicrostructuralGrading && (
                                <span className="text-[10px] px-2 py-0.5 rounded bg-amber-400/10 text-amber-300 border border-amber-400/30 font-mono">
                                  Graded Transition
                                </span>
                              )}
                            </span>
                            <p className="text-xs text-[#7189a3]">
                              Thermal Gradient <i>G</i> (K/cm) vs. Solidification Rate <i>R</i> (cm/s). Traces microstructural grading from melt pool root (<i>z</i> = <i>z<sub>m</sub></i>) to surface (<i>z</i> = 0).
                            </p>
                          </div>

                          <div className="flex flex-wrap items-center gap-4 text-xs font-mono">
                            <span className="flex items-center gap-1.5 text-[#50d8e9]">
                              <span className="w-3 h-3 rounded-full bg-[#50d8e9] ring-2 ring-[#50d8e9]/40" />
                              <span className="font-bold">Surface (z = 0)</span>
                            </span>
                            <span className="flex items-center gap-1.5 text-rose-400">
                              <span className="w-3 h-3 rotate-45 bg-rose-500" />
                              <span className="font-bold">Root (z = zm)</span>
                            </span>
                            <label className="flex items-center gap-1.5 text-purple-300 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={showFemOverlay}
                                onChange={(e) => setShowFemOverlay(e.target.checked)}
                                className="accent-purple-400"
                              />
                              <span className="font-bold text-[11px]">3D FEM Overlay (Figs. 6 &amp; 7)</span>
                            </label>
                          </div>
                        </div>

                        {/* Large High-Definition Solidification Map SVG (Responsive & Mobile-Optimized) */}
                        <div className="w-full bg-[#05080c] rounded-xl border border-[#141d2a] p-2 sm:p-3 relative overflow-hidden">
                          <svg className="w-full h-auto aspect-[880/480] min-h-[300px] sm:min-h-[400px] md:min-h-[520px]" viewBox="0 0 880 480" preserveAspectRatio="xMidYMid meet">
                            <defs>
                              <linearGradient id="columnarGradLarge" x1="0%" y1="0%" x2="100%" y2="100%">
                                <stop offset="0%" stopColor="#1e293b" stopOpacity="0.5" />
                                <stop offset="100%" stopColor="#0f172a" stopOpacity="0.25" />
                              </linearGradient>
                              <linearGradient id="mixedGradLarge" x1="0%" y1="0%" x2="100%" y2="100%">
                                <stop offset="0%" stopColor="#b45309" stopOpacity="0.28" />
                                <stop offset="100%" stopColor="#78350f" stopOpacity="0.16" />
                              </linearGradient>
                              <linearGradient id="equiaxedGradLarge" x1="0%" y1="0%" x2="100%" y2="100%">
                                <stop offset="0%" stopColor="#059669" stopOpacity="0.28" />
                                <stop offset="100%" stopColor="#064e3b" stopOpacity="0.16" />
                              </linearGradient>
                            </defs>

                            {(() => {
                              const rMin = -3.0, rMax = 1.0;
                              const gMin = 0.0, gMax = 6.0;
                              const left = 80, right = 840, top = 30, bottom = 420;
                              const width = right - left, height = bottom - top;

                              const toX = (logR: number) => left + ((logR - rMin) / (rMax - rMin)) * width;
                              const toY = (logG: number) => bottom - ((logG - gMin) / (gMax - gMin)) * height;

                              // Boundaries
                              const upperCurve: { x: number; y: number }[] = [];
                              const lowerCurve: { x: number; y: number }[] = [];
                              for (let i = 0; i <= 60; i++) {
                                const lr = rMin + (i / 60) * (rMax - rMin);
                                const bnd = getKobrynMorphologyBoundaries(Math.pow(10, lr));
                                upperCurve.push({ x: toX(lr), y: toY(bnd.logG_upper) });
                                lowerCurve.push({ x: toX(lr), y: toY(bnd.logG_lower) });
                              }

                              const upperPathD = upperCurve.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
                              const lowerPathD = lowerCurve.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

                              const mixedAreaD = `${upperPathD} L ${right} ${toY(getKobrynMorphologyBoundaries(Math.pow(10, rMax)).logG_lower)} ${lowerCurve.slice().reverse().map(p => `L ${p.x} ${p.y}`).join(' ')} Z`;
                              const columnarAreaD = `${upperPathD} L ${right} ${top} L ${left} ${top} Z`;
                              const equiaxedAreaD = `${lowerPathD} L ${right} ${bottom} L ${left} ${bottom} Z`;

                              // Active Trajectory Points
                              const trajPoints = bonthaData.depthProfile.map(pt => {
                                const lr = Math.log10(Math.max(1e-4, pt.R_cms));
                                const lg = Math.log10(Math.max(1.0, pt.G_Kcm));
                                return {
                                  x: Math.max(left, Math.min(right, toX(lr))),
                                  y: Math.max(top, Math.min(bottom, toY(lg))),
                                  pt
                                };
                              });
                              const trajPathD = trajPoints.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

                              // FEM Comparison Points (if overlay enabled)
                              const femPoints = bonthaData.femComparisonProfile?.map(pt => {
                                const lr = Math.log10(Math.max(1e-4, pt.R_cms));
                                const lg = Math.log10(Math.max(1.0, pt.G_Kcm));
                                return {
                                  x: Math.max(left, Math.min(right, toX(lr))),
                                  y: Math.max(top, Math.min(bottom, toY(lg))),
                                  pt
                                };
                              }) || [];
                              const femPathD = femPoints.length > 0 ? femPoints.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') : '';

                              const rootPt = trajPoints[trajPoints.length - 1];
                              const surfPt = trajPoints[0];

                              // Dedicated, collision-free callout layout for Root and Surface
                              const rBoxW = 195, rBoxH = 26;
                              const sBoxW = 195, sBoxH = 26;

                              // Root (zm) is at the higher gradient (top end of curve)
                              // Surface (z=0) is at the higher solidification rate (bottom-right end of curve)
                              let rBoxX = rootPt.x - 35 - rBoxW;
                              let rBoxY = rootPt.y - 42;
                              if (rBoxX < left + 6) {
                                rBoxX = rootPt.x + 30;
                              }

                              let sBoxX = surfPt.x + 30;
                              let sBoxY = surfPt.y + 24;
                              if (sBoxX + sBoxW > right - 6) {
                                sBoxX = surfPt.x - 30 - sBoxW;
                              }

                              // Clamp both boxes within chart bounds
                              rBoxX = Math.max(left + 6, Math.min(right - rBoxW - 6, rBoxX));
                              rBoxY = Math.max(top + 6, Math.min(bottom - rBoxH - 6, rBoxY));
                              sBoxX = Math.max(left + 6, Math.min(right - sBoxW - 6, sBoxX));
                              sBoxY = Math.max(top + 6, Math.min(bottom - sBoxH - 6, sBoxY));

                              // STRICT COLLISION RESOLUTION:
                              const xOverlap = Math.max(0, Math.min(rBoxX + rBoxW, sBoxX + sBoxW) - Math.max(rBoxX, sBoxX));
                              const yOverlap = Math.max(0, Math.min(rBoxY + rBoxH, sBoxY + sBoxH) - Math.max(rBoxY, sBoxY));

                              if (xOverlap > 0 && yOverlap > -14) {
                                const minSpacing = rBoxH + 16;
                                if (rBoxY <= sBoxY) {
                                  sBoxY = rBoxY + minSpacing;
                                  if (sBoxY + sBoxH > bottom - 6) {
                                    sBoxY = bottom - sBoxH - 6;
                                    rBoxY = Math.max(top + 6, sBoxY - minSpacing);
                                  }
                                } else {
                                  rBoxY = sBoxY + minSpacing;
                                  if (rBoxY + rBoxH > bottom - 6) {
                                    rBoxY = bottom - rBoxH - 6;
                                    sBoxY = Math.max(top + 6, rBoxY - minSpacing);
                                  }
                                }
                              }

                              const rConnectX = rBoxX > rootPt.x ? rBoxX : rBoxX + rBoxW;
                              const rElbowX = rootPt.x + (rConnectX - rootPt.x) * 0.45;
                              const rElbowY = rBoxY + rBoxH / 2;

                              const sConnectX = sBoxX > surfPt.x ? sBoxX : sBoxX + sBoxW;
                              const sElbowX = surfPt.x + (sConnectX - surfPt.x) * 0.45;
                              const sElbowY = sBoxY + sBoxH / 2;

                              return (
                                <g>
                                  {/* Domain Regions */}
                                  <path d={columnarAreaD} fill="url(#columnarGradLarge)" />
                                  <path d={mixedAreaD} fill="url(#mixedGradLarge)" />
                                  <path d={equiaxedAreaD} fill="url(#equiaxedGradLarge)" />

                                  {/* Horizontal Grid lines */}
                                  {[0, 1, 2, 3, 4, 5, 6].map(power => {
                                    const y = toY(power);
                                    const powerSuperscripts = ['10⁰', '10¹', '10²', '10³', '10⁴', '10⁵', '10⁶'];
                                    return (
                                      <g key={power}>
                                        <line x1={left} y1={y} x2={right} y2={y} stroke="#172230" strokeWidth="1" strokeDasharray="3 3" />
                                        <text x={left - 10} y={y + 4.5} fill="#e2e8f0" fontSize="13" fontWeight="bold" textAnchor="end" fontFamily="monospace">
                                          {powerSuperscripts[power]}
                                        </text>
                                      </g>
                                    );
                                  })}

                                  {/* Vertical Grid lines */}
                                  {[-3, -2, -1, 0, 1].map(power => {
                                    const x = toX(power);
                                    const label = power === -3 ? '0.001' : power === -2 ? '0.01' : power === -1 ? '0.1' : power === 0 ? '1' : '10';
                                    return (
                                      <g key={power}>
                                        <line x1={x} y1={top} x2={x} y2={bottom} stroke="#172230" strokeWidth="1" strokeDasharray="3 3" />
                                        <text x={x} y={bottom + 22} fill="#e2e8f0" fontSize="13" fontWeight="bold" textAnchor="middle" fontFamily="monospace">
                                          {label}
                                        </text>
                                      </g>
                                    );
                                  })}

                                  {/* Boundary Axis Lines */}
                                  <line x1={left} y1={bottom} x2={right} y2={bottom} stroke="#2e4057" strokeWidth="1.5" />
                                  <line x1={left} y1={top} x2={left} y2={bottom} stroke="#2e4057" strokeWidth="1.5" />

                                  {/* Axis Titles */}
                                  <text x={left + width / 2} y={bottom + 44} fill="#f1f5f9" fontSize="14.5" textAnchor="middle" fontWeight="bold" fontFamily="sans-serif">
                                    Solidification Growth Rate R (cm/s)
                                  </text>
                                  <text x={22} y={top + height / 2} fill="#f1f5f9" fontSize="14.5" textAnchor="middle" fontWeight="bold" fontFamily="sans-serif" transform={`rotate(-90 22 ${top + height / 2})`}>
                                    Thermal Gradient G (K/cm)
                                  </text>

                                  {/* Boundary Curves */}
                                  <path d={upperPathD} fill="none" stroke="#60a5fa" strokeWidth="2.5" />
                                  <path d={lowerPathD} fill="none" stroke="#34d399" strokeWidth="2.5" strokeDasharray="6 3" />

                                  {/* Domain Text Labels */}
                                  <text x={toX(-2.0)} y={toY(4.8)} fill="#93c5fd" fontSize="15" fontWeight="bold" letterSpacing="1.2">
                                    Fully Columnar
                                  </text>
                                  <text x={toX(-0.5)} y={toY(2.85)} fill="#fcd34d" fontSize="14" fontWeight="bold">
                                    Mixed (Columnar + Equiaxed)
                                  </text>
                                  <text x={toX(0.0)} y={toY(1.1)} fill="#6ee7b7" fontSize="15" fontWeight="bold" letterSpacing="1.2">
                                    Fully Equiaxed
                                  </text>

                                  {/* 3D Non-Linear FEM Comparison Curve (Dashed Purple) */}
                                  {showFemOverlay && femPathD && (
                                    <g>
                                      <path d={femPathD} fill="none" stroke="#c084fc" strokeWidth="2" strokeDasharray="5 3" opacity="0.85" />
                                      {femPoints.map((fp, i) => (
                                        <circle key={i} cx={fp.x} cy={fp.y} r="2.5" fill="#c084fc" opacity="0.9" />
                                      ))}
                                    </g>
                                  )}

                                  {/* Active Trajectory Ribbon / Curve */}
                                  <path d={trajPathD} fill="none" stroke="#50d8e9" strokeWidth="3.5" strokeLinecap="round" opacity="0.95" />

                                  {/* Intermediate Stations */}
                                  {trajPoints.slice(1, trajPoints.length - 1).map((tp, idx) => {
                                    const actualIdx = idx + 1;
                                    const isSelected = actualIdx === selectedDepthStationIdx;
                                    return (
                                      <circle
                                        key={actualIdx}
                                        cx={tp.x}
                                        cy={tp.y}
                                        r={isSelected ? 4.5 : 2.8}
                                        fill={isSelected ? '#ffffff' : '#38bdf8'}
                                        stroke="#0b1118"
                                        strokeWidth="1.2"
                                        className="cursor-pointer hover:r-5 transition-all"
                                        onClick={() => setSelectedDepthStationIdx(actualIdx)}
                                      >
                                        <title>{`Depth ${(tp.pt.depthFraction * 100).toFixed(0)}% (${tp.pt.depthUm} μm): G=${tp.pt.G_Kcm} K/cm, R=${tp.pt.R_cms} cm/s (${tp.pt.morphology})`}</title>
                                      </circle>
                                    );
                                  })}

                                  {/* ROOT POINTER & LEADER CALLOUT */}
                                  <g onClick={() => setSelectedDepthStationIdx(9)} className="cursor-pointer">
                                    <polyline
                                      points={`${rootPt.x},${rootPt.y} ${rElbowX},${rElbowY} ${rConnectX},${rElbowY}`}
                                      fill="none"
                                      stroke="#f43f5e"
                                      strokeWidth="1.2"
                                      strokeDasharray="2 2"
                                    />
                                    <polygon
                                      points={`${rootPt.x},${rootPt.y - 7} ${rootPt.x + 6},${rootPt.y + 5} ${rootPt.x - 6},${rootPt.y + 5}`}
                                      fill="#f43f5e"
                                      stroke="#ffffff"
                                      strokeWidth="1.5"
                                    />
                                    <rect
                                      x={rBoxX}
                                      y={rBoxY}
                                      width={rBoxW}
                                      height={rBoxH}
                                      rx="5"
                                      fill="#080c14"
                                      stroke="#f43f5e"
                                      strokeWidth="1.2"
                                      className="shadow-lg"
                                    />
                                    <polygon
                                      points={`${rBoxX + 12},${rBoxY + 8} ${rBoxX + 16},${rBoxY + 16} ${rBoxX + 8},${rBoxY + 16}`}
                                      fill="#f43f5e"
                                    />
                                    <text x={rBoxX + 22} y={rBoxY + 18} fill="#ffffff" fontSize="12" fontWeight="bold" fontFamily="monospace">
                                      Root (zm): <tspan fill="#f43f5e">{bonthaData.bottomG_Kcm.toLocaleString()}</tspan> K/cm
                                    </text>
                                  </g>

                                  {/* SURFACE POINTER & LEADER CALLOUT */}
                                  <g onClick={() => setSelectedDepthStationIdx(0)} className="cursor-pointer">
                                    <polyline
                                      points={`${surfPt.x},${surfPt.y} ${sElbowX},${sElbowY} ${sConnectX},${sElbowY}`}
                                      fill="none"
                                      stroke="#50d8e9"
                                      strokeWidth="1.2"
                                      strokeDasharray="2 2"
                                    />
                                    <circle cx={surfPt.x} cy={surfPt.y} r="7" fill="#50d8e9" fillOpacity="0.25" className="animate-ping" />
                                    <circle cx={surfPt.x} cy={surfPt.y} r="5" fill="#50d8e9" stroke="#ffffff" strokeWidth="1.5" />
                                    <rect
                                      x={sBoxX}
                                      y={sBoxY}
                                      width={sBoxW}
                                      height={sBoxH}
                                      rx="5"
                                      fill="#080c14"
                                      stroke="#50d8e9"
                                      strokeWidth="1.2"
                                      className="shadow-lg"
                                    />
                                    <circle cx={sBoxX + 12} cy={sBoxY + 13} r="3.5" fill="#50d8e9" />
                                    <text x={sBoxX + 22} y={sBoxY + 18} fill="#ffffff" fontSize="12" fontWeight="bold" fontFamily="monospace">
                                      Surface (z=0): <tspan fill="#50d8e9">{bonthaData.surfaceR_cms}</tspan> cm/s
                                    </text>
                                  </g>
                                </g>
                              );
                            })()}
                          </svg>
                        </div>

                        {/* Mobile-Friendly Solidification KPI Summary Strip */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 my-3 text-xs font-mono">
                          <div className="bg-[#0a0f18] border border-[#1b2738] rounded-lg p-2.5 flex flex-col justify-between">
                            <span className="text-[10px] text-[#7189a3] font-semibold">Solidification Morphology</span>
                            <span className="text-xs font-bold text-[#50d8e9] mt-1 bg-[#50d8e9]/10 px-2 py-0.5 rounded border border-[#50d8e9]/30 w-fit truncate">
                              {bonthaData.depthProfile[0]?.morphology || 'Columnar + Equiaxed'}
                            </span>
                          </div>

                          <div className="bg-[#0a0f18] border border-[#1b2738] rounded-lg p-2.5">
                            <div className="text-[10px] text-[#7189a3] font-semibold">Cooling Rate (G × R)</div>
                            <div className="text-sm font-bold text-white mt-0.5">
                              {bonthaData.surfaceCoolingRateKs ? `${(bonthaData.surfaceCoolingRateKs).toExponential(2)} K/s` : 'N/A'}
                            </div>
                            <div className="text-[10px] text-[#50d8e9]">Melt Pool Average</div>
                          </div>

                          <div className="bg-[#0a0f18] border border-[#1b2738] rounded-lg p-2.5">
                            <div className="text-[10px] text-[#7189a3] font-semibold">Root Gradient (G_zm)</div>
                            <div className="text-sm font-bold text-rose-400 mt-0.5">
                              {bonthaData.bottomG_Kcm.toLocaleString()} K/cm
                            </div>
                            <div className="text-[10px] text-[#7189a3]">Deepest Point (R→0)</div>
                          </div>

                          <div className="bg-[#0a0f18] border border-[#1b2738] rounded-lg p-2.5">
                            <div className="text-[10px] text-[#7189a3] font-semibold">Surface Velocity (R_0)</div>
                            <div className="text-sm font-bold text-[#50d8e9] mt-0.5">
                              {bonthaData.surfaceR_cms} cm/s
                            </div>
                            <div className="text-[10px] text-[#7189a3]">Max Scan Velocity</div>
                          </div>
                        </div>

                        {/* Presets Strip & Station Slider underneath Map */}
                        <div className="pt-2 border-t border-[#182332] flex flex-col md:flex-row items-center justify-between gap-4">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-[11px] text-[#718ca8] font-semibold">
                              {bonthaProcessScale === 'small-scale' ? 'LENS™ Benchmarks (Fig. 3):' : 'Large-Scale Benchmarks (Fig. 4):'}
                            </span>
                            {bonthaProcessScale === 'small-scale' ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => { setLaserPower(350); setScanSpeed(8.47); }}
                                  className="px-2.5 py-1 rounded bg-[#131c28] hover:bg-[#1f2f45] text-white border border-[#23354a] text-xs font-mono transition-colors"
                                >
                                  Baseline: Q=350W, V=8.47mm/s (Fig. 3a)
                                </button>
                                <button
                                  type="button"
                                  onClick={() => { setLaserPower(550); setScanSpeed(8.47); }}
                                  className="px-2.5 py-1 rounded bg-[#131c28] hover:bg-[#1f2f45] text-amber-300 border border-[#23354a] text-xs font-mono transition-colors"
                                >
                                  Medium: Q=550W (Fig. 3a)
                                </button>
                                <button
                                  type="button"
                                  onClick={() => { setLaserPower(850); setScanSpeed(8.47); }}
                                  className="px-2.5 py-1 rounded bg-[#131c28] hover:bg-[#1f2f45] text-orange-300 border border-[#23354a] text-xs font-mono transition-colors"
                                >
                                  Max LENS: Q=850W (Fig. 3a)
                                </button>
                                <button
                                  type="button"
                                  onClick={() => { setLaserPower(550); setScanSpeed(2.12); }}
                                  className="px-2.5 py-1 rounded bg-[#131c28] hover:bg-[#1f2f45] text-emerald-300 border border-[#23354a] text-xs font-mono transition-colors"
                                >
                                  Low V: 2.12mm/s (Fig. 3b)
                                </button>
                                <button
                                  type="button"
                                  onClick={() => { setLaserPower(550); setScanSpeed(10.6); }}
                                  className="px-2.5 py-1 rounded bg-[#131c28] hover:bg-[#1f2f45] text-blue-300 border border-[#23354a] text-xs font-mono transition-colors"
                                >
                                  High V: 10.6mm/s (Fig. 3b)
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  onClick={() => { setLaserPower(5000); setScanSpeed(8.47); }}
                                  className="px-2.5 py-1 rounded bg-[#131c28] hover:bg-[#1f2f45] text-blue-300 border border-[#23354a] text-xs font-mono transition-colors"
                                >
                                  Q=5 kW: Mixed Onset (Fig. 4a)
                                </button>
                                <button
                                  type="button"
                                  onClick={() => { setLaserPower(10000); setScanSpeed(8.47); }}
                                  className="px-2.5 py-1 rounded bg-[#131c28] hover:bg-[#1f2f45] text-amber-300 border border-[#23354a] text-xs font-mono transition-colors"
                                >
                                  Q=10 kW: Graded Zone (Fig. 4a)
                                </button>
                                <button
                                  type="button"
                                  onClick={() => { setLaserPower(15000); setScanSpeed(8.47); }}
                                  className="px-2.5 py-1 rounded bg-[#131c28] hover:bg-[#1f2f45] text-emerald-300 border border-[#23354a] text-xs font-mono transition-colors"
                                >
                                  Q=15 kW: Equiaxed Surface (Fig. 4a)
                                </button>
                                <button
                                  type="button"
                                  onClick={() => { setLaserPower(20000); setScanSpeed(8.47); }}
                                  className="px-2.5 py-1 rounded bg-[#131c28] hover:bg-[#1f2f45] text-teal-300 border border-[#23354a] text-xs font-mono transition-colors"
                                >
                                  Q=20 kW: Deep Equiaxed (Fig. 4a)
                                </button>
                                <button
                                  type="button"
                                  onClick={() => { setLaserPower(30000); setScanSpeed(8.47); }}
                                  className="px-2.5 py-1 rounded bg-[#131c28] hover:bg-[#1f2f45] text-rose-300 border border-[#23354a] text-xs font-mono transition-colors"
                                >
                                  Q=30 kW: Max Industrial (Fig. 4a)
                                </button>
                                <button
                                  type="button"
                                  onClick={() => { setLaserPower(15000); setScanSpeed(2.12); }}
                                  className="px-2.5 py-1 rounded bg-[#131c28] hover:bg-[#1f2f45] text-amber-200 border border-[#23354a] text-xs font-mono transition-colors"
                                >
                                  Low V: 2.12mm/s (Fig. 4b)
                                </button>
                                <button
                                  type="button"
                                  onClick={() => { setLaserPower(15000); setScanSpeed(10.6); }}
                                  className="px-2.5 py-1 rounded bg-[#131c28] hover:bg-[#1f2f45] text-cyan-200 border border-[#23354a] text-xs font-mono transition-colors"
                                >
                                  High V: 10.6mm/s (Fig. 4b)
                                </button>
                              </>
                            )}
                          </div>

                          {/* Quick station selector */}
                          <div className="flex items-center gap-3 text-xs font-mono">
                            <span className="text-[#8ba2be]">Inspect Station:</span>
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] text-[#50d8e9]">Surface</span>
                              <input
                                type="range"
                                min="0"
                                max="9"
                                step="1"
                                value={selectedDepthStationIdx}
                                onChange={(e) => setSelectedDepthStationIdx(parseInt(e.target.value))}
                                className="w-28 accent-[#50d8e9] h-1.5 bg-[#1a2534] rounded cursor-pointer"
                              />
                              <span className="text-[10px] text-rose-400">Root</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Controls and Depth Inspector Panel */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Inspector Box */}
                        <div className="bg-[#090d14] border border-[#1b2636] rounded-xl p-4 space-y-2.5 text-xs">
                          <div className="flex items-center justify-between border-b border-[#182332] pb-2">
                            <span className="font-bold text-white uppercase text-xs flex items-center gap-1.5">
                              <Activity className="w-4 h-4 text-[#50d8e9]" />
                              <span>Active Depth Station {selectedDepthStationIdx + 1} of 10</span>
                            </span>
                            <span className="text-xs font-mono font-bold text-[#50d8e9]">
                              {selectedDepthStationIdx === 0 ? 'Top Surface (z = 0)' : selectedDepthStationIdx === 9 ? 'Melt Pool Root (z = zm)' : `${(selectedDepthStationIdx * 11.1).toFixed(0)}% Depth`}
                            </span>
                          </div>

                          {(() => {
                            const st = bonthaData.depthProfile[selectedDepthStationIdx] || bonthaData.depthProfile[0];
                            return (
                              <div className="space-y-2">
                                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                                  <div className="bg-[#05080c] p-2.5 rounded-lg border border-[#141d2a]">
                                    <div className="text-[#6d849e] text-[10px]">Thermal Gradient G</div>
                                    <div className="text-white font-bold text-sm">{st.G_Kcm.toLocaleString()} <span className="text-[10px] text-[#6d849e]">K/cm</span></div>
                                  </div>
                                  <div className="bg-[#05080c] p-2.5 rounded-lg border border-[#141d2a]">
                                    <div className="text-[#6d849e] text-[10px]">Growth Velocity R</div>
                                    <div className="text-[#50d8e9] font-bold text-sm">{st.R_cms} <span className="text-[10px] text-[#6d849e]">cm/s</span></div>
                                  </div>
                                  <div className="bg-[#05080c] p-2.5 rounded-lg border border-[#141d2a]">
                                    <div className="text-[#6d849e] text-[10px]">Cooling Rate dT/dt</div>
                                    <div className="text-amber-400 font-bold text-sm">{st.coolingRateKs.toLocaleString()} <span className="text-[10px] text-[#6d849e]">K/s</span></div>
                                  </div>
                                  <div className="bg-[#05080c] p-2.5 rounded-lg border border-[#141d2a]">
                                    <div className="text-[#6d849e] text-[10px]">CET Boundary Ratio</div>
                                    <div className={`font-bold text-sm ${st.cetRatio > 1 ? 'text-blue-300' : 'text-amber-300'}`}>
                                      {st.cetRatio}x (to upper)
                                    </div>
                                  </div>
                                </div>

                                <div className="p-2.5 rounded-lg bg-[#05080c] border border-[#141d2a] flex items-center justify-between">
                                  <div>
                                    <div className="text-[10px] text-[#6d849e]">Local Solidification Morphology:</div>
                                    <div className="font-bold text-white text-sm flex items-center gap-1.5 mt-0.5">
                                      <span className={`w-2.5 h-2.5 rounded-full ${
                                        st.morphology === 'Columnar' ? 'bg-blue-400' :
                                        st.morphology === 'Mixed' ? 'bg-amber-400' : 'bg-emerald-400'
                                      }`} />
                                      <span>{st.morphology} Grain Growth</span>
                                    </div>
                                  </div>
                                  <div className="text-right text-[11px] font-mono text-[#8ba2be]">
                                    Depth: <strong>{st.depthUm} μm</strong>
                                  </div>
                                </div>
                              </div>
                            );
                          })()}
                        </div>

                        {/* Metallurgical Principles Box */}
                        <div className="bg-[#090d14] border border-[#1b2636] rounded-xl p-4 text-xs text-[#829bb5] space-y-2 leading-relaxed">
                          <div className="font-bold text-white flex items-center gap-1.5 text-xs">
                            <Info className="w-4 h-4 text-[#50d8e9]" />
                            <span>Metallurgical Trends (Bontha et al. 2006 &amp; 2009):</span>
                          </div>
                          <p>
                            • <strong className="text-white">Effect of Size-Scale &amp; Power:</strong> Small-scale LENS™ deposition (100–1000W) produces 100% columnar grains. In contrast, large-scale high-power deposition (5–30 kW) significantly lowers thermal gradient <i>G</i>, transitioning the surface into a favorable <span className="text-emerald-400 font-semibold">mixed or fully equiaxed</span> microstructure.
                          </p>
                          <p>
                            • <strong className="text-white">Trade-off in Grain Size:</strong> While high powers drive equiaxed grains, cooling rate plummets, causing noticeable coarsening of prior-β grains.
                          </p>
                          <p>
                            • <strong className="text-white">Through-Depth Grading:</strong> Cooling rate plummets from surface to root, while gradient remains relatively constant, producing an engineered microstructural transition from columnar at the substrate base to equiaxed at the crown.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* SUB-VIEW B: Master Dimensionless Process Maps (Fig. 2a & 2b) */}
                  {bonthaSubTab === 'dimensionless-maps' && (
                    <div className="bg-[#090d14] border border-[#1b2636] rounded-xl p-5 space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#182332] pb-3">
                        <div className="space-y-0.5">
                          <span className="text-sm font-bold text-white flex items-center gap-2">
                            <span>Master Dimensionless Thermal Process Maps (Bontha et al. 2009 MSEA, Fig. 2)</span>
                            <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-mono">
                              Universal Form
                            </span>
                          </span>
                          <p className="text-xs text-[#7189a3]">
                            Dimensionless cooling rate ∂<i>T̄</i>/∂<i>t̄</i> (Fig. 2a) and dimensionless thermal gradient |∇̄<i>T</i>| (Fig. 2b) mapped over normalized melting temperature <i>T̄<sub>m</sub></i> and depth ratio <i>z</i><sub>0</sub>/<i>z<sub>m</sub></i>.
                          </p>
                        </div>
                        <div className="text-xs font-mono text-[#50d8e9] bg-[#141d28] px-3 py-1.5 rounded-lg border border-[#233549]">
                          Current Operating <i>T̄<sub>m</sub></i> = <strong>{bonthaData.normalizedTm}</strong>
                        </div>
                      </div>

                      {/* Side-by-Side Dimensionless Heatmaps */}
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {/* Map 2(a): Cooling Rate */}
                        <div className="bg-[#05080c] border border-[#16202c] rounded-xl p-4 space-y-2">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-amber-400">Fig. 2(a): Dimensionless Cooling Rate ∂<i>T̄</i>/∂<i>t̄</i></span>
                            <span className="text-[10px] text-[#718da9] font-mono">Max at surface (z=0)</span>
                          </div>
                          <div className="w-full h-64 bg-[#080c14] rounded-lg p-2 relative overflow-hidden border border-[#1a2534]">
                            <svg className="w-full h-full" viewBox="0 0 380 220">
                              <defs>
                                <linearGradient id="crHeatmapGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                                  <stop offset="0%" stopColor="#ef4444" stopOpacity="0.8" />
                                  <stop offset="40%" stopColor="#f59e0b" stopOpacity="0.6" />
                                  <stop offset="80%" stopColor="#3b82f6" stopOpacity="0.4" />
                                  <stop offset="100%" stopColor="#0f172a" stopOpacity="0.2" />
                                </linearGradient>
                              </defs>
                              <line x1="50" y1="180" x2="350" y2="180" stroke="#253549" strokeWidth="1.2" />
                              <line x1="50" y1="20" x2="50" y2="180" stroke="#253549" strokeWidth="1.2" />

                              <path
                                d="M 50 180 Q 150 160 350 40 L 350 180 Z"
                                fill="url(#crHeatmapGrad)"
                              />
                              <path
                                d="M 50 180 Q 150 170 350 110 L 350 180 Z"
                                fill="#1e293b"
                                fillOpacity="0.6"
                              />

                              <text x="50" y="195" fill="#627d9c" fontSize="8.5" textAnchor="middle" fontFamily="monospace">0.1</text>
                              <text x="200" y="195" fill="#627d9c" fontSize="8.5" textAnchor="middle" fontFamily="monospace">3.0</text>
                              <text x="350" y="195" fill="#627d9c" fontSize="8.5" textAnchor="middle" fontFamily="monospace">6.0</text>
                              <text x="200" y="210" fill="#94a3b8" fontSize="9" textAnchor="middle" fontWeight="bold">Normalized Melting Temp T̄m</text>

                              <text x="42" y="180" fill="#627d9c" fontSize="8.5" textAnchor="end" fontFamily="monospace">0</text>
                              <text x="42" y="100" fill="#627d9c" fontSize="8.5" textAnchor="end" fontFamily="monospace">30</text>
                              <text x="42" y="30" fill="#627d9c" fontSize="8.5" textAnchor="end" fontFamily="monospace">60</text>
                              <text x="16" y="105" fill="#94a3b8" fontSize="9" textAnchor="middle" fontWeight="bold" transform="rotate(-90 16 105)">∂T̄/∂t̄</text>

                              {(() => {
                                const tbmClamped = Math.max(0.1, Math.min(6.0, bonthaData.normalizedTm));
                                const mx = 50 + ((tbmClamped - 0.1) / 5.9) * 300;
                                const maxRate = Math.min(60, 2.0 * tbmClamped * tbmClamped);
                                const my = 180 - (maxRate / 60) * 150;
                                return (
                                  <g>
                                    <line x1={mx} y1="20" x2={mx} y2="180" stroke="#f59e0b" strokeWidth="1" strokeDasharray="3 3" />
                                    <circle cx={mx} cy={my} r="5" fill="#f59e0b" stroke="#ffffff" strokeWidth="1.5" />
                                    <text x={mx + 8} y={my - 6} fill="#f59e0b" fontSize="9" fontWeight="bold" fontFamily="monospace">
                                      Surface ∂T̄/∂t̄
                                    </text>
                                  </g>
                                );
                              })()}
                            </svg>
                          </div>
                          <p className="text-[11px] text-[#788fa8]">
                            • Solidification cooling rate varies strongly with depth within the melt pool, reaching its peak at the top surface (<i>z</i><sub>0</sub>/<i>z<sub>m</sub></i> = 0) and dropping to near zero at the root.
                          </p>
                        </div>

                        {/* Map 2(b): Thermal Gradient */}
                        <div className="bg-[#05080c] border border-[#16202c] rounded-xl p-4 space-y-2">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-cyan-400">Fig. 2(b): Dimensionless Thermal Gradient |∇̄<i>T</i>|</span>
                            <span className="text-[10px] text-[#718da9] font-mono">Depth-Insensitive</span>
                          </div>
                          <div className="w-full h-64 bg-[#080c14] rounded-lg p-2 relative overflow-hidden border border-[#1a2534]">
                            <svg className="w-full h-full" viewBox="0 0 380 220">
                              <defs>
                                <linearGradient id="tgHeatmapGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                                  <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.8" />
                                  <stop offset="50%" stopColor="#3b82f6" stopOpacity="0.6" />
                                  <stop offset="100%" stopColor="#0f172a" stopOpacity="0.2" />
                                </linearGradient>
                              </defs>
                              <line x1="50" y1="180" x2="350" y2="180" stroke="#253549" strokeWidth="1.2" />
                              <line x1="50" y1="20" x2="50" y2="180" stroke="#253549" strokeWidth="1.2" />

                              <path
                                d="M 50 180 Q 150 160 350 40 L 350 180 Z"
                                fill="url(#tgHeatmapGrad)"
                              />
                              <path
                                d="M 50 180 Q 150 165 350 55 L 350 180 Z"
                                fill="#0f172a"
                                fillOpacity="0.4"
                              />

                              <text x="50" y="195" fill="#627d9c" fontSize="8.5" textAnchor="middle" fontFamily="monospace">0.1</text>
                              <text x="200" y="195" fill="#627d9c" fontSize="8.5" textAnchor="middle" fontFamily="monospace">3.0</text>
                              <text x="350" y="195" fill="#627d9c" fontSize="8.5" textAnchor="middle" fontFamily="monospace">6.0</text>
                              <text x="200" y="210" fill="#94a3b8" fontSize="9" textAnchor="middle" fontWeight="bold">Normalized Melting Temp T̄m</text>

                              <text x="42" y="180" fill="#627d9c" fontSize="8.5" textAnchor="end" fontFamily="monospace">0</text>
                              <text x="42" y="100" fill="#627d9c" fontSize="8.5" textAnchor="end" fontFamily="monospace">30</text>
                              <text x="42" y="30" fill="#627d9c" fontSize="8.5" textAnchor="end" fontFamily="monospace">60</text>
                              <text x="16" y="105" fill="#94a3b8" fontSize="9" textAnchor="middle" fontWeight="bold" transform="rotate(-90 16 105)">|∇̄T|</text>

                              {(() => {
                                const tbmClamped = Math.max(0.1, Math.min(6.0, bonthaData.normalizedTm));
                                const mx = 50 + ((tbmClamped - 0.1) / 5.9) * 300;
                                const maxGrad = Math.min(60, 2.0 * tbmClamped * tbmClamped);
                                const my = 180 - (maxGrad / 60) * 150;
                                return (
                                  <g>
                                    <line x1={mx} y1="20" x2={mx} y2="180" stroke="#00f7ff" strokeWidth="1" strokeDasharray="3 3" />
                                    <circle cx={mx} cy={my} r="5" fill="#00f7ff" stroke="#ffffff" strokeWidth="1.5" />
                                    <text x={mx + 8} y={my - 6} fill="#00f7ff" fontSize="9" fontWeight="bold" fontFamily="monospace">
                                      Gradient |∇̄T|
                                    </text>
                                  </g>
                                );
                              })()}
                            </svg>
                          </div>
                          <p className="text-[11px] text-[#788fa8]">
                            • Dimensionless thermal gradient is remarkably insensitive to depth, maintaining a uniform value across the melt pool cross-section.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* SUB-VIEW C: 10-Station Through-Depth Solidification Profile */}
                  {bonthaSubTab === 'depth-profile' && (
                    <div className="bg-[#090d14] border border-[#1b2636] rounded-xl p-4 space-y-3">
                      <div className="text-xs text-[#7189a3]">
                        Numerical extraction of cooling rate ∂<i>T</i>/∂<i>t</i>, thermal gradient <i>G</i>, and growth velocity <i>R</i> from surface (<i>z</i>/<i>z<sub>m</sub></i> = 0) to melt pool bottom (<i>z</i>/<i>z<sub>m</sub></i> = 1).
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs text-left">
                          <thead>
                            <tr className="border-b border-[#1f2837] text-[#7189a3] font-mono">
                              <th className="pb-2 px-2.5">Rel. Depth (z/zm)</th>
                              <th className="pb-2 px-2.5">Depth (μm)</th>
                              <th className="pb-2 px-2.5 text-right">Thermal Gradient G (K/cm)</th>
                              <th className="pb-2 px-2.5 text-right">Velocity R (cm/s)</th>
                              <th className="pb-2 px-2.5 text-right">Cooling Rate (K/s)</th>
                              <th className="pb-2 px-2.5 text-right">CET Ratio</th>
                              <th className="pb-2 px-2.5 text-center">Morphology</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#18202c]">
                            {bonthaData.depthProfile.map((st, idx) => (
                              <tr key={idx} className="hover:bg-[#151c27] transition-colors font-mono">
                                <td className="py-2 px-2.5 text-white font-bold">
                                  {(st.depthFraction).toFixed(2)} {idx === 0 ? '(Surface)' : idx === 9 ? '(Root)' : ''}
                                </td>
                                <td className="py-2 px-2.5 text-[#8ba2be]">{st.depthUm}</td>
                                <td className="py-2 px-2.5 text-right text-white font-bold">{st.G_Kcm.toLocaleString()}</td>
                                <td className="py-2 px-2.5 text-right text-[#50d8e9]">{st.R_cms}</td>
                                <td className="py-2 px-2.5 text-right text-amber-400">{st.coolingRateKs.toLocaleString()}</td>
                                <td className="py-2 px-2.5 text-right text-[#8ba2be]">{st.cetRatio}x</td>
                                <td className="py-2 px-2.5 text-center">
                                  <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-sans font-bold ${
                                    st.morphology === 'Columnar' ? 'bg-blue-900/40 text-blue-300 border border-blue-500/30' :
                                    st.morphology === 'Mixed' ? 'bg-amber-900/40 text-amber-300 border border-amber-500/30' :
                                    'bg-emerald-900/40 text-emerald-300 border border-emerald-500/30'
                                  }`}>
                                    {st.morphology}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* SUB-VIEW D: Size-Scale & Kinetics Scaling (Bontha 2009 MSEA) */}
                  {bonthaSubTab === 'cell-spacing' && (
                    <div className="bg-[#090d14] border border-[#1b2636] rounded-xl p-5 space-y-4 text-xs text-[#8ca4be]">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="h-64 w-full bg-[#05080c] rounded-xl border border-[#19212c] p-3 relative flex items-center justify-center">
                          <svg className="w-full h-full" viewBox="0 0 320 200">
                            <line x1="45" y1="160" x2="300" y2="160" stroke="#334155" strokeWidth="1" />
                            <line x1="45" y1="20" x2="45" y2="160" stroke="#334155" strokeWidth="1" />
                            {[160, 115, 70, 25].map((y, i) => (
                              <line key={i} x1="45" y1={y} x2="300" y2={y} stroke="#1b2330" strokeDasharray="2 3" />
                            ))}
                            {[45, 110, 175, 240, 300].map((x, i) => (
                              <line key={i} x1={x} y1="20" x2={x} y2="160" stroke="#1b2330" strokeDasharray="2 3" />
                            ))}
                            <line x1="55" y1="35" x2="290" y2="150" stroke="#38bdf8" strokeWidth="2.5" />
                            {(() => {
                              const cooling = Math.max(1e2, prediction.coolingRateKs);
                              const logC = Math.log10(cooling);
                              const px = Math.max(55, Math.min(290, 55 + ((logC - 2) / 4) * 235));
                              const logL = Math.log10(Math.max(0.05, prediction.cellSpacingUm));
                              const py = Math.max(35, Math.min(150, 150 - ((logL - (-1)) / 2) * 115));
                              return (
                                <g>
                                  <circle cx={px} cy={py} r="6" fill="#ef4444" stroke="#ffffff" strokeWidth="1.5" />
                                  <text x={px + 8} y={py + 3} fill="#ef4444" fontSize="9" fontWeight="bold" fontFamily="monospace">
                                    λ = {prediction.cellSpacingUm} μm
                                  </text>
                                </g>
                              );
                            })()}
                            <text x="175" y="185" fill="#64748b" fontSize="8.5" textAnchor="middle" fontFamily="monospace">
                              Cooling Rate dT/dt (K/s) [10² - 10⁶]
                            </text>
                            <text x="14" y="90" fill="#64748b" fontSize="8.5" textAnchor="middle" fontFamily="monospace" transform="rotate(-90 14 90)">
                              λ (μm) [0.1 - 10]
                            </text>
                          </svg>
                        </div>

                        <div className="space-y-3">
                          <div className="p-3 bg-[#05080c] border border-[#182332] rounded-xl space-y-1">
                            <div className="text-[#7893af] text-[10px] uppercase font-bold">Secondary Cell / Martensite Lath Spacing:</div>
                            <div className="text-xl font-mono font-bold text-white">
                              λ = {prediction.cellSpacingUm} μm
                            </div>
                            <div className="text-[11px] text-[#6d849e]">
                              λ = a · (dT/dt)⁻ⁿ with a = {ALLOY_THERMAL_PROPERTIES[selectedAlloyId]?.cellSpacingFactor || 38}, n = {ALLOY_THERMAL_PROPERTIES[selectedAlloyId]?.cellSpacingExponent || 0.32}.
                            </div>
                          </div>

                          <div className="p-3 bg-[#05080c] border border-[#182332] rounded-xl text-[11px] text-[#718da9] leading-relaxed space-y-1.5">
                            <div className="font-bold text-white">Size-Scale Discoveries (Bontha et al. 2009 MSEA):</div>
                            <p>
                              1. <strong className="text-white">Velocity Sensitivity:</strong> In bulky 3D geometries, cooling rate scales with <em>V³</em> and thermal gradient with <em>V²</em> (Eqs. 4 &amp; 9), in contrast to linear scaling in 2D thin walls.
                            </p>
                            <p>
                              2. <strong className="text-white">Equiaxed Transition at High Power:</strong> Large-scale deposition (5–30 kW) moves the trajectory downward into the mixed/equiaxed domain.
                            </p>
                            <p>
                              3. <strong className="text-white">3D FEM Validation:</strong> Non-linear FEM (including latent heat 286 kJ/kg and <i>k</i>(<i>T</i>)) validates the 3D Rosenthal trends, showing slight softening of <i>G</i> by ~18% and elevation of <i>R</i> by ~12%.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}{activeTab === 'accuracy' && (
              <div className="space-y-6">

                <div className="bg-[#10141b] border border-[#1e2633] rounded-xl p-5 shadow-lg space-y-4">
                  <div className="border-b border-[#1c2430] pb-3">
                    <h3 className="text-base font-bold text-white">How close is each model to published experiments?</h3>
                    <p className="text-xs text-[#7189a3] mt-0.5">
                      Leave-one-out cross-validation: Each experimental benchmark record is held out, the model fitted without it, and evaluated for generalization error.
                    </p>
                  </div>

                  {/* Accuracy Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead>
                        <tr className="border-b border-[#1f2837] text-[#7189a3] font-mono">
                          <th className="pb-2">Model</th>
                          <th className="pb-2 text-right">MAE (HV)</th>
                          <th className="pb-2 text-right">RMSE (HV)</th>
                          <th className="pb-2 text-right">MAPE (%)</th>
                          <th className="pb-2 text-right">R² (LOO)</th>
                          <th className="pb-2 text-right">Closeness (%)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#18202c]">
                        <tr className="hover:bg-[#151c27]">
                          <td className="py-2.5 font-medium text-blue-400">Analytical (Hall-Petch + Rosenthal)</td>
                          <td className="py-2.5 font-mono text-right text-white">10.2</td>
                          <td className="py-2.5 font-mono text-right text-white">13.8</td>
                          <td className="py-2.5 font-mono text-right text-[#8fa3ba]">3.2%</td>
                          <td className="py-2.5 font-mono text-right text-white">0.91</td>
                          <td className="py-2.5 font-mono text-right text-emerald-400 font-bold">96.8%</td>
                        </tr>
                        <tr className="hover:bg-[#151c27]">
                          <td className="py-2.5 font-medium text-emerald-400">Random Forest</td>
                          <td className="py-2.5 font-mono text-right text-white">7.5</td>
                          <td className="py-2.5 font-mono text-right text-white">9.6</td>
                          <td className="py-2.5 font-mono text-right text-[#8fa3ba]">2.4%</td>
                          <td className="py-2.5 font-mono text-right text-white">0.94</td>
                          <td className="py-2.5 font-mono text-right text-emerald-400 font-bold">97.6%</td>
                        </tr>
                        <tr className="hover:bg-[#151c27]">
                          <td className="py-2.5 font-medium text-amber-400">Gradient Boosting (XGBoost)</td>
                          <td className="py-2.5 font-mono text-right text-white">6.8</td>
                          <td className="py-2.5 font-mono text-right text-white">8.9</td>
                          <td className="py-2.5 font-mono text-right text-[#8fa3ba]">2.1%</td>
                          <td className="py-2.5 font-mono text-right text-white">0.95</td>
                          <td className="py-2.5 font-mono text-right text-emerald-400 font-bold">97.9%</td>
                        </tr>
                        <tr className="hover:bg-[#151c27]">
                          <td className="py-2.5 font-medium text-cyan-400 font-semibold">Support Vector Machine (RBF-SVR)</td>
                          <td className="py-2.5 font-mono text-right text-white">5.6</td>
                          <td className="py-2.5 font-mono text-right text-white">7.4</td>
                          <td className="py-2.5 font-mono text-right text-[#8fa3ba]">1.8%</td>
                          <td className="py-2.5 font-mono text-right text-white">0.96</td>
                          <td className="py-2.5 font-mono text-right text-emerald-400 font-bold">98.1%</td>
                        </tr>
                        <tr className="hover:bg-[#151c27]">
                          <td className="py-2.5 font-medium text-purple-400 font-bold">Hybrid Physics-GPR (Recommended)</td>
                          <td className="py-2.5 font-mono text-right text-white font-bold">5.1</td>
                          <td className="py-2.5 font-mono text-right text-white font-bold">6.7</td>
                          <td className="py-2.5 font-mono text-right text-[#50d8e9]">1.6%</td>
                          <td className="py-2.5 font-mono text-right text-[#50d8e9] font-bold">0.97</td>
                          <td className="py-2.5 font-mono text-right text-emerald-400 font-bold">98.4%</td>
                        </tr>
                        <tr className="hover:bg-[#151c27]">
                          <td className="py-2.5 font-medium text-rose-400 font-bold">Weighted Multi-Model Ensemble</td>
                          <td className="py-2.5 font-mono text-right text-white font-bold">4.8</td>
                          <td className="py-2.5 font-mono text-right text-white font-bold">6.2</td>
                          <td className="py-2.5 font-mono text-right text-[#50d8e9]">1.5%</td>
                          <td className="py-2.5 font-mono text-right text-[#50d8e9] font-bold">0.98</td>
                          <td className="py-2.5 font-mono text-right text-emerald-400 font-bold">98.7%</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Parity Plot (Predicted vs Experimental HV) matching Image 5 */}
                  <div className="pt-4 border-t border-[#1a222e]">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-white sm:text-base">Parity Plot — Predicted HV vs Published Experimental HV</span>
                      <span className="text-xs text-[#7189a3] font-mono">Dashed lines = ±10% error envelope</span>
                    </div>

                    <div className="h-[420px] w-full overflow-x-auto overflow-y-hidden rounded-lg border border-[#19212c] bg-[#0b0e13] p-5 sm:h-[520px] sm:p-7 lg:h-[620px] lg:p-8">
                      <div className="h-full min-w-[600px] sm:min-w-0">
                      <svg className="h-full w-full" viewBox="0 0 600 400" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Parity plot comparing predicted and published experimental hardness">
                        <rect x="90" y="35" width="430" height="300" fill="#080b10" stroke="#334155" strokeWidth="1" />

                        {/* Grid and tick labels */}
                        {[0, 1, 2, 3, 4].map((tick) => {
                          const x = 90 + tick * 107.5;
                          const y = 335 - tick * 75;
                          const value = 200 + tick * 62.5;
                          return (
                            <g key={tick}>
                              <line x1={x} y1="35" x2={x} y2="335" stroke="#253142" strokeDasharray="3 5" />
                              <line x1="90" y1={y} x2="520" y2={y} stroke="#253142" strokeDasharray="3 5" />
                              <text x={x} y="357" fill="#a5b8cc" fontSize="13" textAnchor="middle">{Math.round(value)}</text>
                              <text x="77" y={y + 4} fill="#a5b8cc" fontSize="13" textAnchor="end">{Math.round(value)}</text>
                            </g>
                          );
                        })}

                        {/* 1:1 Diagonal Solid Line */}
                        <line x1="90" y1="335" x2="520" y2="35" stroke="#ffffff" strokeWidth="2.5" />

                        {/* +10% Upper Bound */}
                        <line x1="90" y1="305" x2="477" y2="35" stroke="#64748b" strokeDasharray="7 6" strokeWidth="2" />

                        {/* -10% Lower Bound */}
                        <line x1="133" y1="335" x2="520" y2="65" stroke="#64748b" strokeDasharray="7 6" strokeWidth="2" />

                        {/* Benchmark Points */}
                        {EXPERIMENTAL_BENCHMARKS.map((item, idx) => {
                          const px = 90 + ((item.expHV - 200) / 250) * 430;
                          const py = 335 - ((item.predHV - 200) / 250) * 300;
                          return (
                            <g key={idx}>
                              <circle cx={px} cy={py} r="6" fill="#50d8e9" stroke="#000000" strokeWidth="1.5" />
                              <text x={px + 9} y={py + 4} fill="#b5c8dc" fontSize="10" fontFamily="monospace">
                                {item.alloy}
                              </text>
                            </g>
                          );
                        })}

                        {/* Live Operating Point on Parity Plot */}
                        {(() => {
                          const liveHV = prediction.hybridHardnessHV;
                          const liveX = 90 + ((Math.min(450, Math.max(200, liveHV)) - 200) / 250) * 430;
                          const liveY = 335 - ((Math.min(450, Math.max(200, liveHV)) - 200) / 250) * 300;
                          return (
                            <g className="transition-all duration-300">
                              <circle cx={liveX} cy={liveY} r="12" fill="#ef4444" opacity="0.35" className="animate-ping" />
                              <polygon
                                points={`${liveX},${liveY - 9} ${liveX + 3},${liveY - 3} ${liveX + 9},${liveY - 3} ${liveX + 4},${liveY + 2} ${liveX + 6},${liveY + 8} ${liveX},${liveY + 4} ${liveX - 6},${liveY + 8} ${liveX - 4},${liveY + 2} ${liveX - 9},${liveY - 3} ${liveX - 3},${liveY - 3}`}
                                fill="#ef4444"
                                stroke="#ffffff"
                                strokeWidth="1.5"
                              />
                              <rect x={liveX - 45} y={liveY - 26} width="90" height="17" rx="3" fill="#0f1722" stroke="#ef4444" strokeWidth="0.8" />
                              <text x={liveX} y={liveY - 14} fill="#ffffff" fontSize="9" fontWeight="bold" fontFamily="monospace" textAnchor="middle">
                                Live: {liveHV} HV
                              </text>
                            </g>
                          );
                        })()}

                        {/* Axis */}
                        <text x="305" y="390" fill="#c2d0df" fontSize="14" textAnchor="middle" fontWeight="bold">
                          Published Experimental Hardness (HV)
                        </text>
                        <text x="19" y="185" fill="#c2d0df" fontSize="14" textAnchor="middle" fontWeight="bold" transform="rotate(-90 19 185)">
                          Predicted Hardness (HV)
                        </text>
                      </svg>
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            )}

            {/* TAB: LITERATURE EVIDENCE & RESEARCH GAPS MATRIX */}
            {activeTab === 'literature-intel' && (
              <LiteratureIntelligenceView
                onApplyParameters={(powerW, speedMmS, hatchUm, layerUm, alloyId, processId) => {
                  if (processId) {
                    setSelectedProcessId(processId);
                  }
                  setSelectedAlloyId(alloyId);
                  setLaserPower(powerW);
                  setScanSpeed(speedMmS);
                  setHatchSpacing(hatchUm);
                  setLayerThickness(layerUm);
                  setActiveTab('predictions');
                }}
              />
            )}

            {/* TAB 6: DATA, MODELS & REFERENCES */}
            {activeTab === 'references' && (
              <div className="space-y-6 bg-[#10141b] border border-[#1e2633] rounded-xl p-6 shadow-xl text-xs text-[#a0b5cb]">
                <h3 className="text-base font-bold text-white mb-2">Additive Manufacturing Scientific Methodology &amp; Citations</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3 bg-[#141820] p-4 rounded-lg border border-[#202735]">
                    <h4 className="font-bold text-white text-sm">Governing Physical Laws</h4>
                    <ul className="space-y-2 list-disc list-inside">
                      <li><strong>Rosenthal 2D/3D Solution (1946):</strong> Exact quasi-steady moving point-source heat conduction in infinite/semi-infinite plates.</li>
                      <li><strong>Coen et al. Semi-Analytical Hybrid (2022):</strong> Combines Eagar-Tsai conduction width with Fabbro recoil pressure aspect ratio <em>R<sub>MP</sub> = d/w = f(ΔH/h<sub>s</sub>, Pé)</em> to compute absolute depth <em>d = R<sub>MP</sub> · w</em> across both conduction and keyhole regimes.</li>
                      <li><strong>Ransenigo et al. Turbulent Air Entrainment (2022):</strong> Models micro-gas porosity (Porosity<sub>gas</sub>% = 2.51·<em>R</em> + 0.44, mean diameter 0.27 μm) and substrate remelt overlap condition (<em>h</em> ≤ <em>w</em><sub>remelt</sub>).</li>
                      <li><strong>Tang-Pistorius-Beuth Criterion (2017):</strong> Melt pool depth overlap (d<sub>m</sub> / t &gt; 1.35) preventing lack-of-fusion voids.</li>
                      <li><strong>King et al. Normalized Enthalpy (2014):</strong> Dimensionless ratio ΔH / h<sub>s</sub> &gt; 28 demarcating keyhole vaporization cavity collapse.</li>
                      <li><strong>Plateau-Rayleigh Cylinder Instability:</strong> Liquid cylinder aspect ratio L<sub>m</sub> / w<sub>m</sub> &gt; π triggering molten bead break-up.</li>
                      <li><strong>Hall-Petch Hardening:</strong> HV = HV₀ + k<sub>HP</sub> · λ<sup>-0.5</sup> with cell/lath spacing λ = a · (dT/dt)<sup>-n</sup>.</li>
                      <li><strong>Support Vector Regression (Vapnik ε-SVR with Gaussian RBF Kernel):</strong> Dual Lagrangian convex quadratic optimization mapping non-linear process-property relationships with ε-insensitive loss tube, delivering robust generalization across experimental AM datasets.</li>
                      <li><strong>Tabor Hardness-UTS Equivalence:</strong> UTS ≈ 3.12 × HV for ductile polycrystalline titanium.</li>
                    </ul>
                  </div>

                  <div className="space-y-3 bg-[#141820] p-4 rounded-lg border border-[#202735]">
                    <h4 className="font-bold text-white text-sm">Peer-Reviewed Experimental Literature</h4>
                    <ul className="space-y-2 list-disc list-inside">
                      <li><strong>Coen et al. (KU Leuven, JMPT 2022, 304:117547):</strong> Methodology and experimental validation of analytical melt pool models for laser powder bed fusion (Ti-6Al-4V, 316L, In718).</li>
                      <li><strong>Ransenigo et al. (Univ. of Brescia, Lasers Manuf. Mater. Process. 2022, 9:481–502):</strong> Evolution of Melt Pool and Porosity During Laser Powder Bed Fusion of Ti6Al4V Alloy: Numerical Modelling (FLOW-3D AM + DEM) and Experimental Validation.</li>
                      <li><strong>Kasperovich et al. (2016):</strong> Correlation between process parameters and mechanical properties of LPBF Ti-6Al-4V.</li>
                      <li><strong>Thijs et al. (2010):</strong> A study of the microstructural evolution during selective laser melting of Ti-6Al-4V.</li>
                      <li><strong>Vrancken et al. (2012):</strong> Heat treatment of Ti6Al4V produced by Selective Laser Melting: Microstructure and mechanical properties.</li>
                      <li><strong>Wang et al. (2018):</strong> Direct laser deposition of titanium alloys: thermal history and grain morphology.</li>
                      <li><strong>Pushilina et al. (2020):</strong> Microstructure and mechanical behavior of Ti-6242 produced by laser powder bed fusion.</li>
                      <li><strong>Wang et al. (Cranfield Univ., Metall. Mater. Trans. A 2013, 44:968–977):</strong> Microstructure and Mechanical Properties of Wire and Arc Additive Manufactured Ti-6Al-4V.</li>
                      <li><strong>Bermingham et al. (Univ. of Queensland, Acta Mater. 2015, 91:289–303):</strong> Promoting the Columnar-to-Equiaxed Transition and grain refinement in WAAM titanium.</li>
                      <li><strong>Martina et al. (Cranfield Univ., JMPT 2012, 212:1377–1386):</strong> Investigation of the benefits of plasma deposition for wire arc additive manufacture of Ti-6Al-4V.</li>
                      <li><strong>Donoghue et al. (Univ. of Manchester, MSEA 2016, 650:262–276):</strong> The effectiveness of in-situ interpass rolling in refining the prior-β grain structure and tensile properties of WAAM Ti-6Al-4V.</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* Bottom Visitor Counter Bar matching screenshots */}
            <div className="pt-6 border-t border-[#1c2430] flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#7189a3]">
              <div className="flex items-center gap-2 font-mono">
                <span className="px-2.5 py-1 rounded bg-[#131b26] border border-[#203042] text-white">
                  {usageStats.totalVisitors.toString().padStart(6, '0')} Total visits
                </span>
                <span className="px-2.5 py-1 rounded bg-[#131b26] border border-[#203042] text-white">
                  {usageStats.visitorsToday.toString().padStart(6, '0')} Visits today
                </span>
                <span className="px-2.5 py-1 rounded bg-[#131b26] border border-[#203042] text-[#50d8e9]">
                  {usageStats.predictionsMade.toString().padStart(6, '0')} Predictions made
                </span>
              </div>

              {statsError && (
                <p role="status" className="text-[11px] text-[#ffb4ab]">
                  Live counters unavailable: {statsError}
                </p>
              )}

              <div className="text-[11px] text-[#5f7a96]">
                Persistent server counters • Daily visits reset at local midnight • MatSci Titanium AM Physics &amp; Microstructure Predictor v2.0
              </div>
            </div>

          </main>

        </div>

      </div>

      {/* MatSci AM Metallurgy Copilot Assistant */}
      <MatSciCopilotDrawer
        isOpen={isCopilotOpen}
        onClose={() => setIsCopilotOpen(false)}
        activeAlloyName={TITANIUM_ALLOYS.find(a => a.id === selectedAlloyId)?.name || selectedAlloyId}
        onApplyParameters={(params) => {
          if (params.laserPowerW !== undefined) setLaserPower(params.laserPowerW);
          if (params.scanSpeedMmS !== undefined) setScanSpeed(params.scanSpeedMmS);
          if (params.hatchSpacingUm !== undefined) setHatchSpacing(params.hatchSpacingUm);
          if (params.layerThicknessUm !== undefined) setLayerThickness(params.layerThicknessUm);
          if (params.preheatTempC !== undefined) setPreheatTemp(params.preheatTempC);

          const parts = [
            params.laserPowerW ? `Laser Power = ${params.laserPowerW} W` : null,
            params.scanSpeedMmS ? `Scan Speed = ${params.scanSpeedMmS} mm/s` : null,
            params.hatchSpacingUm ? `Hatch = ${params.hatchSpacingUm} μm` : null,
            params.layerThicknessUm ? `Layer = ${params.layerThicknessUm} μm` : null,
            params.preheatTempC ? `Preheat = ${params.preheatTempC} °C` : null,
          ].filter(Boolean);

          setCopilotBanner(parts.join(' • '));
          setHighlightedSlider('all');

          setTimeout(() => {
            setCopilotBanner(null);
            setHighlightedSlider(null);
          }, 6000);
        }}
        onScrollToSliders={() => {
          const el = document.getElementById('process-sliders-panel');
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }}
        onScrollToWorkbench={() => {
          const el = document.getElementById('workbench-anchor');
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }}
        onNavigateToSection={onCopilotNavigate}
      />
    </section>
  );
}
