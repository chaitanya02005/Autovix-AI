import React, { useEffect, useMemo, useState } from 'react';
import { ClipboardCheck, RefreshCw } from 'lucide-react';
import { api } from '../api';
import { useApp } from '../context/AppContext';

const statuses = ['pending', 'approved', 'rejected', 'corrected'];

function statusStyle(status) {
  return {
    pending: 'bg-amber-50 text-amber-800 border-amber-200',
    approved: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    rejected: 'bg-rose-50 text-rose-800 border-rose-200',
    corrected: 'bg-blue-50 text-blue-800 border-blue-200',
  }[status] || 'bg-slate-100 text-slate-700 border-slate-200';
}

export default function ReviewQueue() {
  const { currentProjectId, currentRole, documents, documentInfo, setSelectedTab, addToast } = useApp();
  const [documentId, setDocumentId] = useState(documentInfo?.document_id || documents[0]?.document_id || '');
  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState({ pending: 0, approved: 0, rejected: 0, corrected: 0 });
  const [signoff, setSignoff] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);
  const [actionRow, setActionRow] = useState(null);
  const [comment, setComment] = useState('');
  const [correctedValue, setCorrectedValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const canReview = currentRole === 'admin' || currentRole === 'architect';

  useEffect(() => {
    if (!documents.length) {
      setDocumentId('');
      return;
    }
    if (!documents.some((document) => document.document_id === documentId)) {
      setDocumentId(documentInfo?.document_id || documents[0].document_id);
    }
  }, [documents, documentInfo?.document_id, documentId]);

  const loadReviews = async () => {
    if (!currentProjectId || !documentId) return;
    setLoading(true);
    setError('');
    try {
      const [records, counts, signoffData] = await Promise.all([
        api.getDocumentReviews(currentProjectId, documentId),
        api.getDocumentReviewSummary(currentProjectId, documentId),
        api.getDocumentSignoff(currentProjectId, documentId),
      ]);
      setItems(records);
      setSummary(counts);
      setSignoff(signoffData);
      setSelectedIds([]);
    } catch (requestError) {
      setError(requestError.message || 'Could not load review items.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadReviews(); }, [currentProjectId, documentId]);

  const filteredItems = useMemo(() => items.filter((item) => {
    const metadata = item.item_metadata || {};
    const entity = metadata.entity || {};
    const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
    const matchesType = typeFilter === 'all' || entity.entity_type === typeFilter;
    const haystack = [entity.name, entity.entity_type, metadata.question, item.original_value,
      ...(entity.source_evidence || []).map((evidence) => evidence.excerpt)].join(' ').toLowerCase();
    return matchesStatus && matchesType && (!search.trim() || haystack.includes(search.trim().toLowerCase()));
  }), [items, statusFilter, typeFilter, search]);

  const handleAction = async (item, action) => {
    try {
      const body = action === 'correct'
        ? { corrected_value: correctedValue, comment }
        : { comment };
      await api.reviewItem(currentProjectId, documentId, item.item_type, item.item_id, action, body);
      addToast(`Item ${action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : 'corrected'}.`, 'success');
      setActionRow(null);
      setComment('');
      setCorrectedValue('');
      await loadReviews();
    } catch (requestError) {
      addToast(requestError.message || 'Review action failed.', 'error');
    }
  };

  const handleBulkApprove = async () => {
    if (!selectedIds.length) return;
    try {
      await api.bulkApproveReviews(currentProjectId, documentId, selectedIds);
      addToast(`${selectedIds.length} entities approved.`, 'success');
      await loadReviews();
    } catch (requestError) {
      addToast(requestError.message || 'Bulk approval failed.', 'error');
    }
  };

  const handleSignoff = async () => {
    try {
      await api.signoffDocument(currentProjectId, documentId);
      addToast('Document version signed off for export.', 'success');
      await loadReviews();
    } catch (requestError) {
      addToast(requestError.message || 'Could not sign off this document.', 'error');
    }
  };

  const entityTypes = [...new Set(items.map((item) => item.item_metadata?.entity?.entity_type).filter(Boolean))].sort();
  const toggleSelected = (itemId) => setSelectedIds((ids) => ids.includes(itemId) ? ids.filter((id) => id !== itemId) : [...ids, itemId]);

  return (
    <div className="space-y-6 fade-in">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-200 pb-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#0f172a]">Review Queue</h1>
          <p className="mt-1 text-sm text-slate-500">Review extracted entities and grounded answers for this document.</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={documentId} onChange={(event) => setDocumentId(event.target.value)} className="h-9 max-w-64 rounded-lg border border-slate-200 bg-white px-3 text-xs">
            {documents.map((document) => <option key={document.document_id} value={document.document_id}>{document.filename} · v{document.version}</option>)}
          </select>
          <button onClick={loadReviews} disabled={loading || !documentId} className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 disabled:opacity-50">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
          {canReview && <button onClick={handleSignoff} disabled={loading || !documentId} className="h-9 rounded-lg bg-[#0f172a] px-3 text-xs font-semibold text-white disabled:opacity-50">Sign off for export</button>}
        </div>
      </div>

      {signoff && <div className={`rounded-lg border px-3 py-2 text-xs ${signoff.valid ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
        {signoff.valid ? `Signed off by ${signoff.signer} at ${signoff.signed_at} for v${signoff.document_version}.` : 'This document version needs a current engineer sign-off before export.'}
      </div>}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {statuses.map((status) => (
          <div key={status} className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{status}</div>
            <div className="mt-1 text-2xl font-bold text-slate-900">{summary[status] || 0}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-3">
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, answer or excerpt" className="h-9 min-w-48 flex-1 rounded-lg border border-slate-200 px-3 text-xs" />
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="h-9 rounded-lg border border-slate-200 px-3 text-xs">
          <option value="all">All statuses</option>{statuses.map((status) => <option key={status} value={status}>{status}</option>)}
        </select>
        <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} className="h-9 rounded-lg border border-slate-200 px-3 text-xs">
          <option value="all">All entity types</option>{entityTypes.map((type) => <option key={type} value={type}>{type}</option>)}
        </select>
        {canReview && <button onClick={handleBulkApprove} disabled={!selectedIds.length || loading} className="h-9 rounded-lg bg-[#0f172a] px-3 text-xs font-semibold text-white disabled:opacity-40">Approve selected ({selectedIds.length})</button>}
      </div>

      {error && <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">{error}</div>}
      {!documentId ? (
        <div className="rounded-xl border border-slate-200 bg-white p-12 text-center text-sm text-slate-500">Upload a document to start a review queue.</div>
      ) : loading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-12 text-center text-sm text-slate-500">Loading review items…</div>
      ) : !filteredItems.length ? (
        <div className="rounded-xl border border-slate-200 bg-white p-12 text-center shadow-xs">
          <ClipboardCheck className="mx-auto mb-3 h-8 w-8 text-slate-300" />
          <div className="text-sm font-semibold text-slate-700">No review items found</div>
          <div className="mt-1 text-xs text-slate-500">Run entity recognition or send an Ask AI answer to review.</div>
          <button onClick={() => setSelectedTab('Architecture Entity Recognition')} className="mt-4 text-xs font-semibold text-blue-700 hover:underline">Open Entity Recognition</button>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-xs">
          <table className="w-full min-w-[900px] border-collapse text-left">
            <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500">
              <tr><th className="px-3 py-3">Item</th><th className="px-3 py-3">Type</th><th className="px-3 py-3">Source</th><th className="px-3 py-3">Status</th><th className="px-3 py-3">Reviewer / Updated</th><th className="px-3 py-3">Actions</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredItems.map((item) => {
                const metadata = item.item_metadata || {};
                const entity = metadata.entity || {};
                const title = entity.name || metadata.question || 'AI answer';
                const evidence = entity.source_evidence?.[0];
                const excerpt = evidence?.excerpt || metadata.sources?.map((source) => source.excerpt).filter(Boolean).join(' ') || item.original_value;
                const pages = entity.source_pages || metadata.sources?.map((source) => source.page).filter(Boolean) || [];
                const selected = selectedIds.includes(item.item_id);
                return <tr key={`${item.item_type}:${item.item_id}`} className="align-top">
                  <td className="px-3 py-3">
                    <div className="flex items-start gap-2">
                      {canReview && item.item_type === 'entity' && item.status === 'pending' && <input aria-label={`Select ${title}`} type="checkbox" checked={selected} onChange={() => toggleSelected(item.item_id)} className="mt-0.5 accent-slate-900" />}
                      <div><div className="font-semibold text-slate-900">{title}</div>{metadata.question && <div className="mt-1 text-[11px] text-slate-500">Q: {metadata.question}</div>}</div>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-slate-600">{entity.entity_type || 'AI answer'}</td>
                  <td className="max-w-sm px-3 py-3 text-slate-600"><div>{pages.length ? `Page ${pages.join(', ')}` : '—'}</div><div className="mt-1 line-clamp-3 text-[11px] text-slate-500">{excerpt}</div></td>
                  <td className="px-3 py-3"><span className={`rounded-md border px-2 py-1 text-[10px] font-semibold capitalize ${statusStyle(item.status)}`}>{item.status}</span></td>
                  <td className="px-3 py-3 text-slate-600"><div>{item.reviewer || '—'}</div><div className="mt-1 text-[10px] text-slate-400">{item.updated_at}</div></td>
                  <td className="px-3 py-3">
                    {!canReview ? <span className="text-[11px] text-slate-400">Read only</span> : <div className="flex flex-wrap gap-1.5">
                      <button onClick={() => handleAction(item, 'approve')} className="rounded border border-emerald-200 px-2 py-1 text-[10px] font-semibold text-emerald-800 hover:bg-emerald-50">Approve</button>
                      <button onClick={() => { setActionRow({ id: item.item_id, action: 'reject' }); setComment(''); }} className="rounded border border-rose-200 px-2 py-1 text-[10px] font-semibold text-rose-800 hover:bg-rose-50">Reject</button>
                      <button onClick={() => { setActionRow({ id: item.item_id, action: 'correct' }); setComment(''); setCorrectedValue(item.corrected_value || item.original_value); }} className="rounded border border-blue-200 px-2 py-1 text-[10px] font-semibold text-blue-800 hover:bg-blue-50">Correct</button>
                      {actionRow?.id === item.item_id && <div className="mt-2 w-full space-y-1.5">
                        {actionRow.action === 'correct' && <textarea value={correctedValue} onChange={(event) => setCorrectedValue(event.target.value)} placeholder="Corrected value" className="w-full rounded border border-slate-200 p-2 text-[11px]" rows={2} />}
                        <textarea value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Comment required" className="w-full rounded border border-slate-200 p-2 text-[11px]" rows={2} />
                        <button disabled={!comment.trim() || (actionRow.action === 'correct' && !correctedValue.trim())} onClick={() => handleAction(item, actionRow.action)} className="rounded bg-slate-900 px-2 py-1 text-[10px] font-semibold text-white disabled:opacity-40">Submit {actionRow.action}</button>
                      </div>}
                    </div>}
                  </td>
                </tr>;
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
