import React from 'react';
import { Shield, Lock, FileText, Database, ArrowLeft } from 'lucide-react';
import { useApp } from '../context/AppContext';

export default function PrivacyPolicy() {
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
        <h1 className="text-2xl font-bold tracking-tight text-[#0f172a]">Privacy Policy</h1>
        <p className="text-sm text-slate-500 mt-1">
          Effective date: October 14, 2026. This policy describes how Autovix collects, processes, and protects your technical data.
        </p>
      </div>

      {/* Summary Highlights */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-[#e2e8f0] rounded-xl p-4 shadow-sm space-y-2">
          <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center">
            <FileText className="w-4 h-4" />
          </div>
          <div className="text-xs font-bold text-[#0f172a]">Document Data</div>
          <div className="text-xs text-slate-500 leading-relaxed">
            Uploaded PDF files are processed to extract architecture entities and build searchable vector embeddings.
          </div>
        </div>

        <div className="bg-white border border-[#e2e8f0] rounded-xl p-4 shadow-sm space-y-2">
          <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center">
            <Database className="w-4 h-4" />
          </div>
          <div className="text-xs font-bold text-[#0f172a]">Local Storage</div>
          <div className="text-xs text-slate-500 leading-relaxed">
            Entity catalogs and audit logs are stored in your workspace database with strict workspace isolation.
          </div>
        </div>

        <div className="bg-white border border-[#e2e8f0] rounded-xl p-4 shadow-sm space-y-2">
          <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center">
            <Lock className="w-4 h-4" />
          </div>
          <div className="text-xs font-bold text-[#0f172a]">No Advertising</div>
          <div className="text-xs text-slate-500 leading-relaxed">
            We do not sell data, use tracking cookies, or share technical specifications with advertising brokers.
          </div>
        </div>
      </div>

      {/* Policy Content Sections */}
      <div className="bg-white border border-[#e2e8f0] rounded-xl p-6 sm:p-8 shadow-sm space-y-6 text-sm text-[#0f172a] leading-relaxed">
        <section className="space-y-2">
          <h2 className="text-base font-bold text-[#0f172a]">1. Information We Collect</h2>
          <p className="text-slate-600">
            Autovix collects only the data necessary to provide automotive software architecture analysis and traceability services:
          </p>
          <ul className="list-disc pl-5 space-y-1 text-slate-600 text-xs">
            <li><strong>Architecture Documents:</strong> PDF specifications, software architecture descriptions, and interface documentation that you upload.</li>
            <li><strong>Search Queries and Prompts:</strong> Natural language questions submitted to the Ask AI interface.</li>
            <li><strong>Authentication Credentials:</strong> Session tokens and user profile identifiers managed via local storage.</li>
            <li><strong>Audit Logs:</strong> Operational records of document uploads, comparisons, and entity extractions within your workspace.</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold text-[#0f172a]">2. How We Process Your Documents</h2>
          <p className="text-slate-600 text-xs">
            When you upload an AUTOSAR or architectural document, the system executes an automated ingestion pipeline:
          </p>
          <ul className="list-disc pl-5 space-y-1 text-slate-600 text-xs">
            <li><strong>Text and Table Extraction:</strong> Text content is parsed and indexed into text chunks. Scanned diagrams are parsed through OCR.</li>
            <li><strong>Vector Indexing:</strong> Semantic vector representations are generated using embedded sentence transformer models and stored in a local ChromaDB collection.</li>
            <li><strong>Entity Recognition:</strong> Architectural elements (Components, Ports, Interfaces, Services) are extracted deterministically from document text.</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold text-[#0f172a]">3. Third-Party Service Providers</h2>
          <p className="text-slate-600 text-xs">
            Autovix interfaces with the Groq Cloud API for large language model inference when executing Ask AI queries. Only the relevant context passages and the user's specific question are transmitted to generate grounded technical answers. Document binaries are never stored by external AI providers for model training.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold text-[#0f172a]">4. Data Retention and Deletion</h2>
          <p className="text-slate-600 text-xs">
            You maintain full control over your project data. Deleting a document from the Documents view permanently removes the file from the filesystem, deletes its vector collection in ChromaDB, and purges associated entity records.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold text-[#0f172a]">5. Security Standards</h2>
          <p className="text-slate-600 text-xs">
            All API communications between the browser client and server are routed over HTTP/HTTPS with token-based authorization. Administrative routes require authenticated session headers. Secrets such as API keys remain on the backend server and are never exposed to browser bundles.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold text-[#0f172a]">6. Contact and Inquiries</h2>
          <p className="text-slate-600 text-xs">
            If you have questions regarding this privacy policy or your project data, contact our engineering team at <code className="bg-slate-100 text-slate-800 px-1.5 py-0.5 rounded text-[11px]">support@autovix.example.com</code>.
          </p>
        </section>
      </div>
    </div>
  );
}
