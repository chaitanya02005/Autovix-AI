import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { api } from '../api';
import {
  Share2,
  Box,
  ArrowLeftRight,
  Search,
  Filter,
  FileText,
  Layers,
  ArrowRight
} from 'lucide-react';

export default function Relationships() {
  const {
    currentProjectId,
    documentReady,
    documentInfo,
    setSelectedTab,
    addToast,
  } = useApp();

  const [relationships, setRelationships] = useState([]);
  const [traceability, setTraceability] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filterText, setFilterText] = useState('');
  const [filterType, setFilterType] = useState('All types');
  const [traceSearch, setTraceSearch] = useState('');

  // Fetch relationships and traceability entities
  useEffect(() => {
    if (!currentProjectId || !documentReady) return;
    setLoading(true);

    Promise.all([
      api.getRelationships(currentProjectId).catch(() => []),
      api.getTraceability(currentProjectId).catch(() => []),
    ])
      .then(([relData, traceData]) => {
        setRelationships(relData || []);
        setTraceability(traceData || []);
      })
      .catch((err) => {
        console.error('Failed to load relationships data:', err);
        addToast('Failed to load relationships', 'error');
      })
      .finally(() => setLoading(false));
  }, [currentProjectId, documentReady, addToast]);

  // Log entity search with debounce
  useEffect(() => {
    if (!traceSearch.trim() || !currentProjectId) return;
    const timer = setTimeout(() => {
      api.logAuditEvent(currentProjectId, {
        event_type: 'SEARCH',
        question: traceSearch.trim(),
        details: { target: 'entities', query: traceSearch.trim() },
      }).catch(() => {});
    }, 600);
    return () => clearTimeout(timer);
  }, [traceSearch, currentProjectId]);

  // Derived stats
  const uniqueNodes = useMemo(() => {
    const nodes = new Set();
    relationships.forEach((r) => {
      if (r.source) nodes.add(r.source);
      if (r.target) nodes.add(r.target);
    });
    return nodes;
  }, [relationships]);

  const uniqueRelationTypes = useMemo(() => {
    const types = new Set();
    relationships.forEach((r) => {
      if (r.relationship) types.add(r.relationship);
    });
    return Array.from(types).sort();
  }, [relationships]);

  // Filtered relationships
  const filteredRelationships = useMemo(() => {
    return relationships.filter((r) => {
      const ft = filterText.toLowerCase().trim();
      const matchText =
        !ft ||
        String(r.source || '').toLowerCase().includes(ft) ||
        String(r.target || '').toLowerCase().includes(ft) ||
        String(r.relationship || '').toLowerCase().includes(ft);

      const matchType =
        filterType === 'All types' || r.relationship === filterType;

      return matchText && matchType;
    });
  }, [relationships, filterText, filterType]);

  // Filtered traceability
  const filteredTraceability = useMemo(() => {
    if (!traceSearch.trim()) return traceability;
    const q = traceSearch.toLowerCase().trim();
    return traceability.filter((t) => {
      return (
        String(t.entity || '').toLowerCase().includes(q) ||
        String(t.type || '').toLowerCase().includes(q)
      );
    });
  }, [traceability, traceSearch]);

  if (!documentReady) {
    return (
      <div className="space-y-6 fade-in">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#0f172a]">
            Relationship Explorer
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Visualize software component interactions and service dependencies extracted from your document.
          </p>
        </div>

        <div className="bg-white border border-[#e2e8f0] rounded-xl p-12 text-center shadow-sm">
          <Share2 className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <div className="text-sm font-semibold text-slate-700">No document loaded</div>
          <div className="text-xs text-slate-400 mt-1">
            Upload a document in the Documents tab first.
          </div>
          <button
            onClick={() => setSelectedTab('Documents')}
            className="mt-4 px-4 py-2 bg-[#1e293b] text-white text-xs font-semibold rounded-lg hover:bg-slate-900 transition-colors inline-flex items-center gap-2"
          >
            <span>Go to Documents</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  }

  const getRelBadgeStyle = (rel) => {
    switch (rel) {
      case 'provides':
        return 'bg-emerald-50 text-emerald-800 border border-emerald-200/60';
      case 'consumes':
        return 'bg-blue-50 text-blue-800 border border-blue-200/60';
      case 'typed_by':
        return 'bg-purple-50 text-purple-800 border border-purple-200/60';
      default:
        return 'bg-slate-100 text-slate-700 border border-slate-200';
    }
  };

  const getTypeBadgeStyle = (type) => {
    switch (type) {
      case 'components':
        return 'bg-indigo-50 text-indigo-800';
      case 'interfaces':
        return 'bg-amber-50 text-amber-800';
      case 'ports':
        return 'bg-sky-50 text-sky-800';
      case 'services':
        return 'bg-rose-50 text-rose-800';
      default:
        return 'bg-slate-100 text-slate-700';
    }
  };

  return (
    <div className="space-y-8 fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[#0f172a]">
          Relationship Explorer
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Visualize software component interactions and service dependencies extracted from your document.
        </p>
      </div>

      {/* 3 Summary Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div className="bg-white border border-[#e2e8f0] rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
              <Share2 className="w-6 h-6" />
            </div>
            <div>
              <div className="text-2xl font-bold text-[#0f172a]">
                {relationships.length}
              </div>
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mt-0.5">
                Relationships
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white border border-[#e2e8f0] rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <Box className="w-6 h-6" />
            </div>
            <div>
              <div className="text-2xl font-bold text-[#0f172a]">
                {uniqueNodes.size}
              </div>
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mt-0.5">
                Components
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white border border-[#e2e8f0] rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <ArrowLeftRight className="w-6 h-6" />
            </div>
            <div>
              <div className="text-2xl font-bold text-[#0f172a]">
                {uniqueRelationTypes.length}
              </div>
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mt-0.5">
                Relation Types
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Relationships Table Section */}
      {relationships.length > 0 ? (
        <div className="space-y-4">
          {/* Filters */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2 relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
              <input
                type="text"
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
                placeholder="Filter by component or relation (e.g. PPort, provides…)"
                className="w-full h-10 pl-10 pr-4 text-sm bg-white border border-[#e2e8f0] rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-300 transition-shadow"
              />
            </div>
            <div>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="w-full h-10 px-3 text-sm bg-white border border-[#e2e8f0] rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-300 transition-shadow text-slate-700 font-medium cursor-pointer"
              >
                <option value="All types">All types</option>
                {uniqueRelationTypes.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="text-xs text-slate-500 font-medium">
            Showing {filteredRelationships.length} of {relationships.length} relationships
          </div>

          {/* Table */}
          <div className="bg-white border border-[#e2e8f0] rounded-xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="bg-[#F6F6F6] border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    <th className="py-3 px-4">Source</th>
                    <th className="py-3 px-4 text-center">Relationship</th>
                    <th className="py-3 px-4">Target</th>
                    <th className="py-3 px-4 text-center">Page</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredRelationships.slice(0, 100).map((rel, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4 font-semibold text-[#0f172a]">
                        {rel.source || '—'}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${getRelBadgeStyle(
                            rel.relationship
                          )}`}
                        >
                          {rel.relationship || '—'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-700">{rel.target || '—'}</td>
                      <td className="py-3 px-4 text-center text-xs font-medium text-slate-500">
                        {rel.page || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white border border-[#e2e8f0] rounded-xl p-10 text-center shadow-sm">
          <Share2 className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <div className="text-sm font-semibold text-slate-700">No relationships found</div>
          <div className="text-xs text-slate-400 mt-1">
            The document did not contain detectable component relationships (PPort/RPort patterns).
          </div>
        </div>
      )}

      {/* Architecture Entities (Traceability) Section */}
      <div className="space-y-4 pt-4">
        <h2 className="text-base font-semibold text-[#0f172a]">
          Architecture Entities (Traceability)
        </h2>

        {traceability.length > 0 ? (
          <>
            <div className="relative max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
              <input
                type="text"
                value={traceSearch}
                onChange={(e) => setTraceSearch(e.target.value)}
                placeholder="Filter entities…"
                className="w-full h-10 pl-10 pr-4 text-sm bg-white border border-[#e2e8f0] rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-300 transition-shadow"
              />
            </div>

            <div className="text-xs text-slate-500 font-medium">
              Showing {filteredTraceability.length} of {traceability.length} entities
            </div>

            <div className="bg-white border border-[#e2e8f0] rounded-xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="bg-[#F6F6F6] border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                      <th className="py-3 px-4">Entity</th>
                      <th className="py-3 px-4">Type</th>
                      <th className="py-3 px-4 text-center">Page</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredTraceability.slice(0, 200).map((t, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-4 font-semibold text-[#0f172a]">
                          {t.entity || '—'}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-md text-[11px] font-semibold ${getTypeBadgeStyle(
                              t.type
                            )}`}
                          >
                            {t.type || '—'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center text-xs font-medium text-slate-500">
                          {t.page || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        ) : (
          <div className="text-xs text-slate-400 py-4">No entity records found.</div>
        )}
      </div>
    </div>
  );
}
