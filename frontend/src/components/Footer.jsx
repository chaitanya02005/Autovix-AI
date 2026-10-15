import { useApp } from '../context/AppContext';
import { Shield, FileText } from 'lucide-react';

export default function Footer() {
  const { setSelectedTab } = useApp();

  return (
    <footer className="mt-16 border-t border-slate-200 bg-white/70 py-8 px-6 text-xs text-slate-500">
      <div className="max-w-[1160px] mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Left: Product & Copyright */}
        <div className="flex flex-col sm:flex-row items-center gap-2 text-center sm:text-left">
          <div className="flex items-center gap-2 font-semibold text-slate-800">
            <span className="w-5 h-5 rounded bg-slate-900 text-white flex items-center justify-center text-[10px] font-bold">
              A
            </span>
            <span>Autovix</span>
          </div>
          <span className="hidden sm:inline text-slate-300">|</span>
          <span>Automotive Architecture Document Intelligence</span>
          <span className="hidden sm:inline text-slate-300">|</span>
          <span>&copy; {new Date().getFullYear()} All rights reserved.</span>
        </div>

        {/* Right: Quick Links */}
        <div className="flex items-center gap-5 flex-wrap justify-center font-medium">
          <button
            onClick={() => setSelectedTab('Privacy Policy')}
            className="hover:text-slate-900 transition-colors flex items-center gap-1"
          >
            <Shield className="w-3.5 h-3.5 text-slate-400" />
            <span>Privacy Policy</span>
          </button>
          <span className="text-slate-300">|</span>
          <button
            onClick={() => setSelectedTab('Terms and Conditions')}
            className="hover:text-slate-900 transition-colors flex items-center gap-1"
          >
            <FileText className="w-3.5 h-3.5 text-slate-400" />
            <span>Terms & Conditions</span>
          </button>
          <span className="text-slate-300">|</span>
          <a
            href="mailto:support@autovix.example.com"
            className="hover:text-slate-900 transition-colors"
          >
            support@autovix.example.com
          </a>
        </div>
      </div>
    </footer>
  );
}
