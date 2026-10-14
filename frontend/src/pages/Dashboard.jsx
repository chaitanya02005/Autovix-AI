import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { api } from '../api';
import {
  FileText,
  Box,
  Share2,
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
  Layers
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
        return { icon: FileCheck, color: 'text-emerald-600 bg-emerald-50' };
      case 'DOCUMENT_UPLOADED':
        return { icon: UploadCloud, color: 'text-blue-600 bg-blue-50' };
      case 'QUESTION_ASKED':
        return { icon: MessageSquare, color: 'text-amber-600 bg-amber-50' };
      case 'COMPARISON_RUN':
        return { icon: ArrowLeftRight, color: 'text-purple-600 bg-purple-50' };
      case 'LOGIN':
        return { icon: User, color: 'text-indigo-600 bg-indigo-50' };
      case 'LOGOUT':
        return { icon: LogOut, color: 'text-slate-600 bg-slate-50' };
      case 'SEARCH':
        return { icon: Search, color: 'text-cyan-600 bg-cyan-50' };
      case 'PROJECT_CREATED':
        return { icon: FolderPlus, color: 'text-emerald-600 bg-emerald-50' };
      case 'DOCUMENT_DELETED':
        return { icon: Trash2, color: 'text-rose-600 bg-rose-50' };
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
      title = `${docName} [${version}]`;
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
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[#0f172a]">Dashboard</h1>
        <p className="text-sm text-slate-500 mt-1">
          Overview of your architecture documents and analysis
        </p>
      </div>

      {/* 4-column Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Documents */}
        <div className="bg-white border border-[#e2e8f0] rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <div className="text-2xl font-bold text-[#0f172a]">
                {stats.documents_count || 0}
              </div>
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mt-0.5">
                Documents
              </div>
              <div className="text-xs text-slate-500 mt-0.5">
                {stats.documents_count || 0} processed
              </div>
            </div>
          </div>
        </div>

        {/* Entities */}
        <div className="bg-white border border-[#e2e8f0] rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
              <Box className="w-6 h-6" />
            </div>
            <div>
              <div className="text-2xl font-bold text-[#0f172a]">
                {(stats.entities_count || 0).toLocaleString()}
              </div>
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mt-0.5">
                Entities
              </div>
              <div className="text-xs text-slate-500 mt-0.5">From active document</div>
            </div>
          </div>
        </div>

        {/* Relationships */}
        <div className="bg-white border border-[#e2e8f0] rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <Share2 className="w-6 h-6" />
            </div>
            <div>
              <div className="text-2xl font-bold text-[#0f172a]">
                {(stats.relationships_count || 0).toLocaleString()}
              </div>
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mt-0.5">
                Relationships
              </div>
              <div className="text-xs text-slate-500 mt-0.5">From active document</div>
            </div>
          </div>
        </div>

        {/* Questions */}
        <div className="bg-white border border-[#e2e8f0] rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow border-amber-200/50">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
              <MessageSquare className="w-6 h-6" />
            </div>
            <div>
              <div className="text-2xl font-bold text-[#0f172a]">
                {stats.questions_count || 0}
              </div>
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mt-0.5">
                Questions
              </div>
              <div className="text-xs text-slate-500 mt-0.5">This session</div>
            </div>
          </div>
        </div>
      </div>

      {/* Split Row: Current Document & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Current Document (7 cols) */}
        <div className="lg:col-span-7 space-y-3">
          <h2 className="text-base font-semibold text-[#0f172a]">Current Document</h2>

          {documentReady && documentInfo ? (
            <div className="bg-white border border-[#e2e8f0] rounded-xl p-6 shadow-sm space-y-6">
              <div className="flex items-start gap-5">
                <div className="w-16 h-20 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600 shrink-0 shadow-inner">
                  <FileText className="w-9 h-9" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-lg font-bold text-[#0f172a] truncate max-w-[340px]">
                      {documentInfo.filename || 'Unknown Document'}
                    </span>
                    <span className="bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded-md text-xs font-bold">
                      v{documentInfo.version || 1}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-xs text-slate-500 font-medium">Status:</span>
                    <span className="bg-emerald-100 text-emerald-800 px-3 py-0.5 rounded-full text-xs font-semibold">
                      Processed
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 mt-2 font-medium">
                    Pages: <strong className="text-slate-800">{documentInfo.pages || 0}</strong>
                    <span className="mx-2 text-slate-300">•</span>
                    Chunks: <strong className="text-slate-800">{documentInfo.chunks || 0}</strong>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setSelectedTab('Documents')}
                className="w-full h-11 bg-[#1e293b] hover:bg-slate-900 text-white font-semibold rounded-lg text-sm transition-colors flex items-center justify-center gap-2 shadow-sm"
              >
                <span>View Document Details</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="bg-white border border-[#e2e8f0] rounded-xl p-10 text-center shadow-sm">
              <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 mx-auto flex items-center justify-center mb-3">
                <FileText className="w-6 h-6" />
              </div>
              <div className="text-sm font-semibold text-slate-700">No active document</div>
              <div className="text-xs text-slate-400 mt-1">
                Upload a PDF document to get started
              </div>
              <button
                onClick={() => setSelectedTab('Documents')}
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-[#1e293b] text-white text-xs font-semibold rounded-lg hover:bg-slate-900 transition-colors"
              >
                Go to Documents
              </button>
            </div>
          )}
        </div>

        {/* Recent Activity (5 cols) */}
        <div className="lg:col-span-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-[#0f172a]">Recent Activity</h2>
            <div className="flex items-center gap-2">
              <button
                onClick={handleRefresh}
                title="Refresh activity logs"
                className="p-1.5 rounded-lg border border-[#e2e8f0] text-slate-600 hover:bg-slate-50 transition-colors"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${logsLoading ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={() => setSelectedTab('Settings')}
                title="View all audit logs"
                className="text-xs font-semibold text-slate-600 hover:text-slate-900 px-2.5 py-1 rounded-lg border border-[#e2e8f0] hover:bg-slate-50 transition-colors"
              >
                All Logs
              </button>
            </div>
          </div>

          <div className="bg-white border border-[#e2e8f0] rounded-xl p-5 shadow-sm space-y-4">
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
                        className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${color}`}
                      >
                        <EventIcon className="w-4 h-4" />
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
                No recent activity.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
