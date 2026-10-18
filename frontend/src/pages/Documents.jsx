import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { api } from '../api';
import {
  UploadCloud,
  FileText,
  Search,
  Eye,
  Download,
  Trash2,
  X,
  FileCheck,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';

export default function Documents() {
  const {
    currentProjectId,
    documentReady,
    documentInfo,
    refreshProjectData,
    addToast,
  } = useApp();

  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedDocId, setExpandedDocId] = useState(null);
  const [docDetails, setDocDetails] = useState({});
  const [loadingDetails, setLoadingDetails] = useState({});
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const canUpload = true;

  // Load documents
  const loadDocuments = useCallback(async () => {
    if (!currentProjectId) return;
    setLoading(true);
    try {
      const data = await api.getDocuments(currentProjectId);
      setDocuments(data || []);
    } catch (err) {
      console.error('Failed to load documents:', err);
      addToast('Failed to load documents: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [currentProjectId, addToast]);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  // Handle Search input & audit log
  const handleSearchChange = (e) => {
    const val = e.target.value;
    setSearchQuery(val);
  };

  // Log search on debounced query
  useEffect(() => {
    if (!searchQuery.trim() || !currentProjectId) return;
    const timer = setTimeout(() => {
      api.logAuditEvent(currentProjectId, {
        event_type: 'SEARCH',
        question: searchQuery.trim(),
        details: { target: 'documents', query: searchQuery.trim() },
      }).catch(() => {});
    }, 600);
    return () => clearTimeout(timer);
  }, [searchQuery, currentProjectId]);

  // Filtered & deduplicated unique documents (keep latest version per filename)
  const uniqueDocuments = useMemo(() => {
    const map = {};
    for (const d of documents) {
      if (!map[d.filename] || d.version > map[d.filename].version) {
        map[d.filename] = d;
      }
    }
    let list = Object.values(map);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((d) => d.filename.toLowerCase().includes(q));
    }
    return list;
  }, [documents, searchQuery]);

  // Handle File Selection
  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.name.toLowerCase().endsWith('.pdf')) {
        addToast('Only PDF files are supported.', 'warning');
        return;
      }
      setSelectedFile(file);
    }
  };

  // Handle Process Document
  const handleProcessDocument = async () => {
    if (!selectedFile || !currentProjectId) return;
    setUploading(true);
    try {
      await api.uploadDocument(currentProjectId, selectedFile);
      addToast(`Document '${selectedFile.name}' processed successfully.`, 'success');
      setSelectedFile(null);
      await Promise.all([loadDocuments(), refreshProjectData()]);
    } catch (err) {
      console.error('Processing failed:', err);
      addToast(`Processing failed: ${err.message}`, 'error');
    } finally {
      setUploading(false);
    }
  };

  // Toggle View Document Details
  const toggleViewDetails = async (docId) => {
    if (expandedDocId === docId) {
      setExpandedDocId(null);
      return;
    }

    setExpandedDocId(docId);
    if (!docDetails[docId]) {
      setLoadingDetails((prev) => ({ ...prev, [docId]: true }));
      try {
        const details = await api.getDocumentDetails(currentProjectId, docId);
        setDocDetails((prev) => ({ ...prev, [docId]: details }));
      } catch (err) {
        console.error('Failed to load document details:', err);
        addToast('Could not load document pages', 'error');
      } finally {
        setLoadingDetails((prev) => ({ ...prev, [docId]: false }));
      }
    }
  };

  // Download Extracted Text
  const handleDownload = async (docId, filename) => {
    try {
      const blob = await api.downloadDocument(currentProjectId, docId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const stem = filename.replace(/\.[^/.]+$/, '');
      a.download = `${stem}_extracted.txt`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      addToast('Extracted text download started', 'info');
    } catch (err) {
      console.error('Download failed:', err);
      addToast(`Download failed: ${err.message}`, 'error');
    }
  };

  // Delete Document
  const handleDelete = async (docId, filename) => {
    setDeletingId(docId);
    try {
      await api.deleteDocument(currentProjectId, docId);
      addToast(`Document '${filename}' deleted.`, 'success');
      setConfirmDeleteId(null);
      if (expandedDocId === docId) {
        setExpandedDocId(null);
      }
      await Promise.all([loadDocuments(), refreshProjectData()]);
    } catch (err) {
      console.error('Delete failed:', err);
      addToast(`Delete failed: ${err.message}`, 'error');
    } finally {
      setDeletingId(null);
    }
  };

  const procSteps = [
    { num: 1, text: 'PDF document ingestion and structural parsing' },
    { num: 2, text: 'Text chunking and diagram OCR extraction' },
    { num: 3, text: 'Vector embeddings generation (Sentence Transformers)' },
    { num: 4, text: 'Deterministic architecture entity recognition' },
    { num: 5, text: 'ChromaDB knowledge base and SQLite persistence' },
  ];

  return (
    <div className="space-y-8 fade-in">
      {/* Header */}
      <div className="pb-2 border-b border-slate-200">
        <h1 className="text-2xl font-bold tracking-tight text-[#0f172a]">Documents & Specifications</h1>
        <p className="text-sm text-slate-500 mt-1">
          Upload, parse, and catalog AUTOSAR architecture specifications for downstream analysis.
        </p>
      </div>

      {/* Two-column layout: Upload on left, Info on right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Upload Zone (7 cols) */}
        <div className="lg:col-span-7 space-y-3">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            Upload PDF Specification
          </div>

          {canUpload ? (
            <div className="bg-white border border-[#e2e8f0] rounded-xl p-6 shadow-xs space-y-4">
              <label
                htmlFor="pdf-upload"
                className="border-2 border-dashed border-slate-200 hover:border-slate-400 rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer transition-colors bg-slate-50/50 hover:bg-slate-50 text-center"
              >
                <UploadCloud className="w-10 h-10 text-slate-700 mb-2" />
                <span className="text-sm font-semibold text-[#0f172a]">
                  Select AUTOSAR PDF Document
                </span>
                <span className="text-xs text-slate-400 mt-1">
                  Drag and drop a PDF file here, or click to browse local files
                </span>
                <input
                  id="pdf-upload"
                  type="file"
                  accept=".pdf"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </label>

              {selectedFile && (
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <FileText className="w-5 h-5 text-slate-700 shrink-0" />
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-[#0f172a] truncate">
                        {selectedFile.name}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {(selectedFile.size / 1024).toFixed(1)} KB
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedFile(null)}
                    className="text-slate-400 hover:text-slate-700 p-1 rounded"
                    aria-label="Remove selected file"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {selectedFile && (
                <button
                  disabled={uploading}
                  onClick={handleProcessDocument}
                  className="w-full h-10 bg-[#0f172a] hover:bg-slate-800 disabled:bg-slate-300 text-white font-semibold rounded-lg text-xs transition-colors flex items-center justify-center gap-2 shadow-xs"
                >
                  {uploading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Processing document...</span>
                    </>
                  ) : (
                    <>
                      <FileCheck className="w-4 h-4" />
                      <span>Process and Ingest Specification</span>
                    </>
                  )}
                </button>
              )}
            </div>
          ) : (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs font-medium text-amber-800">
              You do not have permission to upload documents in this project.
            </div>
          )}
        </div>

        {/* Processing Steps Guide (5 cols) */}
        <div className="lg:col-span-5 space-y-3">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            Ingestion Pipeline Stages
          </div>

          <div className="bg-white border border-[#e2e8f0] rounded-xl p-5 shadow-xs space-y-3">
            {procSteps.map((s, idx) => (
              <div
                key={s.num}
                className={`flex items-center gap-3 pb-2.5 ${
                  idx < procSteps.length - 1 ? 'border-b border-slate-100' : ''
                }`}
              >
                <div className="w-5 h-5 rounded-md bg-slate-900 text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                  {s.num}
                </div>
                <span className="text-xs font-medium text-slate-700">{s.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Uploaded Documents Table Section */}
      <div className="space-y-4 pt-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <h2 className="text-base font-bold text-[#0f172a]">Cataloged Documents</h2>
          {/* Search Bar */}
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
            <input
              type="text"
              aria-label="Filter documents by filename"
              value={searchQuery}
              onChange={handleSearchChange}
              placeholder="Filter by filename..."
              className="w-full h-9 pl-9 pr-3 text-xs bg-white border border-[#e2e8f0] rounded-lg shadow-xs focus:outline-none focus:ring-1 focus:ring-slate-400"
            />
          </div>
        </div>

        {/* Delete Confirmation Alert Modal */}
        {confirmDeleteId && (
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex items-center justify-between gap-4 fade-in">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
              <div className="text-xs text-rose-900">
                Are you sure you want to delete this document? All associated entities and embeddings will be removed.
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setConfirmDeleteId(null)}
                className="px-3 py-1 bg-white border border-rose-200 text-slate-700 text-xs font-semibold rounded-md hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const doc = documents.find((d) => d.document_id === confirmDeleteId);
                  if (doc) handleDelete(doc.document_id, doc.filename);
                }}
                disabled={deletingId === confirmDeleteId}
                className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-md transition-colors"
              >
                {deletingId === confirmDeleteId ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        )}

        {/* Documents Table */}
        {uniqueDocuments.length > 0 ? (
          <div className="bg-white border border-[#e2e8f0] rounded-xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                    <th className="py-3 px-4">Document Name</th>
                    <th className="py-3 px-3">Version</th>
                    <th className="py-3 px-3">Upload Date</th>
                    <th className="py-3 px-3">Pages</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {uniqueDocuments.map((doc, idx) => {
                    const isActive =
                      documentReady &&
                      documentInfo &&
                      documentInfo.filename === doc.filename;
                    const isExpanded = expandedDocId === doc.document_id;
                    const details = docDetails[doc.document_id];
                    const isLoadingDet = loadingDetails[doc.document_id];

                    return (
                      <React.Fragment key={doc.document_id}>
                        <tr
                          className={`hover:bg-slate-50/70 transition-colors ${
                            idx % 2 === 1 ? 'bg-slate-50/30' : 'bg-white'
                          }`}
                        >
                          <td className="py-3 px-4 font-semibold text-[#0f172a]">
                            <div className="flex items-center gap-2">
                              <FileText className="w-4 h-4 text-slate-500 shrink-0" />
                              <span className="truncate max-w-xs" title={doc.filename}>
                                {doc.filename}
                              </span>
                              {isActive && (
                                <span className="bg-slate-900 text-white text-[10px] font-bold px-1.5 py-0.2 rounded shadow-2xs">
                                  ACTIVE
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-3 text-slate-600 font-medium">
                            v{doc.version || 1}
                          </td>
                          <td className="py-3 px-3 text-slate-500">
                            {doc.upload_timestamp ? String(doc.upload_timestamp).substring(0, 10) : 'N/A'}
                          </td>
                          <td className="py-3 px-3 font-semibold text-[#0f172a]">
                            {doc.pages || 'N/A'}
                          </td>
                          <td className="py-3 px-3">
                            <span className="inline-flex items-center gap-1 bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-semibold px-2 py-0.5 rounded">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              Processed
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="inline-flex items-center gap-1">
                              {/* View Details */}
                              <button
                                onClick={() => toggleViewDetails(doc.document_id)}
                                title="View document details"
                                className={`p-1.5 rounded-md border transition-colors ${
                                  isExpanded
                                    ? 'bg-slate-800 text-white border-slate-800'
                                    : 'border-slate-200 text-slate-600 hover:bg-slate-100'
                                }`}
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>

                              {/* Download Text */}
                              <button
                                onClick={() => handleDownload(doc.document_id, doc.filename)}
                                title="Download extracted text"
                                className="p-1.5 rounded-md border border-slate-200 text-slate-600 hover:bg-slate-100 transition-colors"
                              >
                                <Download className="w-3.5 h-3.5" />
                              </button>

                              {/* Delete */}
                              {canUpload && (
                                <button
                                  onClick={() => setConfirmDeleteId(doc.document_id)}
                                  title="Delete document"
                                  className="p-1.5 rounded-md border border-slate-200 text-rose-600 hover:bg-rose-50 transition-colors"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>

                        {/* Inline Document Details Expander */}
                        {isExpanded && (
                          <tr>
                            <td colSpan={6} className="bg-slate-50/80 p-5 border-b border-slate-200">
                              <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs space-y-4">
                                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                                  <div className="text-xs font-bold text-[#0f172a] flex items-center gap-2">
                                    <FileText className="w-4 h-4 text-slate-600" />
                                    <span>{doc.filename} : Document Details</span>
                                  </div>
                                  <button
                                    onClick={() => setExpandedDocId(null)}
                                    className="text-[11px] font-semibold text-slate-500 hover:text-slate-800 px-2.5 py-1 rounded border border-slate-200 hover:bg-slate-50"
                                  >
                                    Close
                                  </button>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2">
                                    <div className="font-semibold text-slate-400 uppercase tracking-wider text-[10px]">
                                      Metadata
                                    </div>
                                    <div>
                                      <span className="text-slate-400">Document ID:</span>
                                      <div className="font-mono text-[11px] text-slate-700 truncate">{doc.document_id}</div>
                                    </div>
                                    <div>
                                      <span className="text-slate-400">Total Pages:</span>
                                      <div className="font-semibold text-slate-800">{doc.pages || 'N/A'}</div>
                                    </div>
                                    <div>
                                      <span className="text-slate-400">Indexed Chunks:</span>
                                      <div className="font-semibold text-slate-800">{doc.chunks || 'N/A'}</div>
                                    </div>
                                  </div>

                                  <div className="md:col-span-2 bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2">
                                    <div className="font-semibold text-slate-400 uppercase tracking-wider text-[10px]">
                                      Page Previews & Extraction Status
                                    </div>
                                    {isLoadingDet ? (
                                      <div className="py-6 text-center text-slate-400">
                                        Loading page excerpts...
                                      </div>
                                    ) : details && details.pages_summary ? (
                                      <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                                        {details.pages_summary.slice(0, 8).map((pg, pIdx) => (
                                          <div key={pIdx} className="bg-white p-2 rounded border border-slate-200 flex justify-between items-center text-[11px]">
                                            <span className="font-semibold text-slate-800">Page {pg.page_number}</span>
                                            <span className="text-slate-500">{pg.char_count || 0} characters extracted</span>
                                          </div>
                                        ))}
                                      </div>
                                    ) : (
                                      <div className="text-slate-500 text-[11px] py-4">
                                        Document processed and indexed into vector store.
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="bg-white border border-[#e2e8f0] rounded-xl p-10 text-center shadow-xs">
            <FileText className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <div className="text-sm font-semibold text-slate-700">No documents cataloged</div>
            <div className="text-xs text-slate-400 mt-1">
              Upload an AUTOSAR specification above to populate this workspace.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
