import React from 'react';
import { useApp } from '../context/AppContext';
import {
  Home,
  FileText,
  MessageSquare,
  Share2,
  ArrowLeftRight,
  Settings,
  Shield,
  Briefcase
} from 'lucide-react';

export default function Sidebar() {
  const { selectedTab, setSelectedTab, currentProject, currentRole, user } = useApp();

  const navItems = [
    { id: 'Dashboard', label: 'Dashboard', icon: Home },
    { id: 'Documents', label: 'Documents', icon: FileText },
    { id: 'Ask AI', label: 'Ask AI', icon: MessageSquare },
    { id: 'Relationships', label: 'Relationships', icon: Share2 },
    { id: 'Compare Versions', label: 'Compare Versions', icon: ArrowLeftRight },
    { id: 'Settings', label: 'Settings', icon: Settings },
  ];

  return (
    <aside className="w-64 min-w-[260px] max-w-[260px] bg-[#0b1120] bg-[radial-gradient(circle_at_bottom_left,#1e3a8a_0%,transparent_40%)] border-r border-[#1e293b] flex flex-col h-screen select-none shrink-0 sticky top-0 z-30">
      {/* Brand Header */}
      <div className="flex items-center gap-3 px-5 py-6 border-b border-[#1e293b] mb-3">
        <div className="bg-white text-[#0b1120] w-8 h-8 rounded-md flex items-center justify-center font-extrabold text-base shrink-0 shadow-sm">
          A
        </div>
        <div className="flex flex-col justify-center leading-tight">
          <span className="text-[15px] font-bold text-[#f8fafc] tracking-tight">Autovix</span>
          <span className="text-[11px] text-[#94a3b8] font-normal">AUTOSAR Intelligence</span>
        </div>
      </div>

      {/* Nav Menu Items */}
      <nav className="flex-1 px-3 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = selectedTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setSelectedTab(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm transition-all duration-150 text-left font-medium ${
                isActive
                  ? 'bg-[#1e3a8a] text-white border-l-[3px] border-[#3b82f6] shadow-sm font-semibold'
                  : 'text-[#cbd5e1] hover:text-white hover:bg-white/5 border-l-[3px] border-transparent'
              }`}
            >
              <Icon
                className={`w-4 h-4 shrink-0 transition-colors ${
                  isActive ? 'text-white' : 'text-[#94a3b8]'
                }`}
              />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Workspace Footer */}
      <div className="p-3.5 border-t border-[#1e293b] bg-black/20 mx-3 mb-4 rounded-xl text-xs">
        <div className="flex items-center gap-2.5 text-[#94a3b8]">
          <Briefcase className="w-3.5 h-3.5 text-blue-400 shrink-0" />
          <span className="truncate font-medium text-slate-300">
            {currentProject ? currentProject.name : 'Workspace'}
          </span>
        </div>
      </div>
    </aside>
  );
}
