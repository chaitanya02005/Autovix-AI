import React from 'react';
import { useApp } from '../context/AppContext';
import { Briefcase, ChevronDown } from 'lucide-react';

export default function Header() {
  const {
    projects,
    currentProjectId,
    switchProject,
  } = useApp();

  return (
    <header className="h-16 bg-white border-b border-[#e2e8f0] px-8 flex items-center justify-between sticky top-0 z-20 shadow-sm">
      {/* Workspace Switcher */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700">
            <Briefcase className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Workspace
            </div>
            <div className="relative">
              <select
                value={currentProjectId || ''}
                onChange={(e) => switchProject(Number(e.target.value))}
                className="text-sm font-semibold text-[#0f172a] bg-transparent hover:bg-slate-50 py-0.5 pr-6 rounded cursor-pointer appearance-none outline-none focus:ring-1 focus:ring-slate-300 transition-colors"
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
      </div>
    </header>
  );
}
