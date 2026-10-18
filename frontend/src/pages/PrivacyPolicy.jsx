import { ArrowLeft } from 'lucide-react';
import { useApp } from '../context/AppContext';

const sections = [
  {
    title: 'Information handled by the workspace',
    content: <>
      <p>Depending on the features you use, Autovix processes:</p>
      <ul>
        <li>Account identifiers and project membership used for sign-in and access checks.</li>
        <li>PDFs you upload and the text, tables, page references, chunks, entities, and traceability records produced from them.</li>
        <li>Questions submitted to Ask AI, generated answers, citations, review comments, comparisons, exports, and audit events.</li>
        <li>A bearer session token saved in this browser’s local storage. Tokens currently expire after 24 hours and can be removed by clearing this site’s local storage.</li>
      </ul>
    </>,
  },
  {
    title: 'How documents and questions are processed',
    content: <>
      <p>The browser sends workspace requests and uploaded files to the API server configured for this installation. The server extracts document text and tables, stores project records, and maintains a vector index for retrieval. The repository’s default setup stores application records in SQLite and vectors in ChromaDB on the server.</p>
      <p>Ask AI sends the question and retrieved document passages to the model service configured on the API server. The documented default is a local Ollama service. If the operator points the API at another host or model provider, those passages and questions are handled by that configured service.</p>
    </>,
  },
  {
    title: 'Storage, retention, and deletion',
    content: <>
      <p>Storage location, backups, and retention depend on the person or organization operating the API server. This application does not define a universal retention period.</p>
      <p>Users with an authorized project role can delete a document through the Documents view. The API removes the document and its associated stored artifacts and index data, then records a deletion audit event. This action does not establish that copies in operator-managed backups are removed. The application does not currently provide a self-service control to delete an account or all audit history.</p>
    </>,
  },
  {
    title: 'Cookies, analytics, and external requests',
    content: <>
      <p>The frontend does not include analytics or advertising tracking code. It uses browser local storage for the bearer token and does not use an application cookie for sign-in. This frontend does not load remote font files.</p>
      <p>Your browser communicates with the configured API server. Any additional network services depend on that server’s configuration.</p>
    </>,
  },
  {
    title: 'Access and security',
    content: <>
      <p>API requests use bearer-token authentication and project role checks. The application does not make a general guarantee about encryption, hosting security, backups, or operational access. Those protections depend on how the server and network are configured.</p>
      <p>Do not upload documents unless you are authorized to share them with the operator of this installation and its configured services.</p>
    </>,
  },
  {
    title: 'Privacy questions',
    content: <p>This repository does not configure a verified privacy contact or legal operator identity. For this installation, contact the person or organization that operates the API server. The operator should add an appropriate contact and review this draft before public deployment.</p>,
  },
];

export default function PrivacyPolicy() {
  const { setSelectedTab } = useApp();

  return (
    <article className="legal-page fade-in">
      <button
        type="button"
        onClick={() => setSelectedTab('Dashboard')}
        className="mb-5 inline-flex items-center gap-2 rounded-md text-sm font-semibold text-slate-600 hover:text-slate-950"
      >
        <ArrowLeft aria-hidden="true" className="h-4 w-4" />
        <span>Back to workspace</span>
      </button>
      <header className="mb-8 border-b border-slate-200 pb-6">
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.12em] text-blue-700">Autovix workspace</p>
        <h1 className="text-2xl font-bold tracking-tight text-slate-950">Privacy Policy</h1>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-600">This draft describes data handling implemented in this repository. The server operator must confirm deployment-specific practices, identify the legal operator, and provide a privacy contact before public use.</p>
      </header>
      <div className="legal-content">
        {sections.map((section, index) => <section key={section.title} aria-labelledby={`privacy-section-${index + 1}`}>
          <h2 id={`privacy-section-${index + 1}`}>{index + 1}. {section.title}</h2>
          {section.content}
        </section>)}
      </div>
      <p className="mt-8 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-950">This page is informational and has not been reviewed by legal counsel. It is not a statement that any particular deployment meets a legal standard.</p>
    </article>
  );
}
