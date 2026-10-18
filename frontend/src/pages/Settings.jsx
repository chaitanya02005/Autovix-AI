import { useState, useEffect, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { api } from '../api';
import {
  Briefcase,
  Plus,
  RefreshCw,
  Server,
  Bot,
  CheckCircle2,
  XCircle,
  ShieldAlert,
  Clock,
  Layers
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
  const [systemHealth, setSystemHealth] = useState({ loading: true, data: null });

  // Fetch Audit Logs
  const fetchAuditLogs = useCallback(async () => {
    if (!currentProjectId) return;
    setLogsLoading(true);
    try {
      const data = await api.getAuditLogs(currentProjectId, 100);
      setLogs(data || []);
    } catch (err) {
      console.error('Failed to load audit logs:', err);
      addToast('Failed to load audit logs: ' + err.message, 'error');
    } finally {
      setLogsLoading(false);
    }
  }, [currentProjectId, addToast]);

  useEffect(() => {
    if (activeTab === 'audit') {
      fetchAuditLogs();
    }
  }, [activeTab, fetchAuditLogs]);

  useEffect(() => {
    if (activeTab !== 'system') return undefined;
    let active = true;
    api.getHealth()
      .then((data) => { if (active) setSystemHealth({ loading: false, data }); })
      .catch(() => { if (active) setSystemHealth({ loading: false, data: null }); });
    return () => { active = false; };
  }, [activeTab]);

  // Handle Create Workspace
  const handleCreateProject = async (e) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;

    setCreatingProject(true);
    try {
      const newProj = await api.createProject(newProjectName.trim());
      addToast(`Workspace '${newProjectName}' created successfully.`, 'success');
      setNewProjectName('');
      await refreshProjects();
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
  const eventTypes = [...new Set(logs.map((log) => log.event_type).filter(Boolean))].sort();

  return (
    <div className="space-y-8 fade-in">
      {/* Header */}
      <div className="pb-2 border-b border-slate-200">
        <h1 className="text-2xl font-bold tracking-tight text-[#0f172a]">Workspace settings</h1>
        <p className="text-sm text-slate-500 mt-1">
          Manage project workspaces, review audit activity, and check API and model availability.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200">
        <button
          onClick={() => setActiveTab('workspace')}
          className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
            activeTab === 'workspace'
              ? 'border-[#0f172a] text-[#0f172a]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Workspaces
        </button>
        <button
          onClick={() => setActiveTab('audit')}
          className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
            activeTab === 'audit'
              ? 'border-[#0f172a] text-[#0f172a]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Audit History
        </button>
        <button
          onClick={() => setActiveTab('system')}
          className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
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
            <div className="bg-white border border-[#e2e8f0] rounded-xl p-6 shadow-xs space-y-4">
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Current Active Workspace
              </div>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
                  <Briefcase className="w-6 h-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-base font-bold text-[#0f172a] truncate">
                    {currentProject?.name === 'AUTOSAR Demo' ? 'Main Workspace' : (currentProject?.name || 'Main Workspace')}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    Workspace ID: #{currentProjectId || 1}
                  </div>
                </div>
                <span className="bg-slate-100 border border-slate-200 text-slate-700 text-xs font-semibold px-2.5 py-0.5 rounded">
                  Active
                </span>
              </div>
            </div>

            {/* Switch Workspace */}
            <div className="bg-white border border-[#e2e8f0] rounded-xl p-6 shadow-xs space-y-3">
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Switch Project Workspace
              </div>
              <p className="text-xs text-slate-500">
                Switching workspaces reloads documents, vector indexes, and entity catalogs for that project.
              </p>
              <select
                aria-label="Switch project workspace"
                value={currentProjectId || ''}
                onChange={(e) => switchProject(Number(e.target.value))}
                className="w-full h-10 px-3 text-xs bg-white border border-[#e2e8f0] rounded-lg shadow-xs focus:outline-none focus:ring-1 focus:ring-slate-400 font-medium text-slate-800 cursor-pointer"
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
            <div className="bg-white border border-[#e2e8f0] rounded-xl p-6 shadow-xs space-y-4">
          <div>
                <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Create Isolated Workspace
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Create a new project workspace to isolate another vehicle architecture or ECU subsystem.
                </p>
              </div>

              <form onSubmit={handleCreateProject} className="space-y-3">
                <input
                  id="new-workspace-name"
                  type="text"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  placeholder="e.g. Powertrain Domain Controller"
                  aria-label="New workspace name"
                  maxLength={120}
                  className="w-full h-10 px-3 text-xs bg-white border border-[#e2e8f0] rounded-lg shadow-xs focus:outline-none focus:ring-1 focus:ring-slate-400"
                />
                <button
                  type="submit"
                  disabled={creatingProject || !newProjectName.trim()}
                  className="w-full h-10 bg-[#0f172a] hover:bg-slate-800 disabled:bg-slate-300 text-white font-semibold rounded-lg text-xs transition-colors flex items-center justify-center gap-1.5 shadow-xs"
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
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <h2 className="text-base font-bold text-[#0f172a]">
              Workspace Audit Trail
            </h2>
            <div className="flex items-center gap-3">
              <select
                aria-label="Filter audit log by event type"
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="h-9 px-3 text-xs bg-white border border-[#e2e8f0] rounded-lg shadow-xs focus:outline-none text-slate-700 font-medium cursor-pointer"
              >
                <option value="All Events">All Events</option>
                {eventTypes.map((eventType) => <option key={eventType} value={eventType}>{eventType.replaceAll('_', ' ')}</option>)}
              </select>

              <button
                onClick={fetchAuditLogs}
                className="h-9 px-3 bg-white border border-[#e2e8f0] hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-xs"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${logsLoading ? 'animate-spin' : ''}`} />
                <span>Refresh Logs</span>
              </button>
            </div>
          </div>

          {/* Audit Logs Table */}
          {filteredLogs.length > 0 ? (
            <div className="bg-white border border-[#e2e8f0] rounded-xl overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                      <th className="py-3 px-4 whitespace-nowrap">Timestamp</th>
                      <th className="py-3 px-4">Action</th>
                      <th className="py-3 px-4">Resource / Query</th>
                      <th className="py-3 px-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredLogs.map((lg, idx) => {
                      const status = lg.status || 'success';
                      let res = 'None';
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
                          <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                            {ts}
                          </td>
                          <td className="py-3 px-4 font-semibold text-[#0f172a]">
                            {lg.event_type}
                          </td>
                          <td className="py-3 px-4 text-slate-600 max-w-xs truncate">
                            {res}
                          </td>
                          <td className="py-3 px-4">
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
            <div className="bg-white border border-[#e2e8f0] rounded-xl p-10 text-center shadow-xs">
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
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 fade-in">
          <section className="rounded-lg border border-slate-200 bg-white p-5 sm:p-6">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Backend API</div>
            <div className="mt-4 flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-700"><Server className="h-5 w-5" /></div>
              <div><h3 className="text-sm font-bold text-slate-900">Autovix API</h3><p className="mt-0.5 text-xs text-slate-500">{systemHealth.loading ? 'Checking connection' : systemHealth.data?.apiReady ? 'Responding to health checks' : 'No response from health check'}</p></div>
            </div>
            {!systemHealth.loading && <p className={`mt-4 inline-flex rounded-md border px-2.5 py-1 text-xs font-semibold ${systemHealth.data?.apiReady ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-rose-200 bg-rose-50 text-rose-800'}`}>{systemHealth.data?.apiReady ? 'Available' : 'Unavailable'}</p>}
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-5 sm:p-6">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">AI model service</div>
            <div className="mt-4 flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-700"><Bot className="h-5 w-5" /></div>
              <div className="min-w-0"><h3 className="text-sm font-bold text-slate-900">{systemHealth.data?.llm?.provider || 'Configured model'}</h3><p className="mt-0.5 truncate text-xs text-slate-500">{systemHealth.data?.llm?.model || 'Model details unavailable'}</p></div>
            </div>
            {!systemHealth.loading && <p className={`mt-4 inline-flex rounded-md border px-2.5 py-1 text-xs font-semibold ${systemHealth.data?.llm?.ready ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-900'}`}>{systemHealth.data?.llm?.ready ? 'Ready' : 'Unavailable'}</p>}
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-5 sm:p-6">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Workspace data</div>
            <div className="mt-4 flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-700"><Layers className="h-5 w-5" /></div>
              <div><h3 className="text-sm font-bold text-slate-900">Project records and indexes</h3><p className="mt-0.5 text-xs text-slate-500">Stored by the API deployment</p></div>
            </div>
            <p className="mt-4 text-xs leading-relaxed text-slate-500">Storage paths, backups, and retention depend on the server operator’s configuration.</p>
          </section>
        </div>
      )}
    </div>
  );
}
