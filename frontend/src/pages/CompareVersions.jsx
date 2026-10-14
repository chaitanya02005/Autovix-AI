import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { api } from '../api';
import {
  ArrowLeftRight,
  UploadCloud,
  FileText,
  PlusCircle,
  MinusCircle,
  Download,
  CheckCircle2,
  X
} from 'lucide-react';

export default function CompareVersions() {
  const {
    currentProjectId,
    comparisonResult,
    setComparisonResult,
    addToast,
  } = useApp();

  const [oldFile, setOldFile] = useState(null);
  const [newFile, setNewFile] = useState(null);
  const [comparing, setComparing] = useState(false);

  const handleRunComparison = async () => {
    if (!oldFile || !newFile || !currentProjectId) return;

    setComparing(true);
    try {
      const data = await api.compareFiles(currentProjectId, oldFile, newFile);
      setComparisonResult(data);
      addToast('Comparison completed successfully', 'success');
    } catch (err) {
      console.error('Comparison failed:', err);
      addToast(`Comparison failed: ${err.message}`, 'error');
    } finally {
      setComparing(false);
    }
  };

  const handleDownloadJson = () => {
    if (!comparisonResult) return;
    const jsonStr = JSON.stringify(comparisonResult, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'comparison.json';
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
    addToast('Downloaded comparison.json', 'info');
  };

  const nAdd = comparisonResult?.added?.length || 0;
  const nRem = comparisonResult?.removed?.length || 0;
  const nUnch = comparisonResult?.unchanged?.length || 0;

  return (
    <div className="space-y-8 fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[#0f172a]">
          Compare Documents
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Identify changes, inconsistencies, and new architecture elements between document versions.
        </p>
      </div>

      {/* Upload Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Baseline File */}
        <div className="space-y-2">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Baseline Document
          </div>
          <div className="bg-white border border-[#e2e8f0] rounded-xl p-6 shadow-sm space-y-3">
            <label
              htmlFor="baseline-file-upload"
              className="border-2 border-dashed border-slate-200 hover:border-slate-400 rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer transition-colors bg-slate-50/50 hover:bg-slate-50 text-center"
            >
              <UploadCloud className="w-8 h-8 text-slate-600 mb-2" />
              <span className="text-xs font-semibold text-[#0f172a]">
                Choose Baseline PDF
              </span>
              <span className="text-[11px] text-slate-400 mt-0.5">
                Click or drag baseline document
              </span>
              <input
                id="baseline-file-upload"
                type="file"
                accept=".pdf"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) setOldFile(f);
                }}
                className="hidden"
              />
            </label>

            {oldFile && (
              <div className="bg-slate-100 border border-slate-200 rounded-lg p-2.5 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 truncate">
                  <FileText className="w-4 h-4 text-slate-600 shrink-0" />
                  <span className="font-semibold text-slate-800 truncate">{oldFile.name}</span>
                </div>
                <button
                  onClick={() => setOldFile(null)}
                  className="text-slate-400 hover:text-slate-600 p-0.5"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Current File */}
        <div className="space-y-2">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Current Document
          </div>
          <div className="bg-white border border-[#e2e8f0] rounded-xl p-6 shadow-sm space-y-3">
            <label
              htmlFor="current-file-upload"
              className="border-2 border-dashed border-slate-200 hover:border-slate-400 rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer transition-colors bg-slate-50/50 hover:bg-slate-50 text-center"
            >
              <UploadCloud className="w-8 h-8 text-slate-600 mb-2" />
              <span className="text-xs font-semibold text-[#0f172a]">
                Choose Current PDF
              </span>
              <span className="text-[11px] text-slate-400 mt-0.5">
                Click or drag current document
              </span>
              <input
                id="current-file-upload"
                type="file"
                accept=".pdf"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) setNewFile(f);
                }}
                className="hidden"
              />
            </label>

            {newFile && (
              <div className="bg-slate-100 border border-slate-200 rounded-lg p-2.5 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 truncate">
                  <FileText className="w-4 h-4 text-slate-600 shrink-0" />
                  <span className="font-semibold text-slate-800 truncate">{newFile.name}</span>
                </div>
                <button
                  onClick={() => setNewFile(null)}
                  className="text-slate-400 hover:text-slate-600 p-0.5"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Action Button */}
      {oldFile && newFile && (
        <div>
          <button
            disabled={comparing}
            onClick={handleRunComparison}
            className="px-6 h-11 bg-[#1e293b] hover:bg-slate-900 disabled:bg-slate-400 text-white font-semibold rounded-lg text-sm transition-colors inline-flex items-center gap-2 shadow-sm"
          >
            {comparing ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Analyzing differences…</span>
              </>
            ) : (
              <>
                <ArrowLeftRight className="w-4 h-4" />
                <span>Run Comparison</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Comparison Results */}
      {comparisonResult && (
        <div className="space-y-6 pt-2 fade-in">
          {/* Summary Stat Cards */}
          <div className="space-y-3">
            <h2 className="text-base font-semibold text-[#0f172a]">Comparison Summary</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              <div className="bg-white border border-[#e2e8f0] border-t-2 border-t-[#111111] rounded-xl p-5 shadow-sm">
                <div className="text-3xl font-bold text-[#333333]">{nAdd}</div>
                <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mt-1">
                  Added Elements
                </div>
              </div>

              <div className="bg-white border border-[#e2e8f0] border-t-2 border-t-[#555555] rounded-xl p-5 shadow-sm">
                <div className="text-3xl font-bold text-[#555555]">{nRem}</div>
                <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mt-1">
                  Removed Elements
                </div>
              </div>

              <div className="bg-white border border-[#e2e8f0] border-t-2 border-t-[#CCCCCC] rounded-xl p-5 shadow-sm">
                <div className="text-3xl font-bold text-[#0f172a]">{nUnch}</div>
                <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mt-1">
                  Unchanged Elements
                </div>
              </div>
            </div>
          </div>

          {/* Detailed Changes Table */}
          <div className="space-y-3">
            <h2 className="text-base font-semibold text-[#0f172a]">Detailed Changes</h2>

            {nAdd > 0 || nRem > 0 ? (
              <div className="bg-white border border-[#e2e8f0] rounded-xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm border-collapse">
                    <thead>
                      <tr className="bg-[#F6F6F6] border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                        <th className="py-3 px-4 w-32">Status</th>
                        <th className="py-3 px-4">Entity</th>
                        <th className="py-3 px-4">Type</th>
                        <th className="py-3 px-4 text-center">Page</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {comparisonResult.added?.map((item, idx) => (
                        <tr key={`add-${idx}`} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3.5 px-4">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-emerald-50 text-emerald-800 text-xs font-semibold">
                              <PlusCircle className="w-3.5 h-3.5 text-emerald-600" />
                              Added
                            </span>
                          </td>
                          <td className="py-3.5 px-4 font-semibold text-[#0f172a]">
                            {item.entity}
                          </td>
                          <td className="py-3.5 px-4 text-slate-500 text-xs">{item.type}</td>
                          <td className="py-3.5 px-4 text-center text-xs text-slate-500 font-medium">
                            p.{item.new_page ?? '—'}
                          </td>
                        </tr>
                      ))}

                      {comparisonResult.removed?.map((item, idx) => (
                        <tr key={`rem-${idx}`} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3.5 px-4">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-rose-50 text-rose-800 text-xs font-semibold">
                              <MinusCircle className="w-3.5 h-3.5 text-rose-600" />
                              Removed
                            </span>
                          </td>
                          <td className="py-3.5 px-4 font-semibold text-[#0f172a]">
                            {item.entity}
                          </td>
                          <td className="py-3.5 px-4 text-slate-500 text-xs">{item.type}</td>
                          <td className="py-3.5 px-4 text-center text-xs text-slate-500 font-medium">
                            p.{item.old_page ?? '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="bg-white border border-[#e2e8f0] rounded-xl p-10 text-center shadow-sm">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                <div className="text-sm font-semibold text-slate-700">No differences found</div>
                <div className="text-xs text-slate-400 mt-1">
                  Both documents contain identical architecture entities.
                </div>
              </div>
            )}

            {/* Download Button */}
            <div>
              <button
                onClick={handleDownloadJson}
                className="px-4 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg transition-colors inline-flex items-center gap-2 shadow-xs"
              >
                <Download className="w-3.5 h-3.5 text-slate-500" />
                <span>Download Comparison JSON</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
