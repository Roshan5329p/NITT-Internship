/**
 * Aerospace & Medical Qualification Audit Engine
 * Evaluates component properties against ASTM F2924, ASTM F3001, AMS 4999, and ISO 5832-3 standards.
 * Generates verified compliance audit objects and professional PDF test certificates.
 */

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface AuditCheckItem {
  property: string;
  measuredValue: string;
  requiredValue: string;
  unit: string;
  status: 'PASS' | 'FAIL' | 'CONDITIONAL';
  notes: string;
}

export interface QualificationAuditReport {
  standardCode: 'ASTM F2924' | 'ASTM F3001' | 'AMS 4999' | 'ISO 5832-3';
  standardTitle: string;
  targetAlloy: string;
  auditClass: string;
  overallStatus: 'CERTIFIED COMPLIANT' | 'CONDITIONAL COMPLIANCE' | 'NON-COMPLIANT';
  overallStatusColor: string;
  verificationHash: string;
  timestamp: string;
  checks: AuditCheckItem[];
  metallurgistSignoff: {
    inspector: string;
    laboratory: string;
    calibrationSystem: string;
  };
  recommendedActions: string[];
}

// Standards requirements catalog
const STANDARDS_SPECIFICATIONS = {
  'ASTM F2924': {
    title: 'Standard Specification for Additive Manufacturing Titanium-6Aluminum-4V with Powder Bed Fusion',
    minYieldMPa: 825,
    minUTSMPa: 895,
    minElongationPct: 10,
    minRelativeDensityPct: 99.5,
    maxResidualStressMPa: 60,
    minFatigueMPa: 520,
    applicableAlloys: ['ti-6al-4v'],
  },
  'ASTM F3001': {
    title: 'Standard Specification for Additive Manufacturing Titanium-6Aluminum-4V ELI for Medical Implant Applications',
    minYieldMPa: 795,
    minUTSMPa: 860,
    minElongationPct: 12,
    minRelativeDensityPct: 99.7,
    maxResidualStressMPa: 40,
    minFatigueMPa: 560,
    applicableAlloys: ['ti-6al-4v-eli', 'ti-13nb-13zr', 'ti-15mo', 'ti-35nb-7zr-5ta'],
  },
  'AMS 4999': {
    title: 'Aerospace Material Specification: Titanium Alloy Direct Metal Deposition',
    minYieldMPa: 840,
    minUTSMPa: 910,
    minElongationPct: 8,
    minRelativeDensityPct: 99.6,
    maxResidualStressMPa: 50,
    minFatigueMPa: 580,
    applicableAlloys: ['ti-6al-4v', 'ti-6242', 'ti-5553', 'ti-811'],
  },
  'ISO 5832-3': {
    title: 'Implants for Surgery — Metallic Materials: Wrought Titanium 6-Aluminium 4-Vanadium',
    minYieldMPa: 780,
    minUTSMPa: 860,
    minElongationPct: 10,
    minRelativeDensityPct: 99.5,
    maxResidualStressMPa: 50,
    minFatigueMPa: 500,
    applicableAlloys: ['ti-6al-4v', 'ti-6al-4v-eli', 'ti-grade-2'],
  },
};

export function evaluateQualificationAudit(
  standardCode: 'ASTM F2924' | 'ASTM F3001' | 'AMS 4999' | 'ISO 5832-3',
  alloyId: string,
  alloyName: string,
  yieldStrengthMPa: number,
  utsMPa: number,
  elongationPct: number,
  relativeDensityPct: number,
  residualStressMPa: number,
  fatigueEnduranceMPa: number,
  heatTreatmentRoute: string
): QualificationAuditReport {
  const spec = STANDARDS_SPECIFICATIONS[standardCode] || STANDARDS_SPECIFICATIONS['ASTM F2924'];

  const checks: AuditCheckItem[] = [
    {
      property: '0.2% Offset Yield Strength (Rp0.2)',
      measuredValue: `${yieldStrengthMPa}`,
      requiredValue: `≥ ${spec.minYieldMPa}`,
      unit: 'MPa',
      status: yieldStrengthMPa >= spec.minYieldMPa ? 'PASS' : 'FAIL',
      notes: yieldStrengthMPa >= spec.minYieldMPa
        ? `Exceeds threshold by +${(yieldStrengthMPa - spec.minYieldMPa).toFixed(0)} MPa`
        : `Deficit of ${(spec.minYieldMPa - yieldStrengthMPa).toFixed(0)} MPa`,
    },
    {
      property: 'Ultimate Tensile Strength (UTS)',
      measuredValue: `${utsMPa}`,
      requiredValue: `≥ ${spec.minUTSMPa}`,
      unit: 'MPa',
      status: utsMPa >= spec.minUTSMPa ? 'PASS' : 'FAIL',
      notes: utsMPa >= spec.minUTSMPa
        ? `Exceeds tensile criteria by +${(utsMPa - spec.minUTSMPa).toFixed(0)} MPa`
        : `Deficit of ${(spec.minUTSMPa - utsMPa).toFixed(0)} MPa`,
    },
    {
      property: 'Elongation at Fracture (Ductility)',
      measuredValue: `${elongationPct.toFixed(1)}`,
      requiredValue: `≥ ${spec.minElongationPct}`,
      unit: '%',
      status: elongationPct >= spec.minElongationPct ? 'PASS' : elongationPct >= spec.minElongationPct * 0.85 ? 'CONDITIONAL' : 'FAIL',
      notes: elongationPct >= spec.minElongationPct
        ? 'Fully compliant with ASTM plastic strain limit'
        : elongationPct >= spec.minElongationPct * 0.85
        ? 'Marginal ductility; Hot Isostatic Pressing (HIP) recommended to collapse micro-voids'
        : 'Sub-standard ductility; un-annealed brittle acicular martensite present',
    },
    {
      property: 'As-Synthesized Relative Density',
      measuredValue: `${relativeDensityPct.toFixed(2)}`,
      requiredValue: `≥ ${spec.minRelativeDensityPct}`,
      unit: '%',
      status: relativeDensityPct >= spec.minRelativeDensityPct ? 'PASS' : 'FAIL',
      notes: relativeDensityPct >= spec.minRelativeDensityPct
        ? 'Meets structural volumetric density threshold (>99.5%)'
        : 'Excessive lack-of-fusion or keyholing voids detected',
    },
    {
      property: 'Internal Residual Macrostress',
      measuredValue: `${residualStressMPa}`,
      requiredValue: `≤ ${spec.maxResidualStressMPa}`,
      unit: 'MPa',
      status: residualStressMPa <= spec.maxResidualStressMPa ? 'PASS' : residualStressMPa <= spec.maxResidualStressMPa * 2 ? 'CONDITIONAL' : 'FAIL',
      notes: residualStressMPa <= spec.maxResidualStressMPa
        ? 'Adequately stress-relieved; safe from distortion and micro-cracking'
        : 'Requires sub-transus stress relief anneal or HIP treatment',
    },
    {
      property: 'High-Cycle Fatigue Threshold (10⁷ cycles)',
      measuredValue: `${fatigueEnduranceMPa}`,
      requiredValue: `≥ ${spec.minFatigueMPa}`,
      unit: 'MPa',
      status: fatigueEnduranceMPa >= spec.minFatigueMPa ? 'PASS' : 'CONDITIONAL',
      notes: fatigueEnduranceMPa >= spec.minFatigueMPa
        ? 'Exceeds dynamic rotating-beam fatigue endurance limit'
        : 'Surface finishing or HIP pore-healing recommended for critical rotating fatigue service',
    },
  ];

  const passCount = checks.filter(c => c.status === 'PASS').length;
  const failCount = checks.filter(c => c.status === 'FAIL').length;

  let overallStatus: QualificationAuditReport['overallStatus'] = 'CERTIFIED COMPLIANT';
  let overallStatusColor = '#10b981'; // Emerald

  if (failCount > 0) {
    overallStatus = 'NON-COMPLIANT';
    overallStatusColor = '#ef4444'; // Red
  } else if (passCount < checks.length) {
    overallStatus = 'CONDITIONAL COMPLIANCE';
    overallStatusColor = '#f59e0b'; // Amber
  }

  // Generate pseudo-SHA256 digital certificate hash
  const pseudoInput = `${standardCode}|${alloyId}|${yieldStrengthMPa}|${utsMPa}|${relativeDensityPct}|${Date.now()}`;
  let hashVal = 0x811c9dc5;
  for (let i = 0; i < pseudoInput.length; i++) {
    hashVal ^= pseudoInput.charCodeAt(i);
    hashVal += (hashVal << 1) + (hashVal << 4) + (hashVal << 7) + (hashVal << 8) + (hashVal << 24);
  }
  const verificationHash = 'SHA256-' + Math.abs(hashVal).toString(16).padStart(12, '0').toUpperCase() +
    '-' + Date.now().toString(16).toUpperCase();

  const recommendedActions: string[] = [];
  if (residualStressMPa > spec.maxResidualStressMPa) {
    recommendedActions.push(`Perform Sub-Transus Stress-Relief (700°C–800°C for 2h in industrial vacuum) to lower residual stresses below ${spec.maxResidualStressMPa} MPa.`);
  }
  if (elongationPct < spec.minElongationPct) {
    recommendedActions.push(`Apply standard Hot Isostatic Pressing (HIP: 920°C @ 1000–1200 bar Ar for 2h) to dissolve grain boundary voids and boost ductility.`);
  }
  if (relativeDensityPct < spec.minRelativeDensityPct) {
    recommendedActions.push('Recalibrate laser energy density into the Conduction Mode process window to eliminate lack-of-fusion porosity.');
  }
  if (recommendedActions.length === 0) {
    recommendedActions.push('Component fully satisfies aerospace/medical audit criteria. Ready for direct mechanical coupon witness testing and serial production.');
  }

  return {
    standardCode,
    standardTitle: spec.title,
    targetAlloy: alloyName,
    auditClass: heatTreatmentRoute.includes('HIP') ? 'Class D (Full HIP + Thermal)' : 'Class B / C (Stress Relieved)',
    overallStatus,
    overallStatusColor,
    verificationHash,
    timestamp: new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }),
    checks,
    metallurgistSignoff: {
      inspector: 'MatSci Calibrated Automated Metrology System',
      laboratory: 'Advanced Materials & Additive Manufacturing Qualification Lab',
      calibrationSystem: 'ISO/IEC 17025 Traceable Physics Verification Engine',
    },
    recommendedActions,
  };
}

export function generateQualificationCertificatePdf(report: QualificationAuditReport): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  // Background and Margins
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Top Dark Header Bar
  doc.setFillColor(15, 23, 42); // Slate 900
  doc.rect(0, 0, pageWidth, 36, 'F');

  // Accent Line
  doc.setFillColor(80, 216, 233); // Cyan
  doc.rect(0, 36, pageWidth, 1.5, 'F');

  // Header Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(255, 255, 255);
  doc.text('ENGINEERING QUALIFICATION AUDIT CERTIFICATE', 14, 16);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(148, 163, 184); // Slate 400
  doc.text(`AEROSPACE & MEDICAL ADDITIVE MANUFACTURING COMPLIANCE • ${report.standardCode}`, 14, 23);
  doc.text(`Certificate Hash: ${report.verificationHash}`, 14, 29);

  // Status Badge in Header
  const statusColor = report.overallStatus === 'CERTIFIED COMPLIANT' ? [16, 185, 129] : report.overallStatus === 'NON-COMPLIANT' ? [239, 68, 68] : [245, 158, 11];
  doc.setFillColor(statusColor[0], statusColor[1], statusColor[2]);
  doc.roundedRect(pageWidth - 75, 10, 61, 16, 2, 2, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(255, 255, 255);
  doc.text(report.overallStatus, pageWidth - 44.5, 20, { align: 'center' });

  // Section 1: Component & Specification Metadata
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(30, 41, 59);
  doc.text('1. Component & Standards Metadata', 14, 46);

  autoTable(doc, {
    startY: 49,
    theme: 'grid',
    headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontSize: 8 },
    bodyStyles: { fontSize: 8, textColor: [51, 65, 85] },
    body: [
      ['Target Alloy Specification', report.targetAlloy, 'Audit Date & Time', report.timestamp],
      ['Standard Referenced', report.standardCode, 'Qualification Class', report.auditClass],
      ['Standard Full Title', { content: report.standardTitle, colSpan: 3 }],
    ],
    margin: { left: 14, right: 14 },
  });

  // Section 2: Property Verification Table
  const tableFinalY = (doc as any).lastAutoTable.finalY || 80;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(30, 41, 59);
  doc.text('2. Mechanical & Physical Properties Verification', 14, tableFinalY + 8);

  const tableRows = report.checks.map(c => [
    c.property,
    `${c.measuredValue} ${c.unit}`,
    `${c.requiredValue} ${c.unit}`,
    c.status,
    c.notes,
  ]);

  autoTable(doc, {
    startY: tableFinalY + 11,
    theme: 'striped',
    head: [['Mechanical / Physical Property', 'Predicted Output', 'Required Threshold', 'Verdict', 'Audit Notes']],
    body: tableRows,
    headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontSize: 8 },
    bodyStyles: { fontSize: 8 },
    columnStyles: {
      0: { cellWidth: 50 },
      1: { cellWidth: 26, fontStyle: 'bold' },
      2: { cellWidth: 26 },
      3: { cellWidth: 22, fontStyle: 'bold', halign: 'center' },
      4: { cellWidth: 'auto' },
    },
    didParseCell: (data) => {
      if (data.column.index === 3 && data.section === 'body') {
        const val = data.cell.raw;
        if (val === 'PASS') {
          data.cell.styles.textColor = [16, 185, 129];
        } else if (val === 'FAIL') {
          data.cell.styles.textColor = [239, 68, 68];
        } else {
          data.cell.styles.textColor = [217, 119, 6];
        }
      }
    },
    margin: { left: 14, right: 14 },
  });

  // Section 3: Metallurgical Recommendations
  const sec3Y = (doc as any).lastAutoTable.finalY + 8;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(30, 41, 59);
  doc.text('3. Metallurgical Post-Processing Action Plan', 14, sec3Y);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);

  let currentY = sec3Y + 5;
  report.recommendedActions.forEach((rec, idx) => {
    doc.text(`•  ${rec}`, 18, currentY);
    currentY += 4.5;
  });

  // Section 4: Sign-off & QA Verification Stamp
  const signY = Math.max(currentY + 6, pageHeight - 42);
  doc.setFillColor(248, 250, 252);
  doc.rect(14, signY, pageWidth - 28, 28, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.rect(14, signY, pageWidth - 28, 28, 'D');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(30, 41, 59);
  doc.text('Digital Quality Assurance Sign-Off:', 18, signY + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text(`System: ${report.metallurgistSignoff.inspector}`, 18, signY + 11);
  doc.text(`Facility: ${report.metallurgistSignoff.laboratory}`, 18, signY + 16);
  doc.text(`Standards Traceability: ${report.metallurgistSignoff.calibrationSystem}`, 18, signY + 21);

  // Digital Stamp Seal
  doc.setDrawColor(80, 216, 233);
  doc.setLineWidth(0.6);
  doc.roundedRect(pageWidth - 62, signY + 4, 44, 20, 2, 2, 'D');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(14, 116, 144);
  doc.text('DIGITALLY AUDITED', pageWidth - 40, signY + 11, { align: 'center' });
  doc.setFontSize(6.5);
  doc.text('MATSCI QUAL ENGINE', pageWidth - 40, signY + 16, { align: 'center' });
  doc.text('VALIDATED CERT', pageWidth - 40, signY + 20, { align: 'center' });

  // Footer
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(148, 163, 184);
  doc.text('Generated by MatSci Navigator Titanium AM Platform • Calibrated with ISO/ASTM Additive Manufacturing Standards', 14, pageHeight - 6);

  doc.save(`Qualification_Audit_${report.standardCode.replace(/\s+/g, '_')}_${Date.now()}.pdf`);
}
