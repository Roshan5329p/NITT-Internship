/**
 * NIT Trichy Titanium AM Platform — CAD Upload File & Mesh Complexity Guardrails
 * Enforces safe client-side memory ceilings:
 *   - 150 MB default cap for .stl
 *   -  60 MB default cap for .step / .stp / .iges
 *   - Unlimited for .ipt / .prt (header-only inspection < 64 KB)
 *   - Soft warning above 50 MB or 1,000,000 triangles; auto-decimation recommended above 2,000,000 triangles.
 */

export type SupportedCadExtension = 'stl' | 'step' | 'stp' | 'iges' | 'igs' | 'ipt' | 'prt';
export type CadParseCategory = 'stl' | 'brep' | 'native_guide' | 'unsupported';

export interface FileGuardrailDecision {
  allowed: boolean;
  extension: string;
  category: CadParseCategory;
  fileSizeMb: number;
  maxRecommendedMb: number;
  softWarningMb: number;
  requiresNativeGuide: boolean;
  warnings: string[];
  blockingReason: string | null;
  overriddenByForceLoad: boolean;
}

export interface BoundingBox3D {
  min: [number, number, number];
  max: [number, number, number];
  size: [number, number, number];
}

export type SuggestedSourceUnit = 'mm' | 'inch' | 'm';

export interface MeshComplexityReport {
  triangleCount: number;
  isComplexWarning: boolean;
  requiresAutoDecimation: boolean;
  suggestedDecimatedTarget: number;
  suggestedUnit: SuggestedSourceUnit;
  unitPromptReason: string | null;
  warnings: string[];
}

export const CAD_SOFT_WARNING_MB = 50;
export const CAD_STL_CAP_MB = 150;
export const CAD_BREP_CAP_MB = 60;
export const CAD_SOFT_TRIANGLE_WARNING = 1_000_000;
export const CAD_DECIMATE_THRESHOLD = 2_000_000;
export const NATIVE_HEADER_SLICE_BYTES = 65_536; // 64 KB inspection limit

export function getCadExtension(fileName: string): string {
  const clean = String(fileName || '').trim().toLowerCase();
  const dot = clean.lastIndexOf('.');
  if (dot < 0 || dot === clean.length - 1) return '';
  return clean.slice(dot + 1);
}

export function classifyCadExtension(ext: string): CadParseCategory {
  if (ext === 'stl') return 'stl';
  if (ext === 'step' || ext === 'stp' || ext === 'iges' || ext === 'igs') return 'brep';
  if (ext === 'ipt' || ext === 'prt') return 'native_guide';
  return 'unsupported';
}

/**
 * Evaluates whether a dropped CAD file can be safely parsed in browser memory.
 */
export function evaluateFileGuardrails(
  fileName: string,
  byteLength: number,
  forceLoadAnyway: boolean = false
): FileGuardrailDecision {
  const extension = getCadExtension(fileName);
  const category = classifyCadExtension(extension);
  const safeBytes = Number.isFinite(byteLength) && byteLength >= 0 ? byteLength : 0;
  const fileSizeMb = Number((safeBytes / (1024 * 1024)).toFixed(2));
  const warnings: string[] = [];

  if (category === 'unsupported') {
    return {
      allowed: false,
      extension,
      category,
      fileSizeMb,
      maxRecommendedMb: 0,
      softWarningMb: 0,
      requiresNativeGuide: false,
      warnings: [],
      blockingReason: `Unsupported file format '.${extension || 'unknown'}'. Accepted formats: .stl, .step, .stp, .iges, .ipt, .prt.`,
      overriddenByForceLoad: false
    };
  }

  if (safeBytes === 0) {
    return {
      allowed: false,
      extension,
      category,
      fileSizeMb: 0,
      maxRecommendedMb: category === 'stl' ? CAD_STL_CAP_MB : CAD_BREP_CAP_MB,
      softWarningMb: CAD_SOFT_WARNING_MB,
      requiresNativeGuide: false,
      warnings: [],
      blockingReason: 'Selected CAD file is empty (0 bytes).',
      overriddenByForceLoad: false
    };
  }

  if (category === 'native_guide') {
    return {
      allowed: true,
      extension,
      category,
      fileSizeMb,
      maxRecommendedMb: Infinity,
      softWarningMb: Infinity,
      requiresNativeGuide: true,
      warnings: [],
      blockingReason: null,
      overriddenByForceLoad: false
    };
  }

  const maxRecommendedMb = category === 'stl' ? CAD_STL_CAP_MB : CAD_BREP_CAP_MB;
  const softWarningMb = CAD_SOFT_WARNING_MB;

  if (fileSizeMb > softWarningMb && fileSizeMb <= maxRecommendedMb) {
    warnings.push(
      `Large CAD file (${fileSizeMb} MB > ${softWarningMb} MB soft limit). Parsing and 3D rendering may take several seconds using sampled analysis.`
    );
  }

  if (fileSizeMb > maxRecommendedMb) {
    if (forceLoadAnyway) {
      warnings.push(
        `Workstation override active: loading ${fileSizeMb} MB .${extension} above recommended ${maxRecommendedMb} MB cap.`
      );
      return {
        allowed: true,
        extension,
        category,
        fileSizeMb,
        maxRecommendedMb,
        softWarningMb,
        requiresNativeGuide: false,
        warnings,
        blockingReason: null,
        overriddenByForceLoad: true
      };
    }

    return {
      allowed: false,
      extension,
      category,
      fileSizeMb,
      maxRecommendedMb,
      softWarningMb,
      requiresNativeGuide: false,
      warnings: [],
      blockingReason: `${category === 'stl' ? 'STL' : 'STEP/IGES'} file (${fileSizeMb} MB) exceeds the ${maxRecommendedMb} MB browser safety limit. Enable "Force Load Anyway (High-RAM Workstation)" to override.`,
      overriddenByForceLoad: false
    };
  }

  return {
    allowed: true,
    extension,
    category,
    fileSizeMb,
    maxRecommendedMb,
    softWarningMb,
    requiresNativeGuide: false,
    warnings,
    blockingReason: null,
    overriddenByForceLoad: false
  };
}

/**
 * Checks parsed triangle count and bounding-box scale for performance warnings & mm/inch prompts.
 */
export function evaluateMeshGuardrails(
  triangleCount: number,
  bbox: BoundingBox3D
): MeshComplexityReport {
  const safeTris = Number.isFinite(triangleCount) && triangleCount > 0 ? Math.round(triangleCount) : 0;
  const warnings: string[] = [];

  const isComplexWarning = safeTris > CAD_SOFT_TRIANGLE_WARNING;
  const requiresAutoDecimation = safeTris > CAD_DECIMATE_THRESHOLD;
  const suggestedDecimatedTarget = requiresAutoDecimation ? 1_200_000 : safeTris;

  if (requiresAutoDecimation) {
    warnings.push(
      `Mesh has ${safeTris.toLocaleString()} triangles (> 2,000,000 limit). Analysis mesh will be automatically simplified to ${suggestedDecimatedTarget.toLocaleString()} triangles to keep the browser responsive.`
    );
  } else if (isComplexWarning) {
    warnings.push(
      `High-density mesh (${safeTris.toLocaleString()} triangles > 1,000,000 threshold). Sampled layer slicing & BVH acceleration enabled.`
    );
  }

  const maxExtent = Math.max(bbox.size[0], bbox.size[1], bbox.size[2]);
  let suggestedUnit: SuggestedSourceUnit = 'mm';
  let unitPromptReason: string | null = null;

  if (Number.isFinite(maxExtent) && maxExtent > 0) {
    if (maxExtent < 0.8) {
      suggestedUnit = 'm';
      unitPromptReason = `Maximum part span is ${maxExtent.toFixed(3)} units — if exported in meters, switch source unit to m (×1000).`;
    } else if (maxExtent < 10.0) {
      suggestedUnit = 'inch';
      unitPromptReason = `Maximum part span is ${maxExtent.toFixed(2)} units — verify whether this file was exported in inches (×25.4 mm) or small mm.`;
    }
  }

  return {
    triangleCount: safeTris,
    isComplexWarning,
    requiresAutoDecimation,
    suggestedDecimatedTarget,
    suggestedUnit,
    unitPromptReason,
    warnings
  };
}
