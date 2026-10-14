import React from 'react';
import { useApp } from '../context/AppContext';
import { Briefcase, ChevronDown, Menu, CheckCircle2 } from 'lucide-react';

export default function Header({ onMobileMenuToggle }) {
  const {
    projects,
    currentProjectId,
    switchProject,
    selectedTab,
  } = useApp();

  return (
    <header className="h-16 bg-white border-b border-[#e2e8f0] px-4 sm:px-8 flex items-center justify-between sticky top-0 z-20 shadow-xs">
      {/* Left: Mobile Menu Button & Breadcrumb */}
      <div className="flex items-center gap-3">
        <button
          onClick={onMobileMenuToggle}
          className="md:hidden p-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors"
          aria-label="Toggle navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="hidden sm:flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700">
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
        <div className="sm:hidden font-bold text-sm text-slate-900 truncate">
          {selectedTab}
        </div>
      </div>

      {/* Right: Operational Status Pill & Workspace Info */}
      <div className="flex items-center gap-3">
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-50 border border-emerald-200/60 text-emerald-800 text-xs font-semibold">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          <span className="hidden sm:inline">Engine:</span>
          <span>Ready</span>
        </div>
      </div>
    </header>
  );
}
