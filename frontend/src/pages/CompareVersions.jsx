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
    documents,
    comparisonResult,
    setComparisonResult,
    setSelectedTab,
    addToast,
  } = useApp();

  const [oldFile, setOldFile] = useState(null);
  const [newFile, setNewFile] = useState(null);
  const [comparing, setComparing] = useState(false);
  const [baselineDocumentId, setBaselineDocumentId] = useState('');
  const [currentDocumentId, setCurrentDocumentId] = useState('');
  const [exportError, setExportError] = useState('');

  React.useEffect(() => {
    if (!baselineDocumentId && documents.length > 1) setBaselineDocumentId(documents[1].document_id);
    if (!currentDocumentId && documents.length > 0) setCurrentDocumentId(documents[0].document_id);
  }, [documents, baselineDocumentId, currentDocumentId]);

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

  const handleDownloadJson = async () => {
    if (!baselineDocumentId || !currentDocumentId || baselineDocumentId === currentDocumentId) return;
    setExportError('');
    try {
      const payload = await api.exportData(currentProjectId, 'comparison', 'json', {
        baseline_document_id: baselineDocumentId,
        current_document_id: currentDocumentId,
      });
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'signed_off_comparison.json';
      anchor.click();
      window.URL.revokeObjectURL(url);
      addToast('Downloaded signed-off comparison.', 'success');
    } catch (error) {
      if (error.status === 409) setExportError(error.message);
      addToast(`Export failed: ${error.message}`, 'error');
    }
  };

  const nAdd = comparisonResult?.added?.length || 0;
  const nRem = comparisonResult?.removed?.length || 0;
  const nUnch = comparisonResult?.unchanged?.length || 0;

  return (
    <div className="space-y-8 fade-in">
      {/* Header */}
      <div className="pb-2 border-b border-slate-200">
        <h1 className="text-2xl font-bold tracking-tight text-[#0f172a]">
          Compare Specification Versions
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Detect structural drift, added interfaces, removed components, and architectural delta across revisions.
        </p>
      </div>

      {/* Upload Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Baseline File */}
        <div className="space-y-2">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            Baseline Specification (Previous Version)
          </div>
          <div className="bg-white border border-[#e2e8f0] rounded-xl p-6 shadow-xs space-y-3">
            <label
              htmlFor="baseline-file-upload"
              className="border-2 border-dashed border-slate-200 hover:border-slate-400 rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer transition-colors bg-slate-50/50 hover:bg-slate-50 text-center"
            >
              <UploadCloud className="w-8 h-8 text-slate-600 mb-2" />
              <span className="text-xs font-semibold text-[#0f172a]">
                Select Baseline PDF
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
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 truncate">
                  <FileText className="w-4 h-4 text-slate-600 shrink-0" />
                  <span className="font-semibold text-slate-800 truncate">{oldFile.name}</span>
                </div>
                <button
                  onClick={() => setOldFile(null)}
                  className="text-slate-400 hover:text-slate-700 p-0.5"
                  aria-label="Remove baseline file"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Current File */}
        <div className="space-y-2">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            Current Specification (New Version)
          </div>
          <div className="bg-white border border-[#e2e8f0] rounded-xl p-6 shadow-xs space-y-3">
            <label
              htmlFor="current-file-upload"
              className="border-2 border-dashed border-slate-200 hover:border-slate-400 rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer transition-colors bg-slate-50/50 hover:bg-slate-50 text-center"
            >
              <UploadCloud className="w-8 h-8 text-slate-600 mb-2" />
              <span className="text-xs font-semibold text-[#0f172a]">
                Select Current PDF
              </span>
              <span className="text-[11px] text-slate-400 mt-0.5">
                Click or drag revised document
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
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 truncate">
                  <FileText className="w-4 h-4 text-slate-600 shrink-0" />
                  <span className="font-semibold text-slate-800 truncate">{newFile.name}</span>
                </div>
                <button
                  onClick={() => setNewFile(null)}
                  className="text-slate-400 hover:text-slate-700 p-0.5"
                  aria-label="Remove current file"
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
            className="px-5 h-10 bg-[#0f172a] hover:bg-slate-800 disabled:bg-slate-300 text-white font-semibold rounded-lg text-xs transition-colors inline-flex items-center gap-2 shadow-xs"
          >
            {comparing ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Extracting and comparing architectural delta...</span>
              </>
            ) : (
              <>
                <ArrowLeftRight className="w-3.5 h-3.5" />
                <span>Run Version Comparison</span>
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
            <h2 className="text-sm font-bold text-[#0f172a] uppercase tracking-wider text-slate-500">
              Architectural Delta Summary
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              <div className="bg-white border border-emerald-200 rounded-xl p-5 shadow-xs">
                <div className="text-2xl font-bold text-emerald-800">{nAdd}</div>
                <div className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wider mt-1">
                  Added Architecture Elements
                </div>
              </div>

              <div className="bg-white border border-rose-200 rounded-xl p-5 shadow-xs">
                <div className="text-2xl font-bold text-rose-800">{nRem}</div>
                <div className="text-[11px] font-semibold text-rose-700 uppercase tracking-wider mt-1">
                  Removed Architecture Elements
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
                <div className="text-2xl font-bold text-slate-900">{nUnch}</div>
                <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mt-1">
                  Unchanged Entities
                </div>
              </div>
            </div>
          </div>

          {/* Detailed Changes Table */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-[#0f172a]">Detailed Architecture Changes</h2>
            </div>
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white p-3">
              <span className="text-[11px] text-slate-500">Ad-hoc file comparisons are for analysis. Export requires stored, signed-off document versions.</span>
              <select value={baselineDocumentId} onChange={(event) => setBaselineDocumentId(event.target.value)} className="h-8 rounded-md border border-slate-200 px-2 text-xs">
                <option value="">Baseline document</option>{documents.map((document) => <option key={document.document_id} value={document.document_id}>{document.filename} · v{document.version}</option>)}
              </select>
              <select value={currentDocumentId} onChange={(event) => setCurrentDocumentId(event.target.value)} className="h-8 rounded-md border border-slate-200 px-2 text-xs">
                <option value="">Current document</option>{documents.map((document) => <option key={document.document_id} value={document.document_id}>{document.filename} · v{document.version}</option>)}
              </select>
              <button
                onClick={handleDownloadJson}
                disabled={!baselineDocumentId || !currentDocumentId || baselineDocumentId === currentDocumentId}
                className="px-3 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg transition-colors inline-flex items-center gap-1.5 shadow-xs disabled:opacity-40"
              >
                <Download className="w-3.5 h-3.5 text-slate-500" />
                <span>Export signed-off JSON</span>
              </button>
              {exportError && <div role="alert" className="w-full text-xs text-rose-700">{exportError} <button onClick={() => setSelectedTab('Review Queue')} className="font-semibold underline">Open Review Queue</button></div>}
            </div>

            {nAdd > 0 || nRem > 0 ? (
              <div className="bg-white border border-[#e2e8f0] rounded-xl overflow-hidden shadow-xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                        <th className="py-3 px-4 w-32">Delta Type</th>
                        <th className="py-3 px-4">Entity Name</th>
                        <th className="py-3 px-4">Entity Type</th>
                        <th className="py-3 px-4 text-center">Source Page</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {comparisonResult.added?.map((item, idx) => (
                        <tr key={`add-${idx}`} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3 px-4">
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 text-[11px] font-semibold border border-emerald-200">
                              <PlusCircle className="w-3 h-3 text-emerald-600" />
                              Added
                            </span>
                          </td>
                          <td className="py-3 px-4 font-semibold text-[#0f172a]">
                            {item.entity}
                          </td>
                          <td className="py-3 px-4 text-slate-600">{item.type}</td>
                          <td className="py-3 px-4 text-center text-slate-500 font-medium">
                            p.{item.new_page ?? 'N/A'}
                          </td>
                        </tr>
                      ))}

                      {comparisonResult.removed?.map((item, idx) => (
                        <tr key={`rem-${idx}`} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3 px-4">
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-rose-50 text-rose-800 text-[11px] font-semibold border border-rose-200">
                              <MinusCircle className="w-3 h-3 text-rose-600" />
                              Removed
                            </span>
                          </td>
                          <td className="py-3 px-4 font-semibold text-[#0f172a]">
                            {item.entity}
                          </td>
                          <td className="py-3 px-4 text-slate-600">{item.type}</td>
                          <td className="py-3 px-4 text-center text-slate-500 font-medium">
                            p.{item.old_page ?? 'N/A'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="bg-white border border-[#e2e8f0] rounded-xl p-10 text-center shadow-xs">
                <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
                <div className="text-sm font-semibold text-slate-800">No architectural differences detected</div>
                <div className="text-xs text-slate-500 mt-1">
                  Both specifications define identical components, interfaces, and architecture entities.
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
