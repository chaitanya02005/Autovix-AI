import React from 'react';
import { FileCheck, AlertCircle, Scale, ArrowLeft } from 'lucide-react';
import { useApp } from '../context/AppContext';

export default function TermsAndConditions() {
  const { setSelectedTab } = useApp();

  return (
    <div className="space-y-8 fade-in max-w-4xl">
      {/* Back button & Header */}
      <div>
        <button
          onClick={() => setSelectedTab('Dashboard')}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 mb-4 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Dashboard</span>
        </button>
        <h1 className="text-2xl font-bold tracking-tight text-[#0f172a]">Terms and Conditions</h1>
        <p className="text-sm text-slate-500 mt-1">
          Effective date: October 14, 2026. Please review these terms governing the use of the Autovix platform.
        </p>
      </div>

      {/* Highlights Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-[#e2e8f0] rounded-xl p-4 shadow-sm space-y-2">
          <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center">
            <FileCheck className="w-4 h-4" />
          </div>
          <div className="text-xs font-bold text-[#0f172a]">Your Content & IP</div>
          <div className="text-xs text-slate-500 leading-relaxed">
            You retain all intellectual property rights to your uploaded architecture specifications and designs.
          </div>
        </div>

        <div className="bg-white border border-[#e2e8f0] rounded-xl p-4 shadow-sm space-y-2">
          <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center">
            <AlertCircle className="w-4 h-4" />
          </div>
          <div className="text-xs font-bold text-[#0f172a]">Engineering Advisory</div>
          <div className="text-xs text-slate-500 leading-relaxed">
            AI extractions are advisory and do not substitute for formal ISO 26262 functional safety sign-offs.
          </div>
        </div>

        <div className="bg-white border border-[#e2e8f0] rounded-xl p-4 shadow-sm space-y-2">
          <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center">
            <Scale className="w-4 h-4" />
          </div>
          <div className="text-xs font-bold text-[#0f172a]">Workspace Access</div>
          <div className="text-xs text-slate-500 leading-relaxed">
            Access credentials and workspace configurations must be maintained securely by authorized team members.
          </div>
        </div>
      </div>

      {/* Terms Body */}
      <div className="bg-white border border-[#e2e8f0] rounded-xl p-6 sm:p-8 shadow-sm space-y-6 text-sm text-[#0f172a] leading-relaxed">
        <section className="space-y-2">
          <h2 className="text-base font-bold text-[#0f172a]">1. Acceptance of Terms</h2>
          <p className="text-slate-600 text-xs">
            By accessing or using the Autovix platform, you agree to comply with and be bound by these Terms and Conditions. If you do not agree with any portion of these terms, you must not use the software.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold text-[#0f172a]">2. Scope of Service</h2>
          <p className="text-slate-600 text-xs">
            Autovix provides automated document ingestion, architectural entity recognition, RAG-grounded natural language question answering, and version comparison for automotive software architecture documentation, including AUTOSAR Classic and Adaptive platform specifications.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold text-[#0f172a]">3. Intellectual Property and Document Ownership</h2>
          <p className="text-slate-600 text-xs">
            Users retain sole and exclusive ownership of all proprietary architecture documents, system models, diagrams, and design specifications uploaded to Autovix. Autovix does not claim any ownership rights over user documents or the resulting architectural extracts.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold text-[#0f172a]">4. Engineering and Safety Disclaimer</h2>
          <p className="text-slate-600 text-xs">
            Autovix utilizes automated parsing, OCR algorithms, and machine learning models to assist engineers. While the platform strives for high extraction precision and citation grounding, outputs must be validated by qualified automotive systems engineers before being relied upon in safety-critical systems. Autovix is not a certified tool for ISO 26262 functional safety qualification, ISO 21434 cybersecurity certification, or formal ASPICE audits.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold text-[#0f172a]">5. Permitted and Prohibited Use</h2>
          <p className="text-slate-600 text-xs">
            You agree to use Autovix solely for legitimate software architecture design, analysis, and engineering purposes. You agree not to upload malicious binaries, attempt to disrupt platform services, or circumvent workspace authorization boundaries.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold text-[#0f172a]">6. Limitation of Liability</h2>
          <p className="text-slate-600 text-xs">
            To the maximum extent permitted by applicable law, Autovix and its contributors shall not be liable for any indirect, incidental, special, consequential, or punitive damages resulting from the use or inability to use the platform or errors in extracted architectural data.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold text-[#0f172a]">7. Contact and Support</h2>
          <p className="text-slate-600 text-xs">
            Questions concerning these Terms and Conditions should be directed to <code className="bg-slate-100 text-slate-800 px-1.5 py-0.5 rounded text-[11px]">support@autovix.example.com</code>.
          </p>
        </section>
      </div>
    </div>
  );
}
