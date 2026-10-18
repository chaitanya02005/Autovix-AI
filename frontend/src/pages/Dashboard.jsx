import { useState, useEffect, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { api } from '../api';
import {
  FileText,
  Network,
  MessageSquare,
  ArrowRight,
  RefreshCw,
  FileCheck,
  UploadCloud,
  ArrowLeftRight,
  User,
  LogOut,
  Search,
  FolderPlus,
  Trash2,
  Clock,
  ExternalLink,
  BarChart3,
  Sparkles,
} from 'lucide-react';

const EVENT_GROUPS = [
  { key: 'documents', label: 'Documents', color: '#2563eb', events: ['DOCUMENT_PROCESSED', 'DOCUMENT_UPLOADED', 'DOCUMENT_UPLOAD', 'DOCUMENT_DELETED'] },
  { key: 'questions', label: 'AI questions', color: '#8b5cf6', events: ['QUESTION_ASKED', 'DOCUMENT_QUERY'] },
  { key: 'reviews', label: 'Reviews & comparisons', color: '#0f766e', events: ['COMPARISON', 'COMPARISON_RUN', 'REVIEW', 'REVIEW_SUBMITTED', 'REVIEW_ACTION', 'REVIEW_BULK_ACTION', 'REVIEW_APPROVED', 'REVIEW_REJECTED', 'REVIEW_CORRECTED', 'EXPORT_SIGNOFF'] },
  { key: 'recognition', label: 'Recognition & exports', color: '#d97706', events: ['ENTITY_RECOGNITION', 'EXPORT'] },
  { key: 'other', label: 'Workspace & access', color: '#94a3b8', events: [] },
];

function getActivityGroup(eventType = '') {
  return EVENT_GROUPS.find((group) => group.events.includes(eventType)) || EVENT_GROUPS[4];
}

function ActivityTrend({ logs, days }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const points = Array.from({ length: days }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (days - index - 1));
    const next = new Date(date);
    next.setDate(date.getDate() + 1);
    const count = logs.filter((log) => {
      const timestamp = new Date(log.timestamp);
      return timestamp >= date && timestamp < next;
    }).length;
    return { date, count };
  });
  const width = 680;
  const height = 210;
  const left = 34;
  const right = 12;
  const top = 14;
  const bottom = 30;
  const max = Math.max(4, Math.ceil(Math.max(...points.map((point) => point.count), 0) / 4) * 4);
  const x = (index) => left + (index / Math.max(points.length - 1, 1)) * (width - left - right);
  const y = (value) => top + ((max - value) / max) * (height - top - bottom);
  const line = points.map((point, index) => `${x(index)},${y(point.count)}`).join(' ');
  const area = `${left},${height - bottom} ${line} ${width - right},${height - bottom}`;
  const labelEvery = days === 7 ? 1 : 5;

  if (!logs.length) return (
    <div className="flex h-[214px] flex-col items-center justify-center rounded-xl bg-slate-50/80 text-center">
      <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-full bg-white text-slate-400 shadow-sm"><BarChart3 className="h-4 w-4" /></div>
      <p className="text-xs font-semibold text-slate-600">Your activity trend will appear here</p>
      <p className="mt-1 text-[11px] text-slate-400">Upload a document or ask AI to start building your timeline.</p>
    </div>
  );

  return (
    <div className="w-full overflow-hidden">
      <svg className="h-[214px] w-full overflow-visible" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Daily workspace activity over the last ${days} days`} preserveAspectRatio="none">
        <defs>
          <linearGradient id="activityFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#2563eb" stopOpacity=".18" /><stop offset="100%" stopColor="#2563eb" stopOpacity="0" /></linearGradient>
        </defs>
        {[0, 1, 2, 3].map((step) => {
          const value = Math.round((max / 3) * (3 - step));
          const yy = y(value);
          return <g key={step}><line x1={left} x2={width - right} y1={yy} y2={yy} stroke="#e8edf4" strokeDasharray="3 5" /><text x="0" y={yy + 4} fill="#94a3b8" fontSize="10">{value}</text></g>;
        })}
        <polygon points={area} fill="url(#activityFill)" />
        <polyline points={line} fill="none" stroke="#2563eb" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        {points.map((point, index) => <g key={point.date.toISOString()}><circle cx={x(index)} cy={y(point.count)} r="3.5" fill="white" stroke="#2563eb" strokeWidth="2" /><title>{point.date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}: {point.count} events</title>{index % labelEvery === 0 && <text x={x(index)} y={height - 6} fill="#94a3b8" fontSize="10" textAnchor="middle">{point.date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</text>}</g>)}
      </svg>
    </div>
  );
}

function timeAgo(ts) {
  if (!ts) return 'recently';
  try {
    const dt = new Date(ts);
    if (!Number.isFinite(dt.getTime())) return 'recently';
    const now = new Date();
    const diff = (now - dt) / 1000;
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)} mins ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`;
    return dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return 'recently';
  }
}

export default function Dashboard() {
  const {
    currentProjectId,
    currentProject,
    stats,
    documentReady,
    documentInfo,
    setSelectedTab,
    refreshProjectData,
    addToast,
  } = useApp();

  const [logs, setLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [activityRange, setActivityRange] = useState(7);

  const fetchLogs = useCallback(async () => {
    if (!currentProjectId) return;
    setLogsLoading(true);
    try {
      const data = await api.getAuditLogs(currentProjectId, 200);
      setLogs(data || []);
    } catch (err) {
      console.error('Failed to fetch activity logs:', err);
    } finally {
      setLogsLoading(false);
    }
  }, [currentProjectId]);

  const activitySummary = (() => {
    const cutoff = new Date();
    cutoff.setHours(0, 0, 0, 0);
    cutoff.setDate(cutoff.getDate() - (activityRange - 1));
    const recent = logs.filter((log) => new Date(log.timestamp) >= cutoff);
    const groups = EVENT_GROUPS.map((group) => ({
      ...group,
      count: recent.filter((log) => getActivityGroup(log.event_type).key === group.key).length,
    }));
    return { recent, groups, total: recent.length };
  })();

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleRefresh = async () => {
    await Promise.all([refreshProjectData(), fetchLogs()]);
    addToast('Activity logs refreshed', 'info');
  };

  const getEventIcon = (type) => {
    switch (type) {
      case 'DOCUMENT_PROCESSED':
        return { icon: FileCheck, color: 'text-emerald-700 bg-emerald-50' };
      case 'DOCUMENT_UPLOADED':
        return { icon: UploadCloud, color: 'text-blue-700 bg-blue-50' };
      case 'QUESTION_ASKED':
        return { icon: MessageSquare, color: 'text-amber-700 bg-amber-50' };
      case 'COMPARISON_RUN':
        return { icon: ArrowLeftRight, color: 'text-slate-700 bg-slate-100' };
      case 'LOGIN':
        return { icon: User, color: 'text-slate-700 bg-slate-100' };
      case 'LOGOUT':
        return { icon: LogOut, color: 'text-slate-600 bg-slate-50' };
      case 'SEARCH':
        return { icon: Search, color: 'text-slate-700 bg-slate-100' };
      case 'PROJECT_CREATED':
        return { icon: FolderPlus, color: 'text-emerald-700 bg-emerald-50' };
      case 'DOCUMENT_DELETED':
        return { icon: Trash2, color: 'text-rose-700 bg-rose-50' };
      default:
        return { icon: Clock, color: 'text-slate-600 bg-slate-50' };
    }
  };

  const formatLogItem = (log) => {
    const evt = log.event_type || '';
    let title = '';
    let subtitle = '';

    if (['QUESTION_ASKED', 'DOCUMENT_QUERY'].includes(evt) && log.question) {
      const q = log.question;
      title = q.length > 35 ? `Question: "${q.substring(0, 35)}..."` : `Question: "${q}"`;
      subtitle = log.status === 'error' ? 'Question could not be answered' : 'Document question';
    } else if (['DOCUMENT_PROCESSED', 'DOCUMENT_UPLOADED', 'DOCUMENT_UPLOAD', 'DOCUMENT_DELETED'].includes(evt)) {
      const docName = log.document_name || 'Unknown Document';
      const version = log.details?.version || '1';
      title = `${docName} [v${version}]`;
      if (evt === 'DOCUMENT_PROCESSED') subtitle = 'Document processed successfully';
      else if (['DOCUMENT_UPLOADED', 'DOCUMENT_UPLOAD'].includes(evt)) subtitle = 'Document uploaded';
      else subtitle = 'Document deleted';
    } else if (evt === 'ENTITY_RECOGNITION') {
      title = log.document_name || 'Architecture entity recognition';
      const count = log.details?.count;
      subtitle = Number.isFinite(count) ? `${count} entities identified` : 'Entity recognition completed';
    } else if (['COMPARISON', 'COMPARISON_RUN'].includes(evt)) {
      title = log.document_name || 'Document comparison';
      subtitle = log.status === 'error' ? 'Comparison failed' : 'Comparison completed';
    } else if (['REVIEW', 'REVIEW_SUBMITTED', 'REVIEW_ACTION', 'REVIEW_BULK_ACTION'].includes(evt)) {
      const action = log.details?.action || (evt === 'REVIEW_SUBMITTED' ? 'submitted' : 'updated');
      const state = log.details?.review_status;
      title = evt === 'REVIEW_SUBMITTED' ? 'Answer submitted for review' : 'Review updated';
      subtitle = state ? `Status: ${String(state).replace(/_/g, ' ')}` : `Review ${action}`;
    } else if (evt === 'EXPORT_SIGNOFF') {
      title = log.document_name || 'Document sign-off';
      subtitle = 'Version signed off for export';
    } else if (evt === 'EXPORT') {
      title = `${String(log.details?.artifact || 'Data').replace(/_/g, ' ')} export`;
      subtitle = log.status === 'success' ? 'Export created' : 'Export request recorded';
    } else if (evt === 'LOGIN') {
      title = 'System Session';
      subtitle = 'Session active';
    } else if (evt === 'LOGOUT') {
      title = 'System Session';
      subtitle = 'Session closed';
    } else if (evt === 'SEARCH') {
      const target = log.details?.target || 'documents';
      const q = log.question || log.details?.query || 'query';
      title = q.length > 30 ? `Search: "${q.substring(0, 30)}..."` : `Search: "${q}"`;
      subtitle = `Filtered ${target}`;
    } else if (evt === 'PROJECT_CREATED') {
      title = 'New Workspace';
      subtitle = 'Workspace created';
    } else {
      title = evt.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
      subtitle = 'System event';
    }

    return { title, subtitle };
  };

  return (
    <div className="space-y-8 fade-in">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#0f172a]">Workspace Dashboard</h1>
          <p className="text-sm text-slate-500 mt-1">
            Monitor document processing, architecture entity review, and recent activity for this workspace.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700 rounded-lg transition-colors shadow-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${logsLoading ? 'animate-spin' : ''}`} />
            <span>Refresh Overview</span>
          </button>
        </div>
      </div>

      {/* 3-column Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {/* Documents */}
        <div className="bg-white border border-[#e2e8f0] rounded-xl p-5 shadow-xs hover:border-slate-300 transition-colors">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center shrink-0">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <div className="text-2xl font-bold text-[#0f172a]">
                {stats.documents_count || 0}
              </div>
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mt-0.5">
                Processed Documents
              </div>
              <div className="text-xs text-slate-500 mt-0.5">
                Active in workspace catalog
              </div>
            </div>
          </div>
        </div>

        {/* Entities */}
        <div className="bg-white border border-[#e2e8f0] rounded-xl p-5 shadow-xs hover:border-slate-300 transition-colors">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-slate-100 text-slate-800 flex items-center justify-center shrink-0">
              <Network className="w-6 h-6" />
            </div>
            <div>
              <div className="text-2xl font-bold text-[#0f172a]">
                {(stats.entities_count || 0).toLocaleString()}
              </div>
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mt-0.5">
                Architecture Entities
              </div>
              <div className="text-xs text-slate-500 mt-0.5">Components, ports, interfaces</div>
            </div>
          </div>
        </div>

        {/* Questions */}
        <div className="bg-white border border-[#e2e8f0] rounded-xl p-5 shadow-xs hover:border-slate-300 transition-colors">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
              <MessageSquare className="w-6 h-6" />
            </div>
            <div>
              <div className="text-2xl font-bold text-[#0f172a]">
                {stats.questions_count || 0}
              </div>
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mt-0.5">
                Questions Answered
              </div>
              <div className="text-xs text-slate-500 mt-0.5">Grounded RAG session queries</div>
            </div>
          </div>
        </div>
      </div>

      {/* Project analytics */}
      <section className="space-y-4" aria-labelledby="analytics-title">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-1 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-blue-700"><Sparkles className="h-3.5 w-3.5" /> Workspace insights</div>
            <h2 id="analytics-title" className="text-lg font-bold tracking-tight text-[#0f172a]">Activity analytics</h2>
            <p className="mt-1 text-xs text-slate-500">A closer look at how {currentProject?.name || 'your workspace'} is being used.</p>
          </div>
          <div className="inline-flex w-fit items-center rounded-lg border border-slate-200 bg-white p-1 shadow-xs" role="group" aria-label="Activity time range">
            {[7, 30].map((days) => <button key={days} onClick={() => setActivityRange(days)} aria-pressed={activityRange === days} className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${activityRange === days ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'}`}>{days} days</button>)}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
          <div className="rounded-xl border border-[#e2e8f0] bg-white p-5 shadow-xs xl:col-span-8 sm:p-6">
            <div className="mb-2 flex items-start justify-between gap-3">
              <div><h3 className="text-sm font-bold text-slate-900">Workspace activity</h3><p className="mt-1 text-[11px] text-slate-500">Events recorded per day</p></div>
              <span className="rounded-full border border-blue-100 bg-blue-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-blue-700">{activitySummary.total} events</span>
            </div>
            <ActivityTrend logs={logs} days={activityRange} />
            {logs.length >= 200 && <p className="mt-1 text-[10px] leading-relaxed text-slate-400">Trend uses the latest 200 audit events available from the API.</p>}
          </div>

          <div className="rounded-xl border border-[#e2e8f0] bg-white p-5 shadow-xs xl:col-span-4 sm:p-6">
            <div className="flex items-start justify-between">
              <div><h3 className="text-sm font-bold text-slate-900">Activity mix</h3><p className="mt-1 text-[11px] text-slate-500">By workspace action</p></div>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-50 text-slate-500"><BarChart3 className="h-4 w-4" /></div>
            </div>
            {activitySummary.total ? <div className="mt-6 space-y-4">
              <div className="flex h-2 overflow-hidden rounded-full bg-slate-100" aria-label="Activity event distribution">
                {activitySummary.groups.filter((group) => group.count).map((group) => <div key={group.key} title={`${group.label}: ${group.count}`} style={{ width: `${(group.count / activitySummary.total) * 100}%`, backgroundColor: group.color }} />)}
              </div>
              <div className="space-y-3.5">
                {activitySummary.groups.map((group) => <div key={group.key} className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2.5"><span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: group.color }} /><span className="truncate text-xs font-medium text-slate-600">{group.label}</span></div>
                  <div className="flex items-center gap-2"><span className="w-7 text-right text-xs font-bold tabular-nums text-slate-900">{group.count}</span><span className="w-9 text-right text-[10px] tabular-nums text-slate-400">{Math.round((group.count / activitySummary.total) * 100)}%</span></div>
                </div>)}
              </div>
              <div className="mt-5 rounded-lg bg-slate-50 px-3.5 py-3 text-[11px] leading-relaxed text-slate-500"><span className="font-semibold text-slate-700">Insight</span> · {activitySummary.total === 1 ? 'Your first workspace event is in. Keep going to reveal activity patterns.' : `${activitySummary.groups.filter((group) => group.count > 0).length} types of activity recorded in this period.`}</div>
            </div> : <div className="mt-6 flex min-h-[198px] flex-col items-center justify-center rounded-xl bg-slate-50/80 px-4 text-center"><div className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-slate-400 shadow-sm"><BarChart3 className="h-4 w-4" /></div><p className="mt-3 text-xs font-semibold text-slate-600">No activity in this period</p><p className="mt-1 max-w-[220px] text-[11px] leading-relaxed text-slate-400">Workspace actions will be grouped here as your team works.</p></div>}
          </div>
        </div>
      </section>

      {/* Split Row: Current Document & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Current Document (7 cols) */}
        <div className="lg:col-span-7 space-y-3">
          <h2 className="text-sm font-bold text-[#0f172a] uppercase tracking-wider text-slate-500">
            Active Document
          </h2>

          {documentReady && documentInfo ? (
            <div className="bg-white border border-[#e2e8f0] rounded-xl p-6 shadow-xs space-y-6">
              <div className="flex items-start gap-4">
                <div className="w-14 h-16 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 shrink-0">
                  <FileText className="w-8 h-8" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="text-base sm:text-lg font-bold text-[#0f172a] truncate max-w-sm" title={documentInfo.filename}>
                      {documentInfo.filename || 'Unknown Document'}
                    </span>
                    <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-xs font-bold border border-slate-200">
                      v{documentInfo.version || 1}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-xs text-slate-500 font-medium">Status:</span>
                    <span className="inline-flex items-center gap-1 bg-emerald-50 border border-emerald-200 text-emerald-800 px-2.5 py-0.5 rounded text-xs font-semibold">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                      Processed & Indexed
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 mt-2 font-medium">
                    Total Pages: <strong className="text-slate-800">{documentInfo.pages || 0}</strong>
                    <span className="mx-2 text-slate-300">|</span>
                    Text Chunks: <strong className="text-slate-800">{documentInfo.chunks || 0}</strong>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-2 border-t border-slate-100">
                <button
                  onClick={() => setSelectedTab('Documents')}
                  className="flex-1 h-10 bg-[#0f172a] hover:bg-slate-800 text-white font-semibold rounded-lg text-xs transition-colors flex items-center justify-center gap-2 shadow-xs"
                >
                  <span>Manage in Documents</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setSelectedTab('Architecture Entity Recognition')}
                  className="flex-1 h-10 bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 font-semibold rounded-lg text-xs transition-colors flex items-center justify-center gap-2 shadow-xs"
                >
                  <span>Inspect Architecture Entities</span>
                  <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-white border border-[#e2e8f0] rounded-xl p-10 text-center shadow-xs">
              <div className="w-12 h-12 rounded-lg bg-slate-100 text-slate-400 mx-auto flex items-center justify-center mb-3">
                <FileText className="w-6 h-6" />
              </div>
              <div className="text-sm font-semibold text-slate-700">No active document</div>
              <div className="text-xs text-slate-400 mt-1">
                Upload an AUTOSAR PDF specification to begin architecture extraction.
              </div>
              <button
                onClick={() => setSelectedTab('Documents')}
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-[#0f172a] text-white text-xs font-semibold rounded-lg hover:bg-slate-800 transition-colors shadow-xs"
              >
                Go to Documents
              </button>
            </div>
          )}
        </div>

        {/* Recent Activity (5 cols) */}
        <div className="lg:col-span-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-[#0f172a] uppercase tracking-wider text-slate-500">
              Recent Workspace Activity
            </h2>
            <button
              onClick={() => setSelectedTab('Settings')}
              title="View all audit logs"
              className="text-xs font-semibold text-slate-600 hover:text-slate-900 px-2.5 py-1 rounded-lg border border-[#e2e8f0] hover:bg-slate-50 transition-colors"
            >
              All Logs
            </button>
          </div>

          <div className="bg-white border border-[#e2e8f0] rounded-xl p-5 shadow-xs space-y-3.5">
            {logs.length > 0 ? (
              logs.slice(0, 6).map((log, idx) => {
                const { title, subtitle } = formatLogItem(log);
                const { icon: EventIcon, color } = getEventIcon(log.event_type);

                return (
                  <div
                    key={log.id || idx}
                    className="flex items-start justify-between gap-3 text-sm pb-3 border-b border-slate-100 last:border-0 last:pb-0"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <div
                        className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 ${color}`}
                      >
                        <EventIcon className="w-3.5 h-3.5" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-[#0f172a] truncate leading-tight">
                          {title}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5 leading-tight">
                          {subtitle}
                        </div>
                      </div>
                    </div>
                    <span className="text-[11px] text-slate-400 shrink-0 font-medium">
                      {timeAgo(log.timestamp)}
                    </span>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-8 text-xs text-slate-400">
                No recent activity recorded.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
