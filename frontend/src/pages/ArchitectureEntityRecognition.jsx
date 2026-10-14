import React, { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api';
import { useApp } from '../context/AppContext';
import { Download, FileSearch, Search, ExternalLink, Network, CheckCircle2 } from 'lucide-react';

const types = ['All types', 'Software Component', 'Port', 'Interface', 'Service', 'Data Element', 'Data Type', 'Operation', 'Event', 'Architecture Concept'];

export default function ArchitectureEntityRecognition() {
  const { currentProjectId, documents, addToast } = useApp();
  const [documentId, setDocumentId] = useState('');
  const [result, setResult] = useState(null);
  const [selected, setSelected] = useState(null);
  const [running, setRunning] = useState(false);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('All types');
  const [pageFilter, setPageFilter] = useState('');
  const detailRequest = useRef(0);

  useEffect(() => {
    setResult(null);
    setSelected(null);
    detailRequest.current += 1;
    setSearch('');
    setTypeFilter('All types');
    setPageFilter('');
    const first = documents[0]?.document_id || '';
    setDocumentId(first);
  }, [currentProjectId, documents]);

  const chosenDocument = documents.find((doc) => doc.document_id === documentId);
  const entities = result?.entities || [];
  const filtered = useMemo(() => entities.filter((entity) => {
    const matchesSearch = !search.trim() || entity.name.toLowerCase().includes(search.trim().toLowerCase());
    const matchesType = typeFilter === 'All types' || entity.entity_type === typeFilter;
    const matchesPage = !pageFilter || entity.source_pages?.includes(Number(pageFilter));
    return matchesSearch && matchesType && matchesPage;
  }), [entities, search, typeFilter, pageFilter]);

  const summary = useMemo(() => entities.reduce((counts, entity) => {
    counts[entity.entity_type] = (counts[entity.entity_type] || 0) + 1;
    return counts;
  }, {}), [entities]);

  const runRecognition = async (forceArg = false) => {
    const force = forceArg === true;
    if (!currentProjectId || !documentId) return;
    setRunning(true);
    setSelected(null);
    try {
      const data = await api.recognizeDocumentEntities(currentProjectId, documentId, chosenDocument?.version, { force });
      setResult(data);
      addToast(data.count ? `Recognition complete: ${data.count} entities identified.` : 'Recognition complete: no supported entities found.', data.count ? 'success' : 'info');
    } catch (error) {
      setResult({ status: 'failed', entities: [], count: 0, warnings: [{ message: error.message }] });
      addToast(`Recognition failed: ${error.message}`, 'error');
    } finally {
      setRunning(false);
    }
  };

  const selectEntity = async (entity) => {
    const requestId = ++detailRequest.current;
    setSelected(entity);
    try {
      const detail = await api.getDocumentEntity(currentProjectId, documentId, entity.entity_id);
      if (requestId === detailRequest.current) setSelected(detail);
    } catch (error) {
      addToast(`Could not load entity details: ${error.message}`, 'error');
    }
  };

  const download = async (format) => {
    try {
      const blob = await api.exportDocumentEntities(currentProjectId, documentId, format);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `entities_v${chosenDocument?.version || 1}.${format}`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      addToast(`Export failed: ${error.message}`, 'error');
    }
  };

  const statusText = {
    not_processed: 'Select a document and run entity recognition.',
    no_entities_found: 'No supported architecture entities found in this document.',
    completed: `Recognition completed. ${result?.count ?? entities.length} entities found.`,
    completed_with_warnings: result?.count
      ? `Recognition completed. ${result.count} entities found.`
      : 'No supported architecture entities found in this document.',
    failed: 'Entity recognition failed. Please verify document formatting and try again.',
  }[result?.status];

  return (
    <div className="space-y-6 fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#0f172a]">Architecture Entity Recognition</h1>
          <p className="mt-1 text-sm text-slate-500">
            Identify, catalog, and trace explicitly named AUTOSAR components, interfaces, and ports to exact source pages.
          </p>
        </div>
        {result?.status?.startsWith('completed') && (
          <div className="flex gap-2">
            <button
              onClick={() => download('csv')}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-xs"
            >
              <Download className="h-3.5 w-3.5 text-slate-500" />
              <span>Export CSV</span>
            </button>
            <button
              onClick={() => download('json')}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-xs"
            >
              <Download className="h-3.5 w-3.5 text-slate-500" />
              <span>Export JSON</span>
            </button>
          </div>
        )}
      </div>

      {/* Document Selection and Action Card */}
      <section className="grid gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-xs md:grid-cols-[1fr_auto] md:items-end">
        <label className="block text-xs font-semibold text-slate-500">
          Target Document Specification
          <select
            value={documentId}
            onChange={(event) => {
              setResult(null);
              setSelected(null);
              detailRequest.current += 1;
              setDocumentId(event.target.value);
            }}
            className="mt-2 block h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-800 outline-none focus:ring-1 focus:ring-slate-400 cursor-pointer"
          >
            {documents.map((doc) => (
              <option key={doc.document_id} value={doc.document_id}>
                {doc.filename} (v{doc.version || 1})
              </option>
            ))}
          </select>
        </label>
        <div className="flex gap-2">
          <button
            disabled={!documentId || running}
            onClick={() => runRecognition(false)}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#0f172a] px-4 text-xs font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300 transition-colors shadow-xs"
          >
            {running ? (
              <>
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                <span>Extracting Entities...</span>
              </>
            ) : (
              <>
                <FileSearch className="h-3.5 w-3.5" />
                <span>Run Recognition</span>
              </>
            )}
          </button>
          {['completed', 'completed_with_warnings', 'no_entities_found'].includes(result?.status) && (
            <button
              disabled={!documentId || running}
              onClick={() => runRecognition(true)}
              className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors"
            >
              Rebuild
            </button>
          )}
        </div>
        {chosenDocument && (
          <p className="text-[11px] text-slate-400 md:col-span-2">
            Document metadata: {chosenDocument.pages} pages indexed, version {chosenDocument.version || 1}
          </p>
        )}
      </section>

      {!documents.length && (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-xs text-slate-500 shadow-xs">
          No documents available in this project workspace. Upload a specification in the Documents tab first.
        </div>
      )}

      {chosenDocument && !result && !running && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-center text-xs text-slate-500 shadow-xs">
          Select an uploaded document above and click "Run Recognition" to extract architecture entities.
        </div>
      )}

      {result && (
        <>
          <div
            className={`rounded-xl border p-4 text-xs ${
              result.status === 'failed'
                ? 'border-rose-200 bg-rose-50 text-rose-800'
                : result.status === 'completed_with_warnings'
                ? 'border-amber-200 bg-amber-50 text-amber-900'
                : 'border-slate-200 bg-white text-slate-700'
            }`}
          >
            <div className="font-semibold">{statusText}</div>
            {result.cached && (
              <div className="mt-1 text-[11px] opacity-75">Using verified cached results for this document version.</div>
            )}
            {(result.warnings || []).map((warning, index) => (
              <div key={index} className="mt-1 text-[11px] opacity-80">
                {warning.message.replace(/ OCR could not run because Tesseract or its Python dependencies are unavailable\./, '')}
                {warning.pages?.length ? ` (Pages: ${warning.pages.join(', ')})` : ''}
              </div>
            ))}
          </div>

          {result.status !== 'not_processed' && result.status !== 'failed' && (
            <>
              {/* Entity Breakdown Stats */}
              <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                {[
                  ['Total Entities', entities.length],
                  ['Components', summary['Software Component'] || 0],
                  ['Ports', summary.Port || 0],
                  ['Interfaces', summary.Interface || 0],
                  ['Other Concepts', entities.length - (summary['Software Component'] || 0) - (summary.Port || 0) - (summary.Interface || 0)],
                ].map(([label, count]) => (
                  <div key={label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
                    <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">{label}</div>
                    <div className="mt-1 text-2xl font-bold text-slate-900">{count}</div>
                  </div>
                ))}
              </section>

              {/* Master / Detail Split */}
              <section className="grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(300px,.9fr)]">
                {/* Entities List */}
                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
                  <div className="grid gap-2 border-b border-slate-100 p-3 sm:grid-cols-[1fr_160px_90px]">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                      <input
                        aria-label="Search entities"
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder="Search entities..."
                        className="h-8 w-full rounded-md border border-slate-200 pl-8 pr-2 text-xs outline-none focus:ring-1 focus:ring-slate-400"
                      />
                    </div>
                    <select
                      aria-label="Filter by entity type"
                      value={typeFilter}
                      onChange={(event) => setTypeFilter(event.target.value)}
                      className="h-8 rounded-md border border-slate-200 px-2 text-xs text-slate-700 cursor-pointer"
                    >
                      {types.map((type) => (
                        <option key={type}>{type}</option>
                      ))}
                    </select>
                    <input
                      aria-label="Filter by source page"
                      type="number"
                      min="1"
                      value={pageFilter}
                      onChange={(event) => setPageFilter(event.target.value)}
                      placeholder="Page #"
                      className="h-8 rounded-md border border-slate-200 px-2 text-xs"
                    />
                  </div>

                  <div className="max-h-[520px] overflow-auto divide-y divide-slate-100">
                    {!filtered.length ? (
                      <div className="p-8 text-center text-xs text-slate-500">
                        No entities match the selected filter criteria.
                      </div>
                    ) : (
                      filtered.map((entity) => (
                        <button
                          key={entity.entity_id}
                          onClick={() => selectEntity(entity)}
                          className={`grid w-full grid-cols-[1fr_auto] gap-2 p-3 text-left hover:bg-slate-50 transition-colors ${
                            selected?.entity_id === entity.entity_id ? 'bg-slate-100/70 border-l-2 border-slate-900' : ''
                          }`}
                        >
                          <span className="min-w-0">
                            <span className="block truncate text-xs font-semibold text-slate-900">{entity.name}</span>
                            <span className="mt-0.5 block text-[11px] text-slate-500">
                              {entity.entity_type} {entity.source_pages?.length ? `: p. ${entity.source_pages.join(', ')}` : ''}
                            </span>
                          </span>
                          <span className="self-center rounded bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600 border border-slate-200">
                            {entity.review_status}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                </div>

                {/* Evidence & Details Inspector */}
                <div className="min-h-[300px] rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
                  {!selected ? (
                    <div className="flex h-full min-h-[240px] flex-col items-center justify-center text-center text-xs text-slate-400">
                      <FileSearch className="mb-2 h-7 w-7 text-slate-300" />
                      Select an architecture entity to inspect its source page evidence.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-100">
                        <div>
                          <h2 className="text-base font-bold text-slate-900">{selected.name}</h2>
                          <div className="text-xs text-slate-500">{selected.entity_type}</div>
                        </div>
                        <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700 border border-slate-200">
                          {selected.review_status}
                        </span>
                      </div>

                      <dl className="grid grid-cols-2 gap-3 text-xs">
                        <div>
                          <dt className="text-slate-400">Document Version</dt>
                          <dd className="mt-0.5 font-semibold text-slate-700">v{selected.document_version}</dd>
                        </div>
                        <div>
                          <dt className="text-slate-400">Extraction Method</dt>
                          <dd className="mt-0.5 font-semibold text-slate-700">{selected.extraction_method}</dd>
                        </div>
                        <div className="col-span-2">
                          <dt className="text-slate-400">Source Pages</dt>
                          <dd className="mt-0.5 font-semibold text-slate-700">
                            {selected.source_pages?.join(', ') || 'None'}
                          </dd>
                        </div>
                        {selected.source_section && (
                          <div className="col-span-2">
                            <dt className="text-slate-400">Source Section</dt>
                            <dd className="mt-0.5 font-semibold text-slate-700">{selected.source_section}</dd>
                          </div>
                        )}
                      </dl>

                      <div id="entity-source-evidence" className="pt-2 border-t border-slate-100">
                        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                          Traceability Excerpts
                        </h3>
                        <div className="mt-2 space-y-2 max-h-64 overflow-y-auto pr-1">
                          {selected.source_evidence?.map((evidence, index) => (
                            <div key={`${evidence.page}-${index}`} className="rounded-lg bg-slate-50 border border-slate-200 p-3 text-xs">
                              <div className="mb-1 text-[11px] font-bold text-slate-800">
                                Page {evidence.page} {evidence.section ? `: ${evidence.section}` : ''}
                              </div>
                              <p className="leading-relaxed text-slate-600 text-[11px]">{evidence.excerpt}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </section>
            </>
          )}
        </>
      )}
    </div>
  );
}
