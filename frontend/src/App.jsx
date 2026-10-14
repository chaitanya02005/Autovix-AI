import React, { useState } from 'react';
import { useApp } from './context/AppContext';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import Footer from './components/Footer';
import Toast from './components/Toast';

import Dashboard from './pages/Dashboard';
import Documents from './pages/Documents';
import AskAI from './pages/AskAI';
import CompareVersions from './pages/CompareVersions';
import Settings from './pages/Settings';
import ArchitectureEntityRecognition from './pages/ArchitectureEntityRecognition';
import PrivacyPolicy from './pages/PrivacyPolicy';
import TermsAndConditions from './pages/TermsAndConditions';

export default function App() {
  const { selectedTab, loading } = useApp();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center gap-4">
        <div className="w-10 h-10 border-2 border-slate-900 border-t-transparent rounded-full animate-spin"></div>
        <div className="text-sm font-semibold text-slate-700">Connecting to Autovix workspace...</div>
      </div>
    );
  }

  const renderContent = () => {
    switch (selectedTab) {
      case 'Dashboard':
        return <Dashboard />;
      case 'Documents':
        return <Documents />;
      case 'Architecture Entity Recognition':
        return <ArchitectureEntityRecognition />;
      case 'Ask AI':
        return <AskAI />;
      case 'Compare Versions':
        return <CompareVersions />;
      case 'Settings':
        return <Settings />;
      case 'Privacy Policy':
        return <PrivacyPolicy />;
      case 'Terms and Conditions':
        return <TermsAndConditions />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="min-h-screen flex bg-[#F8FAFC]">
      {/* Sidebar with Desktop & Mobile Drawer */}
      <Sidebar
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      {/* Main Container */}
      <div className="flex-1 flex flex-col min-w-0">
        <Header onMobileMenuToggle={() => setMobileMenuOpen((prev) => !prev)} />
        <main className="flex-1 max-w-[1160px] w-full mx-auto p-4 sm:p-6 md:p-10">
          {renderContent()}
        </main>
        <Footer />
      </div>

      {/* Toast Notifications */}
      <Toast />
    </div>
  );
}
