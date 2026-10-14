import React, { useState, useEffect, useCallback } from 'react';
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
} from 'lucide-react';

function timeAgo(ts) {
  if (!ts) return 'recently';
  try {
    const dt = new Date(ts);
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
    stats,
    documentReady,
    documentInfo,
    setSelectedTab,
    refreshProjectData,
    addToast,
  } = useApp();

  const [logs, setLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);

  const fetchLogs = useCallback(async () => {
    if (!currentProjectId) return;
    setLogsLoading(true);
    try {
      const data = await api.getAuditLogs(currentProjectId, 10);
      setLogs(data || []);
    } catch (err) {
      console.error('Failed to fetch activity logs:', err);
    } finally {
      setLogsLoading(false);
    }
  }, [currentProjectId]);

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

    if (evt === 'QUESTION_ASKED' && log.question) {
      const q = log.question;
      title = q.length > 35 ? `Question: "${q.substring(0, 35)}..."` : `Question: "${q}"`;
      subtitle = 'Question Asked';
    } else if (['DOCUMENT_PROCESSED', 'DOCUMENT_UPLOADED', 'DOCUMENT_DELETED'].includes(evt)) {
      const docName = log.document_name || 'Unknown Document';
      const version = log.details?.version || '1';
      title = `${docName} [v${version}]`;
      if (evt === 'DOCUMENT_PROCESSED') subtitle = 'Document processed successfully';
      else if (evt === 'DOCUMENT_UPLOADED') subtitle = 'Document uploaded';
      else subtitle = 'Document deleted';
    } else if (evt === 'COMPARISON_RUN') {
      title = 'Comparison completed';
      subtitle = 'Documents compared';
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
            Real-time status of your AUTOSAR specifications, architecture entities, and grounded RAG models.
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
