import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { api } from '../api';
import {
  Briefcase,
  Plus,
  RefreshCw,
  Server,
  Cpu,
  Bot,
  CheckCircle2,
  XCircle,
  ShieldAlert,
  Clock
} from 'lucide-react';

export default function Settings() {
  const {
    user,
    projects,
    currentProjectId,
    currentProject,
    switchProject,
    refreshProjects,
    addToast,
  } = useApp();

  const [activeTab, setActiveTab] = useState('workspace');
  const [newProjectName, setNewProjectName] = useState('');
  const [creatingProject, setCreatingProject] = useState(false);

  // Audit Logs State
  const [logs, setLogs] = useState([]);
  const [filterType, setFilterType] = useState('All Events');
  const [logsLoading, setLogsLoading] = useState(false);

  const isAdmin = user?.role === 'admin';

  // Fetch Audit Logs
  const fetchAuditLogs = useCallback(async () => {
    if (!currentProjectId) return;
    setLogsLoading(true);
    try {
      const data = await api.getAuditLogs(currentProjectId, 100);
      setLogs(data || []);
    } catch (err) {
      console.error('Failed to load audit logs:', err);
      addToast('Failed to load audit logs', 'error');
    } finally {
      setLogsLoading(false);
    }
  }, [currentProjectId, addToast]);

  useEffect(() => {
    if (activeTab === 'audit') {
      fetchAuditLogs();
    }
  }, [activeTab, fetchAuditLogs]);

  // Handle Create Workspace
  const handleCreateProject = async (e) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;

    setCreatingProject(true);
    try {
      const newProj = await api.createProject(newProjectName.trim());
      addToast(`Workspace '${newProjectName}' created.`, 'success');
      setNewProjectName('');
      const updated = await refreshProjects();
      if (newProj && newProj.id) {
        switchProject(newProj.id);
      }
    } catch (err) {
      console.error('Failed to create project:', err);
      addToast(`Error: ${err.message}`, 'error');
    } finally {
      setCreatingProject(false);
    }
  };

  // Filtered Logs
  const filteredLogs = logs.filter((lg) => {
    if (filterType === 'All Events') return true;
    return lg.event_type === filterType;
  });

  return (
    <div className="space-y-8 fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[#0f172a]">Settings</h1>
        <p className="text-sm text-slate-500 mt-1">
          Manage your workspace, audit history, and system configuration.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200">
        <button
          onClick={() => setActiveTab('workspace')}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === 'workspace'
              ? 'border-[#0f172a] text-[#0f172a]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Workspace
        </button>
        <button
          onClick={() => setActiveTab('audit')}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === 'audit'
              ? 'border-[#0f172a] text-[#0f172a]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Audit Logs
        </button>
        <button
          onClick={() => setActiveTab('system')}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === 'system'
              ? 'border-[#0f172a] text-[#0f172a]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          System Info
        </button>
      </div>

      {/* Tab: Workspace */}
      {activeTab === 'workspace' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 fade-in">
          {/* Col 1: Current Workspace & Switch */}
          <div className="space-y-6">
            {/* Current Workspace Card */}
            <div className="bg-white border border-[#e2e8f0] rounded-xl p-6 shadow-sm space-y-4">
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Current Workspace
              </div>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
                  <Briefcase className="w-6 h-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-base font-bold text-[#0f172a] truncate">
                    {currentProject?.name === 'AUTOSAR Demo' ? 'Main Workspace' : (currentProject?.name || 'Main Workspace')}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    Active Workspace
                  </div>
                </div>
                <span className="bg-slate-100 text-slate-700 text-xs font-semibold px-2.5 py-0.5 rounded-full">
                  Active
                </span>
              </div>
            </div>

            {/* Switch Workspace */}
            <div className="bg-white border border-[#e2e8f0] rounded-xl p-6 shadow-sm space-y-3">
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Switch Workspace
              </div>
              <p className="text-xs text-slate-500">
                Select the workspace you want to work in.
              </p>
              <select
                value={currentProjectId || ''}
                onChange={(e) => switchProject(Number(e.target.value))}
                className="w-full h-10 px-3 text-sm bg-white border border-[#e2e8f0] rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-300 font-medium text-slate-800 cursor-pointer"
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name === 'AUTOSAR Demo' ? 'Main Workspace' : p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Col 2: Create Workspace */}
          <div className="space-y-6">
            <div className="bg-white border border-[#e2e8f0] rounded-xl p-6 shadow-sm space-y-4">
              <div>
                <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Create New Workspace
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Create a separate workspace for another project.
                </p>
              </div>

              <form onSubmit={handleCreateProject} className="space-y-3">
                <input
                  type="text"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  placeholder="Enter workspace name"
                  className="w-full h-10 px-3 text-sm bg-white border border-[#e2e8f0] rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
                />
                <button
                  type="submit"
                  disabled={creatingProject || !newProjectName.trim()}
                  className="w-full h-10 bg-[#1e293b] hover:bg-slate-900 disabled:bg-slate-300 text-white font-semibold rounded-lg text-xs transition-colors flex items-center justify-center gap-1.5 shadow-sm"
                >
                  <Plus className="w-4 h-4" />
                  <span>Create Workspace</span>
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Audit Logs */}
      {activeTab === 'audit' && (
        <div className="space-y-4 fade-in">
          {/* Top Controls */}
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <h2 className="text-base font-semibold text-[#0f172a]">
              Workspace Audit History
            </h2>
            <div className="flex items-center gap-3">
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="h-9 px-3 text-xs bg-white border border-[#e2e8f0] rounded-lg shadow-sm focus:outline-none text-slate-700 font-medium cursor-pointer"
              >
                <option value="All Events">All Events</option>
                <option value="QUESTION_ASKED">QUESTION_ASKED</option>
                <option value="SEARCH">SEARCH</option>
                <option value="DOCUMENT_UPLOADED">DOCUMENT_UPLOADED</option>
                <option value="DOCUMENT_DELETED">DOCUMENT_DELETED</option>
                <option value="COMPARISON_RUN">COMPARISON_RUN</option>
                <option value="PROJECT_CREATED">PROJECT_CREATED</option>
              </select>

              <button
                onClick={fetchAuditLogs}
                className="h-9 px-3 bg-white border border-[#e2e8f0] hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-sm"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${logsLoading ? 'animate-spin' : ''}`} />
                <span>Refresh Logs</span>
              </button>
            </div>
          </div>

          {/* Audit Logs Table */}
          {filteredLogs.length > 0 ? (
            <div className="bg-white border border-[#e2e8f0] rounded-xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="bg-[#F6F6F6] border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                      <th className="py-3 px-5 whitespace-nowrap">Timestamp</th>
                      <th className="py-3 px-5">Action</th>
                      <th className="py-3 px-5">Resource / Query</th>
                      <th className="py-3 px-5">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredLogs.map((lg, idx) => {
                      const status = lg.status || 'success';
                      let res = '—';
                      if (lg.question) {
                        res =
                          lg.question.length > 35
                            ? `"${lg.question.substring(0, 35)}..."`
                            : `"${lg.question}"`;
                      } else if (lg.document_name) {
                        res = lg.document_name;
                      } else if (lg.details) {
                        if (lg.details.query) res = `Query: "${lg.details.query}"`;
                        else if (lg.details.target) res = `Target: ${lg.details.target}`;
                        else if (lg.details.document_id) res = String(lg.details.document_id);
                        else if (['LOGIN', 'LOGOUT'].includes(lg.event_type)) res = 'System';
                      }

                      const ts = String(lg.timestamp || '')
                        .substring(0, 19)
                        .replace('T', ' ');

                      return (
                        <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3.5 px-5 text-xs text-slate-500 whitespace-nowrap">
                            {ts}
                          </td>
                          <td className="py-3.5 px-5 font-semibold text-[#0f172a] text-xs">
                            {lg.event_type}
                          </td>
                          <td className="py-3.5 px-5 text-xs text-slate-600 max-w-xs truncate">
                            {res}
                          </td>
                          <td className="py-3.5 px-5 text-xs">
                            {status === 'success' ? (
                              <span className="text-emerald-700 font-semibold inline-flex items-center gap-1.5">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                Success
                              </span>
                            ) : status === 'error' ? (
                              <span className="text-rose-700 font-semibold inline-flex items-center gap-1.5">
                                <XCircle className="w-3.5 h-3.5 text-rose-600" />
                                Error
                              </span>
                            ) : (
                              <span className="text-amber-700 font-semibold inline-flex items-center gap-1.5">
                                <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
                                Denied
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="bg-white border border-[#e2e8f0] rounded-xl p-10 text-center shadow-sm">
              <Clock className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <div className="text-sm font-semibold text-slate-700">No audit activity found</div>
              <div className="text-xs text-slate-400 mt-1">
                Actions matching this filter will appear here.
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab: System Info */}
      {activeTab === 'system' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 fade-in">
          {/* Card 1: System Status */}
          <div className="bg-white border border-[#e2e8f0] rounded-xl p-6 shadow-sm space-y-4">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              System Status
            </div>
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
                <Server className="w-5 h-5" />
              </div>
              <div>
                <div className="text-sm font-bold text-[#0f172a]">Application</div>
                <div className="text-xs text-slate-500">v1.2.0-enterprise</div>
              </div>
            </div>
            <div>
              <span className="bg-slate-100 text-slate-800 text-xs font-semibold px-3 py-1 rounded-md inline-flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                Operational
              </span>
            </div>
          </div>

          {/* Card 2: Document Engine */}
          <div className="bg-white border border-[#e2e8f0] rounded-xl p-6 shadow-sm space-y-4">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Document Engine
            </div>
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
                <Cpu className="w-5 h-5" />
              </div>
              <div>
                <div className="text-sm font-bold text-[#0f172a]">Processing Pipeline</div>
                <div className="text-xs text-slate-500">Chunk: 1000 · Overlap: 200</div>
              </div>
            </div>
            <div>
              <span className="bg-slate-100 text-slate-800 text-xs font-semibold px-3 py-1 rounded-md inline-flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                Ready
              </span>
            </div>
          </div>

          {/* Card 3: AI / RAG Model */}
          <div className="bg-white border border-[#e2e8f0] rounded-xl p-6 shadow-sm space-y-4">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              AI / RAG Model
            </div>
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
                <Bot className="w-5 h-5" />
              </div>
              <div>
                <div className="text-sm font-bold text-[#0f172a]">llama-3.1-70b</div>
                <div className="text-xs text-slate-500">Provider: Groq</div>
              </div>
            </div>
            <div>
              <span className="bg-slate-100 text-slate-800 text-xs font-semibold px-3 py-1 rounded-md inline-flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                Connected
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
