/**
 * NIT Trichy Titanium AM Platform — Native Proprietary CAD (.ipt, .prt) Export Guide
 * Option B (Zero cost, zero cloud upload): Reads at most the first 64 KB header locally to
 * identify Autodesk Inventor (.ipt), Siemens NX (.prt), or PTC Creo (.prt) and gives exact
 * STEP AP242 export instructions.
 */

import { getCadExtension, NATIVE_HEADER_SLICE_BYTES } from './cad-guardrails';

export type DetectedNativeCadApp = 'inventor' | 'nx' | 'creo' | 'nx_or_creo';

export interface CadExportInstruction {
  appName: string;
  menuPath: string;
  recommendedSettings: string;
}

export interface NativeCadGuideResult {
  fileName: string;
  extension: string;
  detectedApp: DetectedNativeCadApp;
  detectionConfidence: 'header-signature' | 'extension-ambiguous';
  detectionNote: string;
  instructions: CadExportInstruction[];
}

function bytesToAsciiSample(bytes: Uint8Array): string {
  const limit = Math.min(bytes.length, NATIVE_HEADER_SLICE_BYTES);
  let out = '';
  for (let i = 0; i < limit; i++) {
    const c = bytes[i];
    out += (c >= 32 && c <= 126) ? String.fromCharCode(c) : ' ';
  }
  return out;
}

/**
 * Inspects at most the first 64 KB of an .ipt or .prt file to classify its native CAD tool
 * and return actionable STEP AP242 export instructions.
 */
export function buildNativeCadGuide(
  fileName: string,
  headerBytes?: Uint8Array | ArrayBuffer | null
): NativeCadGuideResult {
  const ext = getCadExtension(fileName);
  let bytes: Uint8Array = new Uint8Array(0);
  if (headerBytes instanceof Uint8Array) {
    bytes = headerBytes.subarray(0, NATIVE_HEADER_SLICE_BYTES);
  } else if (headerBytes instanceof ArrayBuffer) {
    bytes = new Uint8Array(headerBytes, 0, Math.min(headerBytes.byteLength, NATIVE_HEADER_SLICE_BYTES));
  }

  const ascii = bytesToAsciiSample(bytes);
  const isOleCompound =
    bytes.length >= 8 &&
    bytes[0] === 0xd0 && bytes[1] === 0xcf && bytes[2] === 0x11 && bytes[3] === 0xe0;

  if (ext === 'ipt') {
    return {
      fileName,
      extension: 'ipt',
      detectedApp: 'inventor',
      detectionConfidence: isOleCompound || /inventor|autodesk/i.test(ascii) ? 'header-signature' : 'extension-ambiguous',
      detectionNote: 'Autodesk Inventor native part (.ipt) detected. Native Inventor binaries cannot be parsed directly in-browser.',
      instructions: [
        {
          appName: 'Autodesk Inventor',
          menuPath: 'File → Export → CAD Format → Save as type: STEP Files (*.stp, *.ste, *.step)',
          recommendedSettings: 'Protocol: AP242 (or AP214), Units: Millimeter (mm), Single Solid Body'
        }
      ]
    };
  }

  // Disambiguate .prt between PTC Creo / Pro-ENGINEER and Siemens NX (Unigraphics)
  const isCreo = /#UGC:2|PRO\/ENGINEER|PTC|CREO/i.test(ascii);
  const isNx = /\bUGII\b|UNIGRAPHICS|SIEMENS\s+NX|PARASOLID/i.test(ascii);

  if (isCreo && !isNx) {
    return {
      fileName,
      extension: 'prt',
      detectedApp: 'creo',
      detectionConfidence: 'header-signature',
      detectionNote: 'PTC Creo / Pro-ENGINEER header signature detected in .prt file.',
      instructions: [
        {
          appName: 'PTC Creo Parametric',
          menuPath: 'File → Save As → Export → Type: STEP (*.stp)',
          recommendedSettings: 'Format: AP242 / AP214 IS, Include: Solid & Quilts, Units: mm'
        }
      ]
    };
  }

  if (isNx && !isCreo) {
    return {
      fileName,
      extension: 'prt',
      detectedApp: 'nx',
      detectionConfidence: 'header-signature',
      detectionNote: 'Siemens NX / Unigraphics signature detected in .prt file.',
      instructions: [
        {
          appName: 'Siemens NX',
          menuPath: 'File → Export → STEP (AP242 or AP214)',
          recommendedSettings: 'Object Types: Solid, Output Units: Millimeters, File Extension: .stp / .step'
        }
      ]
    };
  }

  return {
    fileName,
    extension: ext || 'prt',
    detectedApp: 'nx_or_creo',
    detectionConfidence: 'extension-ambiguous',
    detectionNote: 'Both Siemens NX and PTC Creo share the .prt extension; follow the matching export step below and drop the resulting STEP file.',
    instructions: [
      {
        appName: 'Siemens NX',
        menuPath: 'File → Export → STEP',
        recommendedSettings: 'Protocol: AP242 / AP214, Export: Solid Bodies, Units: Millimeters (.stp)'
      },
      {
        appName: 'PTC Creo Parametric',
        menuPath: 'File → Save As → Type: STEP (*.stp)',
        recommendedSettings: 'Application Protocol: ap242 / ap214_is, Geometry: Solid, Units: mm'
      }
    ]
  };
}
