import { ArrowLeft } from 'lucide-react';
import { useApp } from '../context/AppContext';

const sections = [
  {
    title: 'About this software',
    content: <p>Autovix is a workspace for processing automotive architecture documents. Its implemented features include PDF text and table extraction, architecture entity recognition, traceability views, document-version comparison, document search and question answering, reviews, sign-off, and exports.</p>,
  },
  {
    title: 'Accounts and workspace access',
    content: <p>Access to project data is authenticated and project actions are controlled by roles. Users are responsible for protecting their sign-in details and for using workspaces they are authorized to access. The server operator is responsible for configuring accounts and project membership for the installation.</p>,
  },
  {
    title: 'Documents and permitted use',
    content: <p>Only upload or process material you are authorized to use with the installation and its configured services. Do not use the workspace to interfere with the service, bypass access controls, or submit files you know are malicious. The operator should define any additional rules that apply to the organization using this installation.</p>,
  },
  {
    title: 'Your content and generated results',
    content: <p>This software does not determine ownership of uploaded documents, extracted records, questions, or generated answers. Users should confirm they have appropriate rights and permissions before uploading or exporting material. The application processes content to provide the requested workspace features.</p>,
  },
  {
    title: 'Engineering review',
    content: <p>Extracted entities, comparisons, search results, and model-generated answers can be incomplete or incorrect. Review source documents and evidence before using results in engineering, safety, cybersecurity, compliance, or release decisions. Autovix is not a certified safety-analysis or compliance tool.</p>,
  },
  {
    title: 'Availability and configured services',
    content: <p>Features depend on the API server, storage, document-processing dependencies, and model services configured by the operator. Availability, data retention, backups, support, and any third-party service terms are specific to that deployment and are not set by this repository.</p>,
  },
  {
    title: 'Changes and termination',
    content: <p>The operator manages access to each installation and its workspaces. This repository does not define a general account cancellation, subscription, refund, or service-level process. The operator should publish the process that applies to its deployment.</p>,
  },
  {
    title: 'Operator details and legal review',
    content: <p>No legal business identity, governing jurisdiction, effective date, or verified terms contact is configured in this repository. The operator must supply those details and obtain appropriate legal review before treating these draft terms as binding conditions of use.</p>,
  },
];

export default function TermsAndConditions() {
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
        <h1 className="text-2xl font-bold tracking-tight text-slate-950">Terms and Conditions</h1>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-600">This is a product-specific draft based on the features in this repository. It is not an active contract until the operator completes the deployment details and obtains appropriate review.</p>
      </header>
      <div className="legal-content">
        {sections.map((section, index) => <section key={section.title} aria-labelledby={`terms-section-${index + 1}`}>
          <h2 id={`terms-section-${index + 1}`}>{index + 1}. {section.title}</h2>
          {section.content}
        </section>)}
      </div>
      <p className="mt-8 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-950">The operator should have the final terms reviewed for the relevant organization and jurisdiction.</p>
    </article>
  );
}
