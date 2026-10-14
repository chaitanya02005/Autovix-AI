import React from 'react';
import { useApp } from '../context/AppContext';
import { Briefcase, FileCheck, ChevronDown, Check } from 'lucide-react';

export default function Header() {
  const {
    projects,
    currentProjectId,
    currentProject,
    currentRole,
    switchProject,
    documentReady,
    documentInfo,
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
                    {p.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-0 top-1.5 pointer-events-none" />
            </div>
          </div>
        </div>
      </div>

      {/* Active Document Status Badge */}
      <div className="flex items-center gap-3">
        {documentReady && documentInfo ? (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200/60 text-emerald-800 text-xs font-medium shadow-sm">
            <FileCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span className="font-semibold truncate max-w-[220px]">
              {documentInfo.filename}
            </span>
            <span className="text-[10px] bg-emerald-200/60 px-1.5 py-0.5 rounded text-emerald-900 font-bold">
              v{documentInfo.version || 1}
            </span>
          </div>
        ) : (
          <div className="text-xs text-slate-400 font-medium flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-slate-300"></span>
            No active document
          </div>
        )}
      </div>
    </header>
  );
}
