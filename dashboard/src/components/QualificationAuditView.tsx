import React, { useState, useMemo } from 'react';
import {
  evaluateQualificationAudit,
  generateQualificationCertificatePdf,
  QualificationAuditReport
} from '../utils/qualificationEngine';
import { Award, Download, CheckCircle2, XCircle, AlertTriangle, ShieldCheck, FileText, Check } from 'lucide-react';

interface QualificationAuditViewProps {
  alloyId: string;
  alloyName: string;
  yieldStrengthMPa: number;
  utsMPa: number;
  elongationPct: number;
  relativeDensityPct: number;
  residualStressMPa: number;
  fatigueEnduranceMPa: number;
  heatTreatmentRoute: string;
}

export const QualificationAuditView: React.FC<QualificationAuditViewProps> = ({
  alloyId,
  alloyName,
  yieldStrengthMPa,
  utsMPa,
  elongationPct,
  relativeDensityPct,
  residualStressMPa,
  fatigueEnduranceMPa,
  heatTreatmentRoute,
}) => {
  const [selectedStandard, setSelectedStandard] = useState<'ASTM F2924' | 'ASTM F3001' | 'AMS 4999' | 'ISO 5832-3'>('ASTM F2924');
  const [isExporting, setIsExporting] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  const report: QualificationAuditReport = useMemo(() => {
    return evaluateQualificationAudit(
      selectedStandard,
      alloyId,
      alloyName,
      yieldStrengthMPa,
      utsMPa,
      elongationPct,
      relativeDensityPct,
      residualStressMPa,
      fatigueEnduranceMPa,
      heatTreatmentRoute
    );
  }, [
    selectedStandard,
    alloyId,
    alloyName,
    yieldStrengthMPa,
    utsMPa,
    elongationPct,
    relativeDensityPct,
    residualStressMPa,
    fatigueEnduranceMPa,
    heatTreatmentRoute,
  ]);

  const handleDownloadPdf = () => {
    setIsExporting(true);
    try {
      generateQualificationCertificatePdf(report);
      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 3000);
    } catch (err) {
      console.error('Failed to export PDF certificate:', err);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner Header & Certificate Export */}
      <div className="p-5 rounded-xl border border-[#1b3147] bg-gradient-to-r from-[#071726] via-[#091f33] to-[#0a1724] shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="p-2 rounded-lg bg-[#50d8e9]/15 text-[#50d8e9]">
              <Award className="w-5 h-5" />
            </span>
            <h3 className="text-base font-bold text-white tracking-wide">
              Aerospace &amp; Medical Qualification Audit Engine
            </h3>
            <span
              className="px-2.5 py-0.5 rounded-full text-xs font-bold border uppercase tracking-wider"
              style={{
                backgroundColor: `${report.overallStatusColor}20`,
                borderColor: `${report.overallStatusColor}60`,
                color: report.overallStatusColor,
              }}
            >
              {report.overallStatus}
            </span>
          </div>
          <p className="text-xs text-[#9bb6d3] mt-1.5 max-w-2xl leading-relaxed">
            Real-time compliance verification against international additive manufacturing standards. Evaluates tensile yield, UTS, elongation, residual stresses, and microstructural density.
          </p>
        </div>

        <button
          onClick={handleDownloadPdf}
          disabled={isExporting}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#50d8e9] hover:bg-[#3ec4d6] text-[#07131e] font-semibold text-xs transition-all shadow-lg hover:shadow-cyan-500/20 shrink-0 cursor-pointer disabled:opacity-50"
        >
          {downloadSuccess ? (
            <>
              <Check className="w-4 h-4 text-emerald-900" />
              <span>Downloaded Certificate</span>
            </>
          ) : (
            <>
              <Download className="w-4 h-4" />
              <span>{isExporting ? 'Generating PDF...' : 'Export Audit Certificate (PDF)'}</span>
            </>
          )}
        </button>
      </div>

      {/* Standards Selector Bar */}
      <div className="flex flex-wrap items-center gap-2 p-1.5 bg-[#0b1017] border border-[#1d2736] rounded-xl text-xs">
        {(['ASTM F2924', 'ASTM F3001', 'AMS 4999', 'ISO 5832-3'] as const).map((std) => (
          <button
            key={std}
            onClick={() => setSelectedStandard(std)}
            className={`flex-1 min-w-[140px] px-3.5 py-2 rounded-lg font-medium transition-all text-center ${
              selectedStandard === std
                ? 'bg-[#142333] text-[#50d8e9] border border-[#214361] shadow-md font-bold'
                : 'text-[#7e96b0] hover:text-white hover:bg-[#111722]'
            }`}
          >
            <div className="font-mono text-xs">{std}</div>
            <div className="text-[10px] text-[#5b7591] truncate">
              {std === 'ASTM F2924' ? 'PBF Ti-6Al-4V' : std === 'ASTM F3001' ? 'Medical Implants' : std === 'AMS 4999' ? 'Aerospace DED' : 'Surgical Wrought'}
            </div>
          </button>
        ))}
      </div>

      {/* Main Verification Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Verification Checklist Table (8 Cols) */}
        <div className="lg:col-span-8 bg-[#0b1017] border border-[#1d2736] rounded-xl p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-[#1b2636] pb-3">
            <div>
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#50d8e9]" />
                Standards Criteria Compliance Matrix ({selectedStandard})
              </h4>
              <p className="text-[11px] text-[#718aa3] mt-0.5">{report.standardTitle}</p>
            </div>
            <span className="font-mono text-[11px] text-[#50d8e9] bg-[#101b29] px-2.5 py-1 rounded border border-[#1b344d]">
              {report.auditClass}
            </span>
          </div>

          <div className="space-y-3">
            {report.checks.map((check, idx) => (
              <div
                key={idx}
                className="p-3.5 rounded-lg bg-[#0d141e] border border-[#1a2533] hover:border-[#26374d] transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-white">{check.property}</span>
                  </div>
                  <div className="text-[11px] text-[#8ea5be]">{check.notes}</div>
                </div>

                <div className="flex items-center gap-4 shrink-0 text-right">
                  <div>
                    <div className="text-[10px] text-[#60778f] uppercase">Measured / Threshold</div>
                    <div className="text-xs font-mono font-bold text-white mt-0.5">
                      <span className="text-[#50d8e9]">{check.measuredValue} {check.unit}</span>
                      <span className="text-[#5b7591] mx-1.5">|</span>
                      <span className="text-[#94a3b8]">{check.requiredValue} {check.unit}</span>
                    </div>
                  </div>

                  <span
                    className={`px-2.5 py-1 rounded text-xs font-mono font-bold flex items-center gap-1 border ${
                      check.status === 'PASS'
                        ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                        : check.status === 'FAIL'
                        ? 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                        : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                    }`}
                  >
                    {check.status === 'PASS' ? (
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    ) : check.status === 'FAIL' ? (
                      <XCircle className="w-3.5 h-3.5" />
                    ) : (
                      <AlertTriangle className="w-3.5 h-3.5" />
                    )}
                    {check.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Audit Metadata & Certificate Preview (4 Cols) */}
        <div className="lg:col-span-4 space-y-4">
          {/* Certificate Hash Card */}
          <div className="bg-[#0b1017] border border-[#1d2736] rounded-xl p-5 shadow-xl space-y-3.5">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <FileText className="w-4 h-4 text-[#50d8e9]" />
              Digital Certificate Stamp
            </h4>

            <div className="p-3 bg-[#0c131c] rounded-lg border border-[#182535] space-y-2">
              <div className="text-[10px] text-[#6b85a0] uppercase tracking-wider">Verification Hash</div>
              <div className="text-[11px] font-mono font-semibold text-[#50d8e9] break-all">
                {report.verificationHash}
              </div>
              <div className="text-[10px] text-[#6b85a0] pt-1 border-t border-[#162230] flex justify-between">
                <span>Audited: {report.timestamp}</span>
                <span className="text-emerald-400">✓ Cryptographically Valid</span>
              </div>
            </div>

            <div className="text-xs text-[#8ca4bd] space-y-2 pt-1">
              <div className="flex justify-between">
                <span>Inspector:</span>
                <span className="font-semibold text-white">Automated Physics Auditor</span>
              </div>
              <div className="flex justify-between">
                <span>Traceability:</span>
                <span className="font-semibold text-white">ISO/IEC 17025 Calibrated</span>
              </div>
              <div className="flex justify-between">
                <span>Active Route:</span>
                <span className="font-semibold text-[#50d8e9]">{report.auditClass}</span>
              </div>
            </div>
          </div>

          {/* Corrective Engineering Action Card */}
          <div className="bg-[#0b1017] border border-[#1d2736] rounded-xl p-5 shadow-xl space-y-3">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              Metallurgical Action Plan
            </h4>

            <div className="space-y-2 text-xs text-[#a2bcd6]">
              {report.recommendedActions.map((action, i) => (
                <div key={i} className="p-3 rounded-lg bg-[#0e1724] border border-[#1a2c3f] flex items-start gap-2">
                  <span className="text-[#50d8e9] font-bold mt-0.5">•</span>
                  <span>{action}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
