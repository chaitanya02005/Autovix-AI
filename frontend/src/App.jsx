import React from 'react';
import { useApp } from './context/AppContext';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import Toast from './components/Toast';

import Dashboard from './pages/Dashboard';
import Documents from './pages/Documents';
import AskAI from './pages/AskAI';
import Relationships from './pages/Relationships';
import CompareVersions from './pages/CompareVersions';
import Settings from './pages/Settings';

export default function App() {
  const { selectedTab, loading } = useApp();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center gap-4">
        <div className="w-10 h-10 border-3 border-slate-900 border-t-transparent rounded-full animate-spin"></div>
        <div className="text-sm font-semibold text-slate-700">Connecting to Autovix…</div>
      </div>
    );
  }

  const renderContent = () => {
    switch (selectedTab) {
      case 'Dashboard':
        return <Dashboard />;
      case 'Documents':
        return <Documents />;
      case 'Ask AI':
        return <AskAI />;
      case 'Relationships':
        return <Relationships />;
      case 'Compare Versions':
        return <CompareVersions />;
      case 'Settings':
        return <Settings />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="min-h-screen flex bg-[#F8FAFC]">
      {/* Sidebar */}
      <Sidebar />

      {/* Main Container */}
      <div className="flex-1 flex flex-col min-w-0">
        <Header />
        <main className="flex-1 max-w-[1160px] w-full mx-auto p-6 md:p-10">
          {renderContent()}
        </main>
      </div>

      {/* Toast Notifications */}
      <Toast />
    </div>
  );
}
