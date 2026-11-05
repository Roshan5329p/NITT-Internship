import React, { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
  X,
  Send,
  Bot,
  User,
  ArrowRight,
  Lightbulb,
  Sliders,
  Compass,
  ExternalLink,
  CheckCircle2
} from 'lucide-react';
import { MATERIALS_CATALOG } from '../data/materialsData';

export type CopilotRouteId =
  | 'predictions'
  | 'process-map'
  | 'defects'
  | 'economics'
  | 'digital-twin'
  | 'qualification'
  | 'literature'
  | 'workbench'
  | 'datasets'
  | 'telemetry'
  | 'heat-treatment'
  | 'phase-kinetics'
  | 'titanium-workstation';

export interface CopilotNavigationTarget {
  id: CopilotRouteId;
  label: string;
}

interface CopilotMessage {
  id: string;
  sender: 'ai' | 'user';
  text: string;
  navigationTarget?: CopilotNavigationTarget;
  recommendedParams?: {
    laserPowerW?: number;
    scanSpeedMmS?: number;
    hatchSpacingUm?: number;
    layerThicknessUm?: number;
    preheatTempC?: number;
  };
  timestamp: string;
}

export interface MatSciCopilotDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  activeAlloyName: string;
  onApplyParameters: (params: {
    laserPowerW?: number;
    scanSpeedMmS?: number;
    hatchSpacingUm?: number;
    layerThicknessUm?: number;
    preheatTempC?: number;
  }) => void;
  onScrollToSliders?: () => void;
  onScrollToWorkbench?: () => void;
  onNavigateToSection: (target: CopilotNavigationTarget) => void;
}

const NAVIGATION_INTENTS: Array<{
  id: CopilotRouteId;
  label: string;
  keywords: string[];
}> = [
  {
    id: 'qualification',
    label: 'ASTM Qualification Audit',
    keywords: ['astm f3001', 'astm f2924', 'f3001', 'astm', 'qualification', 'qualify', 'certification', 'compliance audit', 'medical implant']
  },
  {
    id: 'literature',
    label: 'Literature Evidence & Research Gaps',
    keywords: ['literature', 'research gap', 'research paper', 'publication', 'peer reviewed', 'evidence matrix', 'evidence', 'citations', 'benchmark papers']
  },
  {
    id: 'economics',
    label: 'Build Economics & ESG',
    keywords: ['economics', 'cost', 'cost per part', 'roi', 'return on investment', 'esg', 'carbon', 'sustainability', 'buy to fly']
  },
  {
    id: 'digital-twin',
    label: '3D Digital Twin & Stress Tensor',
    keywords: ['digital twin', '3d twin', '3d model', 'stress tensor', 'stress field', 'tensor', '3d visualization']
  },
  {
    id: 'defects',
    label: 'Defect Process Window',
    keywords: ['defect', 'keyhole', 'keyholing', 'lack of fusion', 'porosity', 'pore', 'crack', 'cracking', 'balling', 'spatter', 'defect map', 'process window']
  },
  {
    id: 'heat-treatment',
    label: 'Route Architecture & Heat Treatment',
    keywords: ['heat treatment', 'heat treat', 'treatment', 'hip', 'hot isostatic pressing', 'anneal', 'annealing', 'solution treatment', 'aging', 'post processing', 'route architecture', 'heat treatment recipe']
  },
  {
    id: 'phase-kinetics',
    label: 'Phase Kinetics & CCT',
    keywords: ['phase kinetics', 'phase', 'cct', 'continuous cooling', 'martensite', 'alpha beta', 'alpha prime', 'beta transus', 'phase transformation', 'microstructure']
  },
  {
    id: 'telemetry',
    label: 'Thermal Telemetry',
    keywords: ['thermal telemetry', 'thermal', 'cooling rate', 'rosenthal', 'thermal history', 'thermal profile', 'melt pool temperature', 'cooling curve']
  },
  {
    id: 'datasets',
    label: 'Supplementary Datasets',
    keywords: ['supplementary dataset', 'dataset', 'database', 'record', 'variants', 'data table', 'csv', 'export data', 'process variants', 'experimental data', 'empirical data']
  },
  {
    id: 'workbench',
    label: 'Materials Synthesis Workbench',
    keywords: ['workbench', 'compare alloy', 'compare material', 'compare alloys', 'alloy properties', 'material properties', 'material catalog', 'alloy', 'alloys', 'material', 'materials', 'tensile strength', 'elongation', 'hardness', 'properties', 'grade 5', 'grade 23']
  },
  {
    id: 'process-map',
    label: 'Process Map',
    keywords: ['process map', 'lpbf', 'l pbf', 'slm', 'dmls', 'waam', 'wire arc', 'ded', 'directed energy deposition', 'ebm', 'electron beam', 'binder jetting', 'additive process', 'process comparison']
  },
  {
    id: 'predictions',
    label: 'Physics Predictor',
    keywords: ['physics predictor', 'predictor', 'prediction', 'predict hardness', 'hardness prediction', 'predict microstructure', 'microstructure predictor', 'laser power', 'scan speed', 'hatch spacing', 'layer thickness', 'volumetric energy density', 'ved', 'parameter optimization', 'process parameters']
  }
];

const CATALOG_STOP_WORDS = new Set([
  'about', 'after', 'also', 'and', 'are', 'can', 'compare', 'data', 'does', 'for',
  'from', 'have', 'help', 'how', 'into', 'make', 'material', 'materials', 'need',
  'please', 'process', 'properties', 'property', 'recommend', 'show', 'tell', 'that',
  'the', 'their', 'this', 'what', 'which', 'with', 'would'
]);
const SINGLE_TERM_CATALOG_SEARCH = new Set(['waam', 'lpbf', 'slm', 'dmls', 'ebm', 'hip', 'lens', 'tial']);
const CATALOG_SEARCH_SYNONYMS = new Map<string, string[]>([
  ['waam', ['wire', 'arc', 'additive', 'manufacturing']],
  ['lpbf', ['laser', 'powder', 'bed', 'fusion']],
  ['slm', ['selective', 'laser', 'melting']],
  ['dmls', ['direct', 'metal', 'laser', 'sintering']],
  ['ebm', ['electron', 'beam', 'melting']],
  ['hip', ['hot', 'isostatic', 'pressing']],
  ['lens', ['laser', 'engineered', 'net', 'shaping']]
]);

function normalizeSearchText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
}

function findNavigationTarget(query: string): CopilotNavigationTarget | undefined {
  const normalizedQuery = ` ${normalizeSearchText(query)} `;
  let bestMatch: CopilotNavigationTarget | undefined;
  let bestScore = 0;
  let bestSpecificity = 0;

  for (const intent of NAVIGATION_INTENTS) {
    const matches = intent.keywords.filter((keyword) =>
      normalizedQuery.includes(` ${normalizeSearchText(keyword)} `)
    );
    const score = matches.reduce((total, keyword) => total + normalizeSearchText(keyword).split(' ').length, 0);
    const specificity = matches.reduce((total, keyword) => total + keyword.length, 0);

    if (score > bestScore || (score === bestScore && specificity > bestSpecificity)) {
      bestMatch = { id: intent.id, label: intent.label };
      bestScore = score;
      bestSpecificity = specificity;
    }
  }

  return bestMatch;
}

function findCatalogEvidence(query: string): string[] {
  const inputTerms = normalizeSearchText(query).split(' ');
  const queryTerms = [...new Set([
    ...inputTerms,
    ...inputTerms.flatMap((term) => CATALOG_SEARCH_SYNONYMS.get(term) ?? [])
  ])].filter((term) => (term.length >= 3 || /\d/.test(term)) && !CATALOG_STOP_WORDS.has(term));

  if (queryTerms.length === 0) return [];

  const singleTermSearch = queryTerms.length === 1 && SINGLE_TERM_CATALOG_SEARCH.has(queryTerms[0]);
  const matches = MATERIALS_CATALOG.flatMap((material) =>
    material.processRoutes.map((route) => {
      const searchableText = normalizeSearchText([
        material.name,
        material.formula,
        material.standardCode,
        material.overview,
        material.applications.join(' '),
        JSON.stringify(material.mechanical),
        JSON.stringify(material.thermal),
        JSON.stringify(material.amQuality),
        JSON.stringify(material.chemicalAndPhysical),
        route.name,
        route.shortName,
        route.temperOrGrade,
        route.processCategory,
        route.subprocess,
        route.postProcessingCondition,
        route.summary,
        JSON.stringify(route.propertyOverrides ?? {})
      ].join(' '));
      const searchableTerms = new Set(searchableText.split(' '));
      const matchedTerms = queryTerms.filter((term) => searchableTerms.has(term));

      return { material, route, score: matchedTerms.length };
    })
  )
    .filter((match) => match.score >= 2 || (singleTermSearch && match.score === 1))
    .sort((a, b) => b.score - a.score)
    .slice(0, 2);

  return matches.map(({ material, route }) => {
    const properties = route.propertyOverrides;
    const metrics = [
      properties?.tensileStrengthMPa && `UTS ${properties.tensileStrengthMPa}`,
      properties?.yieldStrengthMPa && `yield ${properties.yieldStrengthMPa}`,
      properties?.elongationPct && `elongation ${properties.elongationPct}`,
      properties?.hardnessHV && `hardness ${properties.hardnessHV}`,
      properties?.relativeDensityPct && `relative density ${properties.relativeDensityPct}`
    ].filter((metric): metric is string => Boolean(metric));
    const summary = route.summary.trim();
    const detail = summary ? ` ${summary.slice(0, 220)}${summary.length > 220 ? '…' : ''}` : '';
    const materialMetrics = [
      `UTS ${material.mechanical.tensileStrengthMPa}`,
      `yield ${material.mechanical.yieldStrengthMPa}`,
      `elongation ${material.mechanical.elongationPct}`,
      `hardness ${material.mechanical.hardnessHV}`
    ].join('; ');
    const metricText = metrics.length > 0
      ? ` Route-specific recorded metrics: ${metrics.join('; ')}.`
      : ` Material catalog metrics: ${materialMetrics}.`;

    return `• ${material.name} — ${route.name} (${route.processCategory}).${detail}${metricText}`;
  });
}

const PRESET_QUERIES = [
  {
    label: 'Eliminate Keyholing in Ti-6Al-4V',
    prompt: 'How do I eliminate keyhole pore formation in Ti-6Al-4V while maintaining >99.8% density?',
  },
  {
    label: 'Medical Grade ASTM F3001 Recipe',
    prompt: 'What heat treatment and laser parameters are needed to satisfy ASTM F3001 medical elongation (>12%)?',
  },
  {
    label: 'Crack-Free Printing for Gamma TiAl',
    prompt: 'What preheat temperature and scanning strategy is required to prevent cracking in brittle Gamma TiAl?',
  },
  {
    label: 'LPBF vs WAAM for Aerospace Ribs',
    prompt: 'Compare Laser Powder Bed Fusion vs Wire Arc AM for manufacturing large titanium structural ribs.',
  },
];

/**
 * Normalizes raw math notation, unescaped LaTeX symbols, and raw dollar wrappers
 * into clean, readable Unicode characters and professional typography.
 */
function cleanMathSyntax(raw: string): string {
  if (!raw) return '';
  return raw
    .replace(/\\approx/g, '≈')
    .replace(/\\sim/g, '~')
    .replace(/\\ge/g, '≥')
    .replace(/\\le/g, '≤')
    .replace(/\\ne/g, '≠')
    .replace(/\\pm/g, '±')
    .replace(/\\times/g, '×')
    .replace(/\\cdot/g, '·')
    .replace(/\\alpha'/g, "α'")
    .replace(/\\alpha/g, 'α')
    .replace(/\\beta/g, 'β')
    .replace(/\\gamma/g, 'γ')
    .replace(/\\delta/g, 'δ')
    .replace(/\\Delta/g, 'Δ')
    .replace(/\\mu/g, 'μ')
    .replace(/\\sigma/g, 'σ')
    .replace(/\\rho/g, 'ρ')
    .replace(/\\lambda/g, 'λ')
    .replace(/\\theta/g, 'θ')
    .replace(/\\pi/g, 'π')
    .replace(/\\sqrt/g, '√')
    .replace(/\\infty/g, '∞')
    .replace(/\\%/g, '%')
    .replace(/\\text\{([^}]+)\}/g, '$1')
    .replace(/\^3/g, '³')
    .replace(/\^2/g, '²')
    .replace(/\^5/g, '⁵')
    .replace(/\^\circ/g, '°')
    .replace(/\$([^$]+)\$/g, '$1')
    .replace(/\$/g, '')
    .trim();
}

/**
 * Parses inline bold markdown (**text**) and renders with high-contrast text.
 */
const FormattedInlineText: React.FC<{ text: string }> = ({ text }) => {
  const cleaned = cleanMathSyntax(text);
  const parts = cleaned.split(/(\*\*.*?\*\*)/g);

  return (
    <>
      {parts.map((part, idx) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          const boldContent = part.slice(2, -2);
          return (
            <strong key={idx} className="font-semibold text-white">
              {boldContent}
            </strong>
          );
        }
        return <span key={idx}>{part}</span>;
      })}
    </>
  );
};

/**
 * Rich message renderer for Copilot responses:
 * - Parses section titles (**Title:**) into distinct accent header pills
 * - Parses numbered action plans into structured cards with colored step badges
 * - Parses bullet points into clean aligned lists
 * - Normalizes math symbols and highlights key numerical values
 */
export const FormattedCopilotMessage: React.FC<{ text: string }> = ({ text }) => {
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];

  let currentStepList: { num: string; title: string; body: string }[] = [];
  let currentBullets: string[] = [];

  const flushStepList = (keyPrefix: number) => {
    if (currentStepList.length > 0) {
      elements.push(
        <div key={`steps-${keyPrefix}`} className="space-y-2 my-2">
          {currentStepList.map((step, sIdx) => (
            <div
              key={sIdx}
              className="p-2.5 rounded-lg bg-[#0b1420] border border-[#1b2b3e] text-xs hover:border-[#2d4664] transition-colors shadow-sm"
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="w-4 h-4 rounded-full bg-[#50d8e9]/20 text-[#50d8e9] border border-[#50d8e9]/40 flex items-center justify-center font-mono font-bold text-[10px] shrink-0">
                  {step.num}
                </span>
                <span className="font-bold text-white tracking-tight">
                  <FormattedInlineText text={step.title} />
                </span>
              </div>
              <p className="text-[#a8c4e0] text-[11.5px] leading-relaxed pl-6">
                <FormattedInlineText text={step.body} />
              </p>
            </div>
          ))}
        </div>
      );
      currentStepList = [];
    }
  };

  const flushBullets = (keyPrefix: number) => {
    if (currentBullets.length > 0) {
      elements.push(
        <div key={`bullets-${keyPrefix}`} className="space-y-1.5 my-2 pl-1">
          {currentBullets.map((bullet, bIdx) => (
            <div key={bIdx} className="flex items-start gap-2 text-xs text-[#a8c4e0] leading-relaxed">
              <span className="text-[#50d8e9] font-bold shrink-0 mt-0.5">•</span>
              <div>
                <FormattedInlineText text={bullet} />
              </div>
            </div>
          ))}
        </div>
      );
      currentBullets = [];
    }
  };

  lines.forEach((line, idx) => {
    const trimmed = line.trim();

    if (!trimmed) {
      flushStepList(idx);
      flushBullets(idx);
      return;
    }

    // Check if line is a section header (e.g. **Header:** or **Header**)
    const headerMatch = trimmed.match(/^\*\*(.+?):?\*\*$/);
    if (headerMatch) {
      flushStepList(idx);
      flushBullets(idx);
      const title = headerMatch[1].replace(/:$/, '');
      elements.push(
        <div key={`hdr-${idx}`} className="pt-2 pb-1 border-b border-[#1c2e42] flex items-center gap-2 mt-2 first:mt-0">
          <span className="w-2 h-2 rounded-full bg-[#50d8e9] shadow-[0_0_8px_#50d8e9]" />
          <h4 className="font-mono font-bold text-xs text-white uppercase tracking-wide">
            {cleanMathSyntax(title)}
          </h4>
        </div>
      );
      return;
    }

    // Check if line is a numbered step (e.g. 1. **Title:** Body or 1. Title: Body or 1. Body)
    const stepMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
    if (stepMatch) {
      flushBullets(idx);
      const num = stepMatch[1];
      const remainder = stepMatch[2];

      const titleBodyMatch = remainder.match(/^(\*\*.*?\*\*|[^:]+:)\s*(.*)$/);
      if (titleBodyMatch) {
        currentStepList.push({
          num,
          title: titleBodyMatch[1].replace(/^(\*\*)|(\*\*)$/g, ''),
          body: titleBodyMatch[2],
        });
      } else {
        currentStepList.push({
          num,
          title: `Step ${num}`,
          body: remainder,
        });
      }
      return;
    }

    // Check if line is a bullet item (e.g. • or - or *)
    const bulletMatch = trimmed.match(/^[•\-\*]\s+(.*)$/);
    if (bulletMatch) {
      flushStepList(idx);
      currentBullets.push(bulletMatch[1]);
      return;
    }

    // Otherwise, normal paragraph
    flushStepList(idx);
    flushBullets(idx);
    elements.push(
      <p key={`p-${idx}`} className="text-xs text-[#b8d1eb] leading-relaxed my-1">
        <FormattedInlineText text={trimmed} />
      </p>
    );
  });

  flushStepList(lines.length);
  flushBullets(lines.length);

  return <div className="space-y-1">{elements}</div>;
};

export const MatSciCopilotDrawer: React.FC<MatSciCopilotDrawerProps> = ({
  isOpen,
  onClose,
  activeAlloyName,
  onApplyParameters,
  onScrollToSliders,
  onScrollToWorkbench,
  onNavigateToSection,
}) => {
  const [messages, setMessages] = useState<CopilotMessage[]>([
    {
      id: 'welcome',
      sender: 'ai',
      text: `Hello! I am your **MatSci AM Metallurgy Copilot**. I can help with titanium additive manufacturing, search the site's material and process-variant catalog, and point you to the relevant predictor, defect, qualification, economics, literature, and process sections.\n\nHow can I assist your titanium additive manufacturing build today?`,
      timestamp: 'Just now',
    },
  ]);
  const [inputQuery, setInputQuery] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [appliedParamId, setAppliedParamId] = useState<string | null>(null);
  const [appliedTarget, setAppliedTarget] = useState<'sliders' | 'workbench' | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleSendMessage = (queryText: string) => {
    if (!queryText.trim()) return;

    const userMsg: CopilotMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: queryText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputQuery('');
    setIsTyping(true);

    // Domain Metallurgical Intelligence Response Engine
    setTimeout(() => {
      let aiResponseText = '';
      let recommendedParams: CopilotMessage['recommendedParams'] | undefined = undefined;

      const lower = queryText.toLowerCase();
      const navigationTarget = findNavigationTarget(queryText);
      const catalogEvidence = findCatalogEvidence(queryText);
      const isNavigationRequest = /\b(where|open|find|show me|take me|navigate|go to)\b/.test(lower);

      if (navigationTarget && isNavigationRequest) {
        aiResponseText = `I matched your question to **${navigationTarget.label}** in the website. Use the button below to open that section.`;
      } else if (lower.includes('keyhole') || lower.includes('keyholing')) {
        aiResponseText = `**Keyholing Porosity Remediation:**\n\nKeyhole pore formation occurs when King's **Normalized Enthalpy (H = ΔH/hs)** exceeds **26.0** (safe conduction window: 8.0 – 26.0) and the melt pool depth-to-width aspect ratio **(d/w) exceeds 0.80**. The intense recoil pressure of vaporizing titanium pushes molten metal aside, creating an unstable vapor depression that collapses and traps argon gas voids.\n\n**Action Plan:**\n1. **Increase Scan Speed:** Boost scan speed v from 950 mm/s to **1,250 mm/s** to shorten local laser dwell time.\n2. **Moderate Laser Power:** Adjust power P to **220 W**.\n3. **Resulting Energy Density:** Maintains VED at **≈ 68 J/mm³** (fully dense conduction mode, relative density > 99.85%).`;
        recommendedParams = {
          laserPowerW: 220,
          scanSpeedMmS: 1250,
          hatchSpacingUm: 80,
          layerThicknessUm: 40,
        };
      } else if (lower.includes('astm f3001') || lower.includes('medical') || lower.includes('elongation')) {
        aiResponseText = `**ASTM F3001 Medical Implant Qualification:**\n\nFor medical implants (orthopedic/dental), ASTM F3001 requires strict ductility (**Elongation at break ≥ 12%**, UTS ≥ 860 MPa). In the as-built state, rapid solidification (10⁵ K/s) freezes a 100% fine acicular α' martensitic microstructure with high yield strength but low ductility (~6–8%).\n\n**Qualification Recipe:**\n1. **Optimal As-Built Parameters:** Print at **200 W** and **1,000 mm/s** to minimize oxygen pickup and lack-of-fusion voids.\n2. **HIP Cycle (Hot Isostatic Pressing):** 920°C @ 1,200 bar Argon for 2.0 hours. This dissolves internal pore cavities and transforms brittle α' needles into ductile lamellar α+β grains (elongation reaches 13.5%–15.0%).`;
        recommendedParams = {
          laserPowerW: 200,
          scanSpeedMmS: 1000,
          preheatTempC: 150,
        };
      } else if (lower.includes('gamma') || lower.includes('tial') || lower.includes('crack')) {
        aiResponseText = `**Gamma TiAl (Ti-48Al-2Cr-2Nb) Intermetallic AM:**\n\nGamma TiAl exhibits near-zero room temperature ductility and extreme sensitivity to thermal shock cracks during rapid cooling below its brittle-to-ductile transition temperature (**BDTT ≈ 750°C**).\n\n**Crack-Free Deposition Protocol:**\n1. **High-Temperature Substrate Preheat:** Maintain build plate preheat above **800°C** (or use electron beam AM with 1,000°C powder bed sintering).\n2. **Laser Parameters:** Moderate laser power at **250 W** with high scan speed **1,400 mm/s** to lower localized thermal stress gradients.`;
        recommendedParams = {
          laserPowerW: 250,
          scanSpeedMmS: 1400,
          preheatTempC: 800,
        };
      } else if (lower.includes('waam') || lower.includes('large') || lower.includes('rib')) {
        aiResponseText = `**LPBF vs. WAAM Technology Comparison for Structural Ribs:**\n\n• **Laser PBF:** Ideal for complex thin-walled internal lattices (<0.8 mm) with fine surface finish (Ra ≈ 8–15 μm). Deposition rate is **15–35 cm³/hr**, making multi-meter bulk aerospace ribs cost-prohibitive.\n• **Wire Arc AM (WAAM):** Delivers high deposition rates of **1,500–4,000 cm³/hr** (up to 3–6 kg/hr) at significantly lower feed cost ($65/kg wire vs $220/kg powder). Requires post-build CNC machining.\n\n**Recommendation:**\nUse WAAM for large near-net-shape aerospace spars, followed by sub-transus annealing to relieve residual shrinkage stresses.`;
      } else {
        aiResponseText = navigationTarget
          ? `I matched your question to **${navigationTarget.label}** in the website. Use the button below to open that section.`
          : `I couldn't match that question to a specific website section or a ready-made answer for ${activeAlloyName}. Try naming an alloy, process, defect, property, heat treatment, or one of the site sections.`;
      }

      if (catalogEvidence.length > 0) {
        aiResponseText += `\n\n**Matching Website Catalog Records:**\n${catalogEvidence.join('\n')}\n\nThese matches are retrieved from the site's material and process-variant catalog; check the cited record and applicable standard before using values for qualification or production.`;
      }

      const aiMsg: CopilotMessage = {
        id: `ai-${Date.now()}`,
        sender: 'ai',
        text: aiResponseText,
        navigationTarget,
        recommendedParams,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, aiMsg]);
      setIsTyping(false);
    }, 600);
  };

  const handleApplyAndDirect = (
    msgId: string,
    params: CopilotMessage['recommendedParams'],
    target: 'sliders' | 'workbench'
  ) => {
    if (!params) return;
    onApplyParameters(params);
    setAppliedParamId(msgId);
    setAppliedTarget(target);

    // Direct user to target DOM section
    if (target === 'sliders') {
      onScrollToSliders?.();
      const el = document.getElementById('process-sliders-panel');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    } else {
      onScrollToWorkbench?.();
      const el = document.getElementById('workbench-anchor');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }

    // Auto-close drawer on mobile / smaller laptop displays so the user immediately views the updated controls
    if (window.innerWidth < 1024) {
      setTimeout(() => {
        onClose();
      }, 1200);
    }

    setTimeout(() => {
      setAppliedParamId(null);
      setAppliedTarget(null);
    }, 5000);
  };

  const handleNavigateToSection = (target: CopilotNavigationTarget) => {
    onNavigateToSection(target);
    if (window.innerWidth < 1024) onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-[480px] bg-[#070b10] border-l border-[#1d2736] shadow-2xl flex flex-col justify-between backdrop-blur-xl animate-in slide-in-from-right duration-300">
      {/* Header */}
      <div className="p-4 border-b border-[#1c2736] bg-[#0b121a] flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-[#50d8e9]/20 text-[#50d8e9]">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <span>MatSci AM Copilot</span>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            </h3>
            <p className="text-[11px] text-[#7893af]">
              Titanium Metallurgy &amp; Process Physics Assistant
            </p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-[#7c97b5] hover:text-white hover:bg-[#141e2b] transition-colors"
          title="Close Copilot"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Message Stream */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex gap-3 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {msg.sender === 'ai' && (
              <div className="w-7 h-7 rounded-lg bg-[#50d8e9]/15 text-[#50d8e9] flex items-center justify-center shrink-0 mt-0.5">
                <Bot className="w-4 h-4" />
              </div>
            )}

            <div
              className={`max-w-[88%] rounded-xl p-3.5 leading-relaxed space-y-2.5 ${
                msg.sender === 'user'
                  ? 'bg-[#1a3854] text-white border border-[#2a557d]'
                  : 'bg-[#0f1722] text-[#c7daf0] border border-[#1d2c3e] shadow-lg'
              }`}
            >
              {/* Formatted Readable AI Text with Section Headers & Action Step Cards */}
              <div className="font-sans">
                <FormattedCopilotMessage text={msg.text} />
              </div>

              {msg.recommendedParams && (
                <div className="pt-2 border-t border-[#1e2f42] space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-bold text-[#50d8e9] tracking-wider font-mono flex items-center gap-1.5">
                      <Sliders className="w-3 h-3 text-[#50d8e9]" />
                      <span>Recommended Process Parameters:</span>
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-1.5 font-mono text-[11px] text-white">
                    {msg.recommendedParams.laserPowerW && (
                      <span className="px-2 py-0.5 rounded bg-[#131f2d] border border-[#23384f] text-[#50d8e9]">
                        P = {msg.recommendedParams.laserPowerW} W
                      </span>
                    )}
                    {msg.recommendedParams.scanSpeedMmS && (
                      <span className="px-2 py-0.5 rounded bg-[#131f2d] border border-[#23384f] text-[#50d8e9]">
                        v = {msg.recommendedParams.scanSpeedMmS} mm/s
                      </span>
                    )}
                    {msg.recommendedParams.hatchSpacingUm && (
                      <span className="px-2 py-0.5 rounded bg-[#131f2d] border border-[#23384f] text-[#bec2ff]">
                        h = {msg.recommendedParams.hatchSpacingUm} μm
                      </span>
                    )}
                    {msg.recommendedParams.layerThicknessUm && (
                      <span className="px-2 py-0.5 rounded bg-[#131f2d] border border-[#23384f] text-[#bec2ff]">
                        t = {msg.recommendedParams.layerThicknessUm} μm
                      </span>
                    )}
                    {msg.recommendedParams.preheatTempC && (
                      <span className="px-2 py-0.5 rounded bg-[#131f2d] border border-[#23384f] text-amber-300">
                        T_preheat = {msg.recommendedParams.preheatTempC} °C
                      </span>
                    )}
                  </div>

                  {/* Immediate Visual Direction & Status Notice */}
                  {appliedParamId === msg.id && (
                    <div className="p-2.5 rounded-lg bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs flex items-center justify-between shadow-[0_0_15px_rgba(16,185,129,0.2)] animate-in fade-in slide-in-from-top-1">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        <div>
                          <span className="font-bold text-white">Values Applied!</span>
                          <span className="block text-[10.5px] text-emerald-200/90">
                            {appliedTarget === 'sliders'
                              ? 'Screen directed to the Process Sliders panel.'
                              : 'Screen directed to the Materials Synthesis Workbench.'}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          if (appliedTarget === 'workbench') {
                            document.getElementById('workbench-anchor')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                          } else {
                            document.getElementById('process-sliders-panel')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                          }
                        }}
                        className="text-[10px] font-mono font-bold px-2 py-1 rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 transition-colors"
                      >
                        Jump ↑
                      </button>
                    </div>
                  )}

                  {/* Interactive Buttons Directing User to Sliders or Workbench */}
                  <div className="grid grid-cols-1 gap-2 pt-1">
                    <button
                      onClick={() => handleApplyAndDirect(msg.id, msg.recommendedParams, 'sliders')}
                      className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-[#50d8e9] hover:bg-[#3ec4d6] text-[#070b10] font-bold text-xs transition-all shadow-md active:scale-[0.98] cursor-pointer"
                    >
                      <Sliders className="w-3.5 h-3.5" />
                      <span>Apply Values &amp; Direct to Sliders</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => handleApplyAndDirect(msg.id, msg.recommendedParams, 'workbench')}
                      className="flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg bg-[#111c2a] hover:bg-[#18293d] text-[#8db1d8] hover:text-white border border-[#223953] text-xs font-medium transition-colors active:scale-[0.98] cursor-pointer"
                    >
                      <Compass className="w-3.5 h-3.5 text-[#5E6BFF]" />
                      <span>Direct to Materials Synthesis Workbench</span>
                      <ExternalLink className="w-3 h-3 text-[#6c88a8]" />
                    </button>
                  </div>
                </div>
              )}

              {msg.navigationTarget && (
                <button
                  type="button"
                  onClick={() => handleNavigateToSection(msg.navigationTarget!)}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-[#111c2a] hover:bg-[#18293d] text-[#8db1d8] hover:text-white border border-[#223953] text-xs font-medium transition-colors"
                >
                  <Compass className="w-3.5 h-3.5 text-[#50d8e9]" />
                  <span>Open {msg.navigationTarget.label}</span>
                  <ExternalLink className="w-3 h-3 text-[#6c88a8]" />
                </button>
              )}

              <div className="text-[9.5px] text-[#556e87] text-right">{msg.timestamp}</div>
            </div>

            {msg.sender === 'user' && (
              <div className="w-7 h-7 rounded-lg bg-[#1a3854] text-white flex items-center justify-center shrink-0 mt-0.5">
                <User className="w-4 h-4" />
              </div>
            )}
          </div>
        ))}

        {isTyping && (
          <div className="flex gap-3 justify-start">
            <div className="w-7 h-7 rounded-lg bg-[#50d8e9]/15 text-[#50d8e9] flex items-center justify-center shrink-0">
              <Bot className="w-4 h-4" />
            </div>
            <div className="bg-[#0f1722] text-[#8fa7c2] border border-[#1d2c3e] rounded-xl px-4 py-2.5 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#50d8e9] animate-bounce" />
              <span className="w-1.5 h-1.5 rounded-full bg-[#50d8e9] animate-bounce [animation-delay:0.2s]" />
              <span className="w-1.5 h-1.5 rounded-full bg-[#50d8e9] animate-bounce [animation-delay:0.4s]" />
              <span className="text-[11px] ml-1">Analyzing metallurgical physics...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Quick Prompts */}
      <div className="px-4 py-2.5 bg-[#0a1017] border-t border-[#182330]">
        <div className="text-[10px] text-[#718da8] uppercase tracking-wider mb-1.5 flex items-center gap-1">
          <Lightbulb className="w-3 h-3 text-[#50d8e9]" />
          <span>Quick Exhibition Demonstrations</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {PRESET_QUERIES.map((q, idx) => (
            <button
              key={idx}
              onClick={() => handleSendMessage(q.prompt)}
              className="text-[10.5px] px-2.5 py-1 rounded-md bg-[#101924] border border-[#1e2f42] text-[#8fa8c2] hover:text-[#50d8e9] hover:border-[#50d8e9]/40 transition-colors truncate max-w-full text-left"
            >
              {q.label}
            </button>
          ))}
        </div>
      </div>

      {/* Input Box */}
      <div className="p-3.5 bg-[#0b121a] border-t border-[#1c2736]">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage(inputQuery);
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            value={inputQuery}
            onChange={(e) => setInputQuery(e.target.value)}
            placeholder="Ask about defect elimination, HIP cycles, or ASTM specs..."
            className="flex-1 bg-[#101722] border border-[#213042] rounded-lg px-3 py-2 text-xs text-white placeholder-[#5a7491] focus:outline-none focus:border-[#50d8e9]"
          />
          <button
            type="submit"
            disabled={!inputQuery.trim()}
            className="p-2 rounded-lg bg-[#50d8e9] hover:bg-[#3ec4d6] text-black font-bold transition-all disabled:opacity-40 cursor-pointer"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
