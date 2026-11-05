import React, { useState } from 'react';
import { X, Download, FileSpreadsheet, FileText, Code2, Check, ArrowRight, ShieldCheck, Layers } from 'lucide-react';
import { MaterialItem, ProcessVariant } from '../data/materialsData';
import { exportAlloyToCsv, exportAlloyToPdf, exportAlloyToJson } from '../utils/alloyExporter';

interface AlloyExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  material: MaterialItem | null;
  activeVariant: ProcessVariant | null;
}

export function AlloyExportModal({
  isOpen,
  onClose,
  material,
  activeVariant,
}: AlloyExportModalProps) {
  const [csvMode, setCsvMode] = useState<'active-route' | 'all-routes'>('all-routes');
  const [isExporting, setIsExporting] = useState<string | null>(null);

  if (!isOpen || !material) return null;

  const currentVariant = activeVariant || material.processRoutes[0];

  const handleDownloadCsv = () => {
    setIsExporting('csv');
    try {
      exportAlloyToCsv(material, currentVariant, csvMode);
    } finally {
      setTimeout(() => setIsExporting(null), 600);
    }
  };

  const handleDownloadPdf = async () => {
    setIsExporting('pdf');
    try {
      await exportAlloyToPdf(material, currentVariant);
    } finally {
      setTimeout(() => setIsExporting(null), 800);
    }
  };

  const handleDownloadJson = () => {
    setIsExporting('json');
    try {
      exportAlloyToJson(material, currentVariant);
    } finally {
      setTimeout(() => setIsExporting(null), 600);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl bg-[#0d0e0f] border border-[#232426] rounded-xl p-6 sm:p-7 shadow-2xl text-[#e5e2e3] inner-glow"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#232426]">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[11px] font-mono-data text-[#50d8e9] uppercase tracking-wider bg-[#50d8e9]/10 border border-[#50d8e9]/25 px-2 py-0.5 rounded">
                Export Options
              </span>
              <span className="text-xs font-mono-data text-[#9A9DA3]">
                {material.standardCode}
              </span>
            </div>
            <h3 className="font-h3 text-xl font-bold text-white tracking-tight">
              Export {material.name} Telemetry
            </h3>
            <p className="text-xs text-[#9A9DA3] mt-0.5">
              Select your preferred export format for calibrated metallurgy, mechanical properties, and AM process routes.
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-[#9A9DA3] hover:text-white border border-[#232426] rounded hover:bg-[#1a1b1d] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Active Route Context Pill */}
        {currentVariant && (
          <div className="my-4 p-3 rounded-lg bg-[#121316] border border-[#232426] flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-[#50d8e9]" />
              <span className="font-mono-data text-[#9A9DA3]">Active Route:</span>
              <span className="font-semibold text-white">{currentVariant.name}</span>
            </div>
            <span className="font-mono-data text-[11px] text-[#bec2ff]">
              {material.processRoutes.length} Total Routes
            </span>
          </div>
        )}

        {/* 3 Main Export Format Cards */}
        <div className="space-y-4 my-5">
          {/* 1. CSV Option */}
          <div className="p-4 rounded-xl border border-[#232426] bg-[#101114] hover:border-[#50d8e9]/60 transition-all">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="p-2.5 rounded-lg bg-[#50d8e9]/10 border border-[#50d8e9]/20 text-[#50d8e9] shrink-0 mt-0.5">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-h4 text-sm font-bold text-white flex items-center gap-2">
                    <span>CSV Spreadsheet</span>
                    <span className="text-[10px] font-mono-data text-[#50d8e9] bg-[#50d8e9]/10 px-1.5 py-0.5 rounded">
                      .csv
                    </span>
                  </h4>
                  <p className="text-xs text-[#9A9DA3] mt-0.5">
                    Tabular export compatible with Excel, Google Sheets, Python Pandas, and MATLAB.
                  </p>

                  {/* CSV Sub-options */}
                  <div className="mt-3 flex flex-wrap gap-2 text-xs font-mono-data">
                    <button
                      type="button"
                      onClick={() => setCsvMode('all-routes')}
                      className={`px-2.5 py-1.5 rounded border transition-colors flex items-center gap-1.5 text-left ${
                        csvMode === 'all-routes'
                          ? 'bg-[#50d8e9]/15 border-[#50d8e9] text-[#50d8e9]'
                          : 'bg-[#16181c] border-[#232426] text-[#9A9DA3] hover:text-white'
                      }`}
                    >
                      {csvMode === 'all-routes' && <Check className="w-3 h-3 text-[#50d8e9]" />}
                      <span>All {material.processRoutes.length} Process Routes Table (Recommended)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setCsvMode('active-route')}
                      className={`px-2.5 py-1.5 rounded border transition-colors flex items-center gap-1.5 text-left ${
                        csvMode === 'active-route'
                          ? 'bg-[#50d8e9]/15 border-[#50d8e9] text-[#50d8e9]'
                          : 'bg-[#16181c] border-[#232426] text-[#9A9DA3] hover:text-white'
                      }`}
                    >
                      {csvMode === 'active-route' && <Check className="w-3 h-3 text-[#50d8e9]" />}
                      <span>Active Route Datasheet ({currentVariant?.shortName || 'Current'})</span>
                    </button>
                  </div>

                  <p className="text-[11px] font-mono-data text-[#50d8e9]/80 mt-2">
                    {csvMode === 'all-routes'
                      ? '✓ Structured Excel/Pandas table: Rows = Routes, Columns = 42 Calibrated Metrics with Units in Header.'
                      : '✓ Key-value datasheet: Categorized rows with separated Value, Unit, and ASTM/ISO standard references.'}
                  </p>
                </div>
              </div>

              <button
                onClick={handleDownloadCsv}
                disabled={isExporting === 'csv'}
                className="px-3.5 py-2 rounded-lg text-xs font-mono-data font-bold bg-[#50d8e9] text-[#070708] hover:bg-[#38bdf8] transition-all flex items-center gap-1.5 shrink-0 shadow-[0_0_15px_rgba(80,216,233,0.25)]"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{isExporting === 'csv' ? 'Exporting...' : 'Download CSV'}</span>
              </button>
            </div>
          </div>

          {/* 2. PDF Option */}
          <div className="p-4 rounded-xl border border-[#232426] bg-[#101114] hover:border-[#ff7961]/60 transition-all">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="p-2.5 rounded-lg bg-[#ff7961]/10 border border-[#ff7961]/20 text-[#ff7961] shrink-0 mt-0.5">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-h4 text-sm font-bold text-white flex items-center gap-2">
                    <span>Engineering Datasheet PDF</span>
                    <span className="text-[10px] font-mono-data text-[#ff7961] bg-[#ff7961]/10 px-1.5 py-0.5 rounded">
                      .pdf
                    </span>
                  </h4>
                  <p className="text-xs text-[#9A9DA3] mt-0.5">
                    Publication-grade multi-page technical report with structured tables for mechanical, thermal, AM precision, and chemical properties.
                  </p>
                  <div className="mt-2 flex items-center gap-3 text-[11px] font-mono-data text-[#9A9DA3]">
                    <span>✓ Printable A4 Format</span>
                    <span>·</span>
                    <span>✓ Complete 42-Metric Telemetry</span>
                  </div>
                </div>
              </div>

              <button
                onClick={handleDownloadPdf}
                disabled={isExporting === 'pdf'}
                className="px-3.5 py-2 rounded-lg text-xs font-mono-data font-bold bg-[#ff7961] text-[#070708] hover:bg-[#ff8f7a] transition-all flex items-center gap-1.5 shrink-0 shadow-[0_0_15px_rgba(255,121,97,0.25)]"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{isExporting === 'pdf' ? 'Generating...' : 'Download PDF'}</span>
              </button>
            </div>
          </div>

          {/* 3. JSON Option */}
          <div className="p-4 rounded-xl border border-[#232426] bg-[#101114] hover:border-[#bec2ff]/60 transition-all">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="p-2.5 rounded-lg bg-[#5E6BFF]/10 border border-[#5E6BFF]/20 text-[#bec2ff] shrink-0 mt-0.5">
                  <Code2 className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-h4 text-sm font-bold text-white flex items-center gap-2">
                    <span>Full JSON Machine Specification</span>
                    <span className="text-[10px] font-mono-data text-[#bec2ff] bg-[#5E6BFF]/10 px-1.5 py-0.5 rounded">
                      .json
                    </span>
                  </h4>
                  <p className="text-xs text-[#9A9DA3] mt-0.5">
                    Complete raw dataset payload including baseline properties and every process step.
                  </p>
                </div>
              </div>

              <button
                onClick={handleDownloadJson}
                disabled={isExporting === 'json'}
                className="px-3.5 py-2 rounded-lg text-xs font-mono-data font-bold bg-[#5E6BFF] text-white hover:bg-[#4d5aec] transition-all flex items-center gap-1.5 shrink-0 shadow-[0_0_15px_rgba(94,107,255,0.25)]"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{isExporting === 'json' ? 'Exporting...' : 'Download JSON'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="pt-3 border-t border-[#232426] flex items-center justify-between text-[11px] font-mono-data text-[#9A9DA3]">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-[#50d8e9]" />
            <span>Strictly verified against 8 authorized ISO/ASTM AM processes</span>
          </div>
          <button
            onClick={onClose}
            className="text-xs text-[#9A9DA3] hover:text-white"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
