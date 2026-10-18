import { useEffect, useState } from 'react';
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
import ReviewQueue from './pages/ReviewQueue';
import PrivacyPolicy from './pages/PrivacyPolicy';
import TermsAndConditions from './pages/TermsAndConditions';

export default function App() {
  const { selectedTab, loading } = useApp();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const pageTitles = {
      Dashboard: 'Workspace overview',
      Documents: 'Documents and specifications',
      'Architecture Entity Recognition': 'Architecture entities',
      'Review Queue': 'Review queue',
      'Ask AI': 'Ask AI',
      'Compare Versions': 'Compare versions',
      Settings: 'Workspace settings',
      'Privacy Policy': 'Privacy policy',
      'Terms and Conditions': 'Terms and conditions',
    };
    const pageDescriptions = {
      Dashboard: 'Project counts, document status, activity analytics, and recent workspace events.',
      Documents: 'Upload, search, inspect, and manage AUTOSAR architecture documents and their versions.',
      'Architecture Entity Recognition': 'Review architecture entities extracted from project documents and export findings.',
      'Review Queue': 'Review extracted entities and submitted answers, and manage document sign-off.',
      'Ask AI': 'Ask questions about indexed project documents and inspect cited source passages.',
      'Compare Versions': 'Compare architecture records between document versions.',
      Settings: 'Manage project workspaces and inspect audit history and system status.',
      'Privacy Policy': 'How the Autovix deployment processes workspace documents and account data.',
      'Terms and Conditions': 'Terms for using the Autovix document workspace.',
    };
    const title = pageTitles[selectedTab] || pageTitles.Dashboard;
    document.title = `${title} | Autovix`;
    document.querySelector('meta[name="description"]')?.setAttribute('content', pageDescriptions[selectedTab] || pageDescriptions.Dashboard);
    document.querySelector('meta[property="og:title"]')?.setAttribute('content', `${title} | Autovix`);
    document.querySelector('meta[property="og:description"]')?.setAttribute('content', pageDescriptions[selectedTab] || pageDescriptions.Dashboard);
    document.querySelector('meta[name="twitter:title"]')?.setAttribute('content', `${title} | Autovix`);
    document.querySelector('meta[name="twitter:description"]')?.setAttribute('content', pageDescriptions[selectedTab] || pageDescriptions.Dashboard);
  }, [selectedTab]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F5F7FA] flex flex-col items-center justify-center gap-4">
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
      case 'Review Queue':
        return <ReviewQueue />;
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
    <div className="min-h-screen flex bg-[#F5F7FA]">
      <a href="#main-content" className="skip-link">Skip to content</a>
      {/* Sidebar with Desktop & Mobile Drawer */}
      <Sidebar
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      {/* Main Container */}
      <div className="flex-1 flex flex-col min-w-0">
        <Header
          mobileMenuOpen={mobileMenuOpen}
          onMobileMenuToggle={() => setMobileMenuOpen((prev) => !prev)}
        />
        <main id="main-content" tabIndex={-1} className="flex-1 max-w-[1440px] w-full mx-auto p-4 sm:p-6 lg:p-8 xl:p-10">
          {renderContent()}
        </main>
        <Footer />
      </div>

      {/* Toast Notifications */}
      <Toast />
    </div>
  );
}
