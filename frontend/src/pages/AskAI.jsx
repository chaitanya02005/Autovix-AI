import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { api } from '../api';
import {
  FileText,
  ShieldCheck,
  ShieldAlert,
  ChevronDown,
  ChevronRight,
  ArrowRight,
  Search,
} from 'lucide-react';

export default function AskAI() {
  const {
    currentProjectId,
    documentReady,
    documentInfo,
    lastAnswer,
    setLastAnswer,
    setSelectedTab,
    addToast,
  } = useApp();

  const [question, setQuestion] = useState('');
  const [asking, setAsking] = useState(false);
  const [showPassages, setShowPassages] = useState(false);

  const suggestedQuestions = [
    'What are the main software components defined in this architecture?',
    'What communication interfaces and ports are specified?',
    'How are service instances configured between client and server?',
    'What safety requirements and dependencies are described?',
  ];

  const handleQuery = async (queryText) => {
    const q = (queryText || question).trim();
    if (!q || !currentProjectId) return;

    setAsking(true);
    try {
      const response = await api.askAI(currentProjectId, q);
      setLastAnswer({
        question: q,
        answer: response.answer,
        retrieval_confidence: response.retrieval_confidence || {},
        grounding: response.grounding || {},
        sources: response.sources || [],
        primary_source: response.primary_source,
        context: response.context || [],
        model: response.model || null,
      });
      setQuestion('');
    } catch (err) {
      console.error('Error asking AI:', err);
      addToast(`Error generating answer: ${err.message}`, 'error');
    } finally {
      setAsking(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    handleQuery(question);
  };

  if (!documentReady) {
    return (
      <div className="space-y-6 fade-in">
        <div className="pb-2 border-b border-slate-200">
          <h1 className="text-2xl font-bold tracking-tight text-[#0f172a]">Ask AI Document Assistant</h1>
          <p className="text-sm text-slate-500 mt-1">
            Query your AUTOSAR specification using natural language to retrieve grounded architectural answers.
          </p>
        </div>

        <div className="bg-white border border-[#e2e8f0] rounded-xl p-12 text-center shadow-xs">
          <FileText className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <div className="text-sm font-semibold text-slate-700">No active specification document</div>
          <div className="text-xs text-slate-400 mt-1">
            Upload an AUTOSAR PDF document in the Documents tab first to enable grounded RAG answering.
          </div>
          <button
            onClick={() => setSelectedTab('Documents')}
            className="mt-4 px-4 py-2 bg-[#0f172a] text-white text-xs font-semibold rounded-lg hover:bg-slate-800 transition-colors inline-flex items-center gap-2 shadow-xs"
          >
            <span>Go to Documents</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  }

  const confidenceLevel =
    lastAnswer?.retrieval_confidence?.level ||
    (lastAnswer?.retrieval_confidence?.score > 0.7 ? 'High' : 'Medium') ||
    'High';
  const isGrounded = lastAnswer?.grounding?.supported ?? true;

  return (
    <div className="space-y-6 fade-in">
      {/* Header */}
      <div className="pb-2 border-b border-slate-200">
        <h1 className="text-2xl font-bold tracking-tight text-[#0f172a]">Ask AI Assistant</h1>
        <p className="text-sm text-slate-500 mt-1">
          Query your AUTOSAR specification with strictly grounded answers retrieved from vector passages and source tables.
        </p>
      </div>

      {/* Active Document Indicator Banner */}
      <div>
        <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
          Active Knowledge Source
        </div>
        <div className="bg-white border border-[#e2e8f0] rounded-xl p-4 flex items-center gap-3.5 shadow-xs">
          <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700 shrink-0">
            <FileText className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs sm:text-sm font-bold text-[#0f172a] truncate">
              {documentInfo?.filename || 'Document'}
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
              <span>v{documentInfo?.version || 1}</span>
              <span className="text-slate-300">|</span>
              <span>{documentInfo?.pages || 0} pages</span>
              <span className="text-slate-300">|</span>
              <span className="text-emerald-700 font-semibold inline-flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                Grounded Vector Index Active
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Question Form */}
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="relative">
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            disabled={asking}
            placeholder="Ask about components, interfaces, ports, service instances, or signals..."
            className="w-full h-12 pl-4 pr-28 text-xs sm:text-sm bg-white border border-[#e2e8f0] rounded-xl shadow-xs focus:outline-none focus:ring-1 focus:ring-slate-400 transition-shadow disabled:bg-slate-50"
          />
          <button
            type="submit"
            disabled={asking || !question.trim()}
            className="absolute right-1.5 top-1.5 bottom-1.5 px-4 bg-[#0f172a] hover:bg-slate-800 disabled:bg-slate-300 text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-xs"
          >
            {asking ? (
              <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <Search className="w-3.5 h-3.5" />
            )}
            <span>Query</span>
          </button>
        </div>
      </form>

      {/* Suggested Questions */}
      <div className="space-y-2 pt-1">
        <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Suggested architectural queries</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {suggestedQuestions.map((sug, idx) => (
            <button
              key={idx}
              disabled={asking}
              onClick={() => handleQuery(sug)}
              className="text-left text-xs font-medium text-slate-700 bg-white border border-[#e2e8f0] hover:border-slate-300 hover:bg-slate-50 p-3 rounded-lg transition-colors shadow-2xs flex items-center justify-between group"
            >
              <span className="truncate pr-2">{sug}</span>
              <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-700 transition-colors shrink-0" />
            </button>
          ))}
        </div>
      </div>

      {/* Loading state indicator */}
      {asking && (
        <div className="bg-white border border-[#e2e8f0] rounded-xl p-8 text-center shadow-xs space-y-3 fade-in">
          <div className="w-8 h-8 border-2 border-slate-900 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <div className="text-sm font-semibold text-slate-800">Retrieving vector contexts and formulating answer...</div>
          <div className="text-xs text-slate-500">
            Matching semantic embeddings in ChromaDB, retrieving source paragraphs, and validating grounding.
          </div>
        </div>
      )}

      {/* AI Answer Card */}
      {lastAnswer && !asking && (
        <div className="pt-4 space-y-4 fade-in">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            Grounded Answer
          </div>

          {/* Badges: Confidence & Groundedness */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="bg-slate-100 border border-slate-200 text-slate-800 text-xs font-semibold px-2.5 py-1 rounded-md">
              Retrieval Confidence: {confidenceLevel}
            </span>
            <span
              className={`text-xs font-semibold px-2.5 py-1 rounded-md inline-flex items-center gap-1.5 ${
                isGrounded
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : 'bg-amber-50 text-amber-800 border border-amber-200'
              }`}
            >
              {isGrounded ? (
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              ) : (
                <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
              )}
              <span>{isGrounded ? 'Grounded in Source Document' : 'Partially Grounded'}</span>
            </span>
          </div>

          {/* Question asked recap */}
          <div className="text-xs font-semibold text-slate-600 bg-slate-50 border border-slate-200 p-3 rounded-lg">
            Query: "{lastAnswer.question}"
          </div>

          {lastAnswer.answer === 'I could not find enough information in the document.' && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
              {lastAnswer.context?.length
                ? 'The retrieved passages did not contain enough evidence for this question. Try a specific component, interface, or section name; inspect the source passages below.'
                : 'No document passages were retrieved. Check the selected project and make sure its document has finished processing.'}
            </div>
          )}

          {/* Answer Text */}
          <div className="bg-white border border-[#e2e8f0] border-l-4 border-l-[#0f172a] rounded-xl p-6 shadow-xs text-xs sm:text-sm text-[#0f172a] leading-relaxed whitespace-pre-wrap">
            {lastAnswer.answer}
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-[11px] text-slate-500">Model: {lastAnswer.model || 'Local Ollama'}</span>
            <button
              type="button"
              onClick={async () => {
                try {
                  await api.submitAnswerForReview(currentProjectId, documentInfo.document_id, {
                    item_type: 'answer',
                    original_value: lastAnswer.answer,
                    item_metadata: {
                      question: lastAnswer.question,
                      confidence: lastAnswer.retrieval_confidence,
                      grounding: lastAnswer.grounding,
                      sources: lastAnswer.sources,
                    },
                  });
                  addToast('Answer sent to the Review Queue.', 'success');
                } catch (error) {
                  addToast(`Could not send answer for review: ${error.message}`, 'error');
                }
              }}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >Send to review</button>
          </div>

          {/* Sources Chips */}
          {lastAnswer.sources && lastAnswer.sources.length > 0 && (
            <div className="space-y-2">
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Source Page Citations
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {lastAnswer.sources.map((s, idx) => (
                  <div
                    key={idx}
                    className="bg-slate-50 border border-slate-200 px-3 py-1 rounded-md text-xs font-medium text-slate-700 flex items-center gap-1.5 shadow-2xs"
                  >
                    <FileText className="w-3.5 h-3.5 text-slate-500" />
                    <span>Page {s.page || 'N/A'}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Detailed Context Passages Accordion */}
          {lastAnswer.context && lastAnswer.context.length > 0 && (
            <div className="bg-white border border-[#e2e8f0] rounded-xl overflow-hidden shadow-xs">
              <button
                onClick={() => setShowPassages(!showPassages)}
                className="w-full px-5 py-3.5 flex items-center justify-between text-left text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
              >
                <span>Inspect Retrieved Context Passages ({lastAnswer.context.length})</span>
                {showPassages ? (
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                )}
              </button>

              {showPassages && (
                <div className="p-5 border-t border-slate-100 bg-slate-50/50 space-y-3">
                  {lastAnswer.context.map((chunk, idx) => {
                    const pageNum = chunk.metadata?.page_number || 'N/A';
                    const section = chunk.metadata?.section_number || chunk.metadata?.section_title;
                    const docText = chunk.document || '';
                    return (
                      <div
                        key={idx}
                        className="bg-white border border-slate-200 rounded-lg p-3 text-xs space-y-1 shadow-2xs"
                      >
                        <div className="font-bold text-slate-800">
                          Source {idx + 1} : {section ? `Section ${section}, ` : ''}Page {pageNum}
                        </div>
                        <div className="font-mono text-[11px] text-slate-600 whitespace-pre-wrap leading-relaxed">
                          {docText.length > 600 ? `${docText.substring(0, 600)}...` : docText}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
