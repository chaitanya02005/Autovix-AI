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
  AlertTriangle,
  X,
  FileCheck,
  Check
} from 'lucide-react';

export default function Documents() {
  const {
    currentProjectId,
    currentRole,
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
      addToast('Failed to load documents', 'error');
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
      addToast(`✅ '${selectedFile.name}' processed successfully!`, 'success');
      setSelectedFile(null);
      await Promise.all([loadDocuments(), refreshProjectData()]);
    } catch (err) {
      console.error('Processing failed:', err);
      addToast(`❌ Processing failed: ${err.message}`, 'error');
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
      addToast('Download started', 'info');
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
      addToast(`'${filename}' deleted.`, 'success');
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
    { num: 1, color: 'bg-[#222222]', text: 'Upload PDF' },
    { num: 2, color: 'bg-[#444444]', text: 'Extract content from PDF' },
    { num: 3, color: 'bg-[#666666]', text: 'Generate embeddings' },
    { num: 4, color: 'bg-[#888888]', text: 'Extract architecture entities' },
    { num: 5, color: 'bg-[#AAAAAA]', text: 'Build knowledge base' },
  ];

  return (
    <div className="space-y-8 fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[#0f172a]">Documents</h1>
        <p className="text-sm text-slate-500 mt-1">
          Upload, process and manage your architecture documents
        </p>
      </div>

      {/* Two-column layout: Upload on left, Info on right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Upload Zone (7 cols) */}
        <div className="lg:col-span-7 space-y-3">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Upload Document
          </div>

          {canUpload ? (
            <div className="bg-white border border-[#e2e8f0] rounded-xl p-6 shadow-sm space-y-4">
              <label
                htmlFor="pdf-upload"
                className="border-2 border-dashed border-slate-200 hover:border-slate-400 rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer transition-colors bg-slate-50/50 hover:bg-slate-50 text-center"
              >
                <UploadCloud className="w-10 h-10 text-slate-700 mb-2" />
                <span className="text-sm font-semibold text-[#0f172a]">
                  Upload PDF Document
                </span>
                <span className="text-xs text-slate-400 mt-1">
                  Drag and drop your PDF file here, or click to browse
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
                <div className="bg-slate-100 border border-slate-200 rounded-lg p-3 flex items-center justify-between gap-3">
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
                    className="text-slate-400 hover:text-slate-600 p-1"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {selectedFile && (
                <button
                  disabled={uploading}
                  onClick={handleProcessDocument}
                  className="w-full h-11 bg-[#1e293b] hover:bg-slate-900 disabled:bg-slate-400 text-white font-semibold rounded-lg text-sm transition-colors flex items-center justify-center gap-2 shadow-sm"
                >
                  {uploading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Processing document…</span>
                    </>
                  ) : (
                    <>
                      <FileCheck className="w-4 h-4" />
                      <span>⚙ Process Document</span>
                    </>
                  )}
                </button>
              )}
            </div>
          ) : (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs font-medium text-amber-800">
              You don't have permission to upload documents in this project.
            </div>
          )}
        </div>

        {/* Processing Steps Guide (5 cols) */}
        <div className="lg:col-span-5 space-y-3">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Processing Steps
          </div>

          <div className="bg-white border border-[#e2e8f0] rounded-xl p-6 shadow-sm space-y-4">
            {procSteps.map((s, idx) => (
              <div
                key={s.num}
                className={`flex items-center gap-3.5 pb-3 ${
                  idx < procSteps.length - 1 ? 'border-b border-slate-100' : ''
                }`}
              >
                <div
                  className={`w-6 h-6 rounded-full text-white text-[11px] font-bold flex items-center justify-center shrink-0 ${s.color}`}
                >
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
        <h2 className="text-base font-semibold text-[#0f172a]">Uploaded Documents</h2>

        {/* Search Bar */}
        <div className="relative max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={handleSearchChange}
            placeholder="Search documents by filename…"
            className="w-full h-10 pl-10 pr-4 text-sm bg-white border border-[#e2e8f0] rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-300 transition-shadow"
          />
        </div>

        {/* Documents Table */}
        {uniqueDocuments.length > 0 ? (
          <div className="bg-white border border-[#e2e8f0] rounded-xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="bg-[#F6F6F6] border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
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
                    const isConfirmingDelete = confirmDeleteId === doc.document_id;
                    const details = docDetails[doc.document_id];
                    const isLoadingDet = loadingDetails[doc.document_id];

                    return (
                      <React.Fragment key={doc.document_id}>
                        <tr
                          className={`hover:bg-slate-50/70 transition-colors ${
                            idx % 2 === 1 ? 'bg-[#FAFAFA]' : 'bg-white'
                          }`}
                        >
                          <td className="py-3.5 px-4 font-semibold text-[#0f172a]">
                            <div className="flex items-center gap-2.5">
                              <FileText className="w-4 h-4 text-slate-500 shrink-0" />
                              <span className="truncate max-w-[280px]" title={doc.filename}>
                                {doc.filename}
                              </span>
                              {isActive && (
                                <span className="bg-[#EBEBEB] text-[#111] text-[10px] font-bold px-1.5 py-0.5 rounded shadow-xs">
                                  ACTIVE
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3.5 px-3 text-slate-600 font-medium">
                            {doc.version || 1}
                          </td>
                          <td className="py-3.5 px-3 text-slate-500 text-xs font-medium">
                            {String(doc.upload_timestamp || '—').substring(0, 10)}
                          </td>
                          <td className="py-3.5 px-3 font-semibold text-[#0f172a]">
                            {doc.pages || '—'}
                          </td>
                          <td className="py-3.5 px-3">
                            <span className="bg-slate-100 text-slate-800 text-xs font-semibold px-2.5 py-1 rounded-full">
                              Processed
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <div className="inline-flex items-center gap-1">
                              {/* View Details */}
                              <button
                                onClick={() => toggleViewDetails(doc.document_id)}
                                title="View document details"
                                className={`p-1.5 rounded-lg border transition-colors ${
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
                                className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 transition-colors"
                              >
                                <Download className="w-3.5 h-3.5" />
                              </button>

                              {/* Delete */}
                              {canUpload && (
                                <button
                                  onClick={() => setConfirmDeleteId(doc.document_id)}
                                  title="Delete document"
                                  className="p-1.5 rounded-lg border border-slate-200 text-rose-600 hover:bg-rose-50 transition-colors"
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
                            <td colSpan={6} className="bg-slate-50 p-6 border-b border-slate-200">
                              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
                                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                                  <div className="text-sm font-bold text-[#0f172a] flex items-center gap-2">
                                    <FileText className="w-4 h-4 text-slate-600" />
                                    <span>{doc.filename} — Document Details</span>
                                  </div>
                                  <button
                                    onClick={() => setExpandedDocId(null)}
                                    className="text-xs font-semibold text-slate-500 hover:text-slate-800 px-2.5 py-1 rounded border border-slate-200 hover:bg-slate-50"
                                  >
                                    Close
                                  </button>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                  {/* Info Column */}
                                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs space-y-3">
                                    <div className="font-semibold text-slate-400 uppercase tracking-wider text-[10px]">
                                      Document Info
                                    </div>
                                    <div>
                                      <span className="text-slate-400">Filename:</span>
                                      <div className="font-semibold text-slate-800">{doc.filename}</div>
                                    </div>
                                    <div>
                                      <span className="text-slate-400">Version:</span>
                                      <div className="font-semibold text-slate-800">{doc.version || 1}</div>
                                    </div>
                                    <div>
                                      <span className="text-slate-400">Pages:</span>
                                      <div className="font-semibold text-slate-800">{doc.pages || 0}</div>
                                    </div>
                                    <div>
                                      <span className="text-slate-400">Uploaded:</span>
                                      <div className="font-semibold text-slate-800">
                                        {String(doc.upload_timestamp || '—').substring(0, 10)}
                                      </div>
                                    </div>
                                    <div>
                                      <span className="text-slate-400">Status:</span>
                                      <div className="font-semibold text-emerald-700">Processed</div>
                                    </div>
                                  </div>

                                  {/* Extracted Content Column */}
                                  <div className="md:col-span-2 space-y-3">
                                    <div className="font-semibold text-slate-400 uppercase tracking-wider text-[10px]">
                                      Extracted Content (First 5 pages)
                                    </div>
                                    {isLoadingDet ? (
                                      <div className="text-xs text-slate-400 py-6 text-center">
                                        Loading extracted pages…
                                      </div>
                                    ) : details?.extracted_pages && details.extracted_pages.length > 0 ? (
                                      <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                                        {details.extracted_pages.slice(0, 5).map((page) => (
                                          <div
                                            key={page.page_number}
                                            className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs"
                                          >
                                            <div className="font-bold text-slate-700 mb-1">
                                              Page {page.page_number}
                                            </div>
                                            <div className="text-slate-600 font-mono text-[11px] whitespace-pre-wrap line-clamp-4">
                                              {page.text?.trim() || '(No text)'}
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    ) : (
                                      <div className="text-xs text-slate-400 py-4 text-center">
                                        Page content not available.
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}

                        {/* Confirmation Banner for Delete */}
                        {isConfirmingDelete && (
                          <tr>
                            <td colSpan={6} className="bg-amber-50 p-4 border-b border-amber-200">
                              <div className="flex items-center justify-between gap-4">
                                <div className="flex items-center gap-2 text-xs font-medium text-amber-900">
                                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                                  <span>
                                    <strong>Delete '{doc.filename}'?</strong> This will permanently remove the document and all extracted data.
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <button
                                    disabled={deletingId === doc.document_id}
                                    onClick={() => handleDelete(doc.document_id, doc.filename)}
                                    className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-1 shadow-xs"
                                  >
                                    <Check className="w-3.5 h-3.5" />
                                    <span>Confirm</span>
                                  </button>
                                  <button
                                    onClick={() => setConfirmDeleteId(null)}
                                    className="px-3 py-1.5 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-lg text-xs font-semibold transition-colors"
                                  >
                                    Cancel
                                  </button>
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
          <div className="bg-white border border-[#e2e8f0] rounded-xl p-12 text-center shadow-sm">
            <FileText className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <div className="text-sm font-semibold text-slate-700">No documents yet</div>
            <div className="text-xs text-slate-400 mt-1">
              Upload a PDF document above to get started with your analysis.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
