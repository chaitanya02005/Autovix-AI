import React from 'react';
import { useApp } from '../context/AppContext';
import {
  Home,
  FileText,
  MessageSquare,
  ArrowLeftRight,
  Settings,
  Briefcase,
  Network,
  Shield,
  FileCheck2,
  ClipboardCheck,
  X,
} from 'lucide-react';

export default function Sidebar({ mobileOpen, onCloseMobile }) {
  const { selectedTab, setSelectedTab, currentProject } = useApp();

  const navItems = [
    { id: 'Dashboard', label: 'Dashboard', icon: Home },
    { id: 'Documents', label: 'Documents', icon: FileText },
    { id: 'Architecture Entity Recognition', label: 'Architecture Entity Recognition', icon: Network },
    { id: 'Review Queue', label: 'Review Queue', icon: ClipboardCheck },
    { id: 'Ask AI', label: 'Ask AI', icon: MessageSquare },
    { id: 'Compare Versions', label: 'Compare Versions', icon: ArrowLeftRight },
    { id: 'Settings', label: 'Settings', icon: Settings },
  ];

  const legalItems = [
    { id: 'Privacy Policy', label: 'Privacy Policy', icon: Shield },
    { id: 'Terms and Conditions', label: 'Terms & Conditions', icon: FileCheck2 },
  ];

  const handleSelect = (tabId) => {
    setSelectedTab(tabId);
    if (onCloseMobile) {
      onCloseMobile();
    }
  };

  const sidebarContent = (
    <div className="flex flex-col h-full bg-[#0b1120] text-slate-200 select-none border-r border-[#1e293b]">
      {/* Brand Header */}
      <div className="flex items-center justify-between px-5 py-5 border-b border-[#1e293b]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-md bg-white text-[#0b1120] font-extrabold text-base flex items-center justify-center shrink-0 shadow-xs">
            A
          </div>
          <div className="flex flex-col justify-center leading-tight">
            <span className="text-[15px] font-bold text-white tracking-tight">Autovix</span>
            <span className="text-[11px] text-slate-400 font-normal">Architecture Intelligence</span>
          </div>
        </div>

        {/* Mobile close button */}
        {mobileOpen && (
          <button
            onClick={onCloseMobile}
            className="md:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            aria-label="Close navigation"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Main Nav Items */}
      <div className="px-3 py-4 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
        Workspace Views
      </div>
      <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = selectedTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => handleSelect(item.id)}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-semibold transition-colors text-left ${
                isActive
                  ? 'bg-[#1e293b] text-white border-l-[3px] border-blue-500 shadow-xs'
                  : 'text-slate-400 hover:text-white hover:bg-white/5 border-l-[3px] border-transparent'
              }`}
            >
              <Icon
                className={`w-4 h-4 shrink-0 transition-colors ${
                  isActive ? 'text-blue-400' : 'text-slate-500'
                }`}
              />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}

        <div className="pt-5 pb-2 px-1 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
          Documentation & Legal
        </div>
        {legalItems.map((item) => {
          const Icon = item.icon;
          const isActive = selectedTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => handleSelect(item.id)}
              className={`w-full flex items-center gap-3 px-3.5 py-2 rounded-lg text-xs font-medium transition-colors text-left ${
                isActive
                  ? 'bg-[#1e293b] text-white border-l-[3px] border-blue-500 shadow-xs'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5 border-l-[3px] border-transparent'
              }`}
            >
              <Icon className="w-3.5 h-3.5 shrink-0 text-slate-500" />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Workspace Footer Card */}
      <div className="p-3 border-t border-[#1e293b] bg-black/30 m-3 rounded-lg text-xs">
        <div className="flex items-center gap-2.5 text-slate-400">
          <Briefcase className="w-3.5 h-3.5 text-blue-400 shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="text-[10px] uppercase font-semibold text-slate-500 tracking-wider">Active Workspace</div>
            <div className="truncate font-medium text-slate-200">
              {currentProject ? (currentProject.name === 'AUTOSAR Demo' ? 'Main Workspace' : currentProject.name) : 'Workspace'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sticky Sidebar */}
      <aside className="hidden md:flex w-64 min-w-[256px] max-w-[256px] flex-col h-screen sticky top-0 z-30 shrink-0">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer Overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <div className="relative w-72 max-w-[85vw] h-full shadow-2xl z-10">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
}
