import { useApp } from '../context/AppContext';
import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import { Briefcase, ChevronDown, Menu, CheckCircle2, AlertCircle, LoaderCircle } from 'lucide-react';

export default function Header({ onMobileMenuToggle, mobileMenuOpen }) {
  const {
    projects,
    currentProjectId,
    switchProject,
    selectedTab,
  } = useApp();
  const [health, setHealth] = useState({ state: 'checking' });

  const refreshHealth = useCallback(async () => {
    try {
      const result = await api.getHealth();
      setHealth({
        state: !result.apiReady ? 'unavailable' : result.llm?.ready ? 'ready' : 'ai-unavailable',
      });
    } catch {
      setHealth({ state: 'unavailable' });
    }
  }, []);

  useEffect(() => {
    refreshHealth();
    const timer = window.setInterval(refreshHealth, 60000);
    return () => window.clearInterval(timer);
  }, [refreshHealth]);

  const healthDisplay = {
    checking: { text: 'Checking', className: 'bg-slate-50 border-slate-200 text-slate-600', icon: LoaderCircle },
    ready: { text: 'AI ready', className: 'bg-emerald-50 border-emerald-200 text-emerald-800', icon: CheckCircle2 },
    'ai-unavailable': { text: 'AI unavailable', className: 'bg-amber-50 border-amber-200 text-amber-900', icon: AlertCircle },
    unavailable: { text: 'API unavailable', className: 'bg-rose-50 border-rose-200 text-rose-800', icon: AlertCircle },
  }[health.state];
  const HealthIcon = healthDisplay.icon;

  return (
    <header className="min-h-16 bg-white border-b border-[#e2e8f0] px-3 sm:px-6 lg:px-8 flex items-center justify-between sticky top-0 z-20">
      {/* Left: Mobile Menu Button & Breadcrumb */}
      <div className="flex min-w-0 flex-1 items-center gap-2.5 sm:flex-none sm:gap-3">
        <button
          onClick={onMobileMenuToggle}
          className="md:hidden shrink-0 p-2 rounded-md border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors"
          aria-label="Toggle navigation menu"
          aria-expanded={mobileMenuOpen}
          aria-controls={mobileMenuOpen ? 'mobile-workspace-navigation' : undefined}
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="hidden sm:flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-md bg-slate-100 flex items-center justify-center text-slate-700">
            <Briefcase className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Workspace
            </div>
            <div className="relative">
              <select
                value={currentProjectId || ''}
                onChange={(e) => switchProject(Number(e.target.value))}
                className="text-xs sm:text-sm font-semibold text-[#0f172a] bg-transparent hover:bg-slate-50 py-0.5 pr-6 rounded cursor-pointer appearance-none outline-none focus:ring-1 focus:ring-slate-300 transition-colors"
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name === 'AUTOSAR Demo' ? 'Main Workspace' : p.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-0 top-1.5 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Mobile current page title */}
        <div className="sm:hidden min-w-0 flex-1 font-semibold text-[13px] text-slate-900 truncate">
          {selectedTab}
        </div>
        {projects.length > 0 && <select
          value={currentProjectId || ''}
          onChange={(event) => switchProject(Number(event.target.value))}
          className="sm:hidden h-9 max-w-[112px] shrink-0 rounded-md border border-slate-200 bg-white px-2 text-[11px] font-semibold text-slate-700 focus:border-blue-600"
          aria-label="Select workspace"
        >
          {projects.map((project) => <option key={project.id} value={project.id}>{project.name === 'AUTOSAR Demo' ? 'Main Workspace' : project.name}</option>)}
        </select>}
      </div>

      {/* Live model health. The API reports HTTP 503 when its local model is unavailable. */}
      <div className="flex items-center gap-3">
        <div role="status" aria-live="polite" className={`hidden md:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-[11px] font-semibold ${healthDisplay.className}`}>
          <HealthIcon className={`w-3.5 h-3.5 ${health.state === 'checking' ? 'animate-spin' : ''}`} />
          <span>{healthDisplay.text}</span>
        </div>
      </div>
    </header>
  );
}
