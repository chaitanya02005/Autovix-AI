import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { api } from '../api';
import {
  FileText,
  MessageSquare,
  ShieldCheck,
  ShieldAlert,
  ChevronDown,
  ChevronRight,
  ArrowRight,
  Sparkles,
  Layers
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
    'What are the main views of the Adaptive Platform?',
    'How are the components connected?',
    'What interfaces are described in this document?',
    'What dependencies are mentioned?',
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
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#0f172a]">Ask AI</h1>
          <p className="text-sm text-slate-500 mt-1">
            Query your document using natural language to find architectural answers.
          </p>
        </div>

        <div className="bg-white border border-[#e2e8f0] rounded-xl p-12 text-center shadow-sm">
          <FileText className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <div className="text-sm font-semibold text-slate-700">No active document</div>
          <div className="text-xs text-slate-400 mt-1">
            Upload an AUTOSAR specification in the Documents tab first to start asking questions.
          </div>
          <button
            onClick={() => setSelectedTab('Documents')}
            className="mt-4 px-4 py-2 bg-[#1e293b] text-white text-xs font-semibold rounded-lg hover:bg-slate-900 transition-colors inline-flex items-center gap-2"
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
    'Unknown';
  const isGrounded = lastAnswer?.grounding?.supported ?? true;

  return (
    <div className="space-y-6 fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[#0f172a]">Ask AI</h1>
        <p className="text-sm text-slate-500 mt-1">
          Query your document using natural language to find architectural answers.
        </p>
      </div>

      {/* Active Document Indicator Banner */}
      <div>
        <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
          Active Document
        </div>
        <div className="bg-white border border-[#e2e8f0] rounded-xl p-4 flex items-center gap-3.5 shadow-sm">
          <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700 shrink-0">
            <FileText className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold text-[#0f172a] truncate">
              {documentInfo?.filename || 'Document'}
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
              <span>v{documentInfo?.version || 1}</span>
              <span className="text-slate-300">•</span>
              <span>{documentInfo?.pages || 0} pages</span>
              <span className="text-slate-300">•</span>
              <span className="text-slate-800 font-semibold">Ready</span>
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
            placeholder="Ask about components, interfaces, signals, dependencies..."
            className="w-full h-12 pl-4 pr-24 text-sm bg-white border border-[#e2e8f0] rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-300 transition-shadow disabled:bg-slate-50"
          />
          <button
            type="submit"
            disabled={asking || !question.trim()}
            className="absolute right-1.5 top-1.5 bottom-1.5 px-4 bg-[#1e293b] hover:bg-slate-900 disabled:bg-slate-300 text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5"
          >
            {asking ? (
              <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <Sparkles className="w-3.5 h-3.5" />
            )}
            <span>Ask AI</span>
          </button>
        </div>
      </form>

      {/* Suggested Questions */}
      <div className="space-y-2 pt-1">
        <div className="text-xs font-semibold text-slate-500">Suggested questions</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {suggestedQuestions.map((sug, idx) => (
            <button
              key={idx}
              disabled={asking}
              onClick={() => handleQuery(sug)}
              className="text-left text-xs font-medium text-slate-700 bg-white border border-[#e2e8f0] hover:border-slate-300 hover:bg-slate-50/80 p-3 rounded-xl transition-all shadow-xs flex items-center justify-between group"
            >
              <span className="truncate pr-2">{sug}</span>
              <ArrowRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-slate-600 transition-colors shrink-0" />
            </button>
          ))}
        </div>
      </div>

      {/* Loading state indicator */}
      {asking && (
        <div className="bg-white border border-[#e2e8f0] rounded-xl p-8 text-center shadow-sm space-y-3 fade-in">
          <div className="w-8 h-8 border-3 border-slate-900 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <div className="text-sm font-semibold text-slate-700">Analyzing document…</div>
          <div className="text-xs text-slate-400">
            Searching architecture entities, matching vector contexts, and validating grounding.
          </div>
        </div>
      )}

      {/* AI Answer Card */}
      {lastAnswer && !asking && (
        <div className="pt-4 space-y-4 fade-in">
          <div className="h-px bg-slate-200"></div>

          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            AI Answer
          </div>

          {/* Badges: Confidence & Groundedness */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="bg-slate-100 text-slate-800 text-xs font-semibold px-3 py-1 rounded-full">
              Confidence: {confidenceLevel}
            </span>
            <span
              className={`text-xs font-semibold px-3 py-1 rounded-full inline-flex items-center gap-1.5 ${
                isGrounded
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200/50'
                  : 'bg-amber-50 text-amber-800 border border-amber-200/50'
              }`}
            >
              {isGrounded ? (
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              ) : (
                <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
              )}
              <span>{isGrounded ? 'Grounded' : 'Partially grounded'}</span>
            </span>
          </div>

          {/* Answer Text */}
          <div className="bg-white border border-[#e2e8f0] border-l-4 border-l-[#111111] rounded-xl p-6 shadow-sm text-sm text-[#0f172a] leading-relaxed whitespace-pre-wrap">
            {lastAnswer.answer}
          </div>

          {/* Sources Chips */}
          {lastAnswer.sources && lastAnswer.sources.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Sources
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {lastAnswer.sources.map((s, idx) => (
                  <div
                    key={idx}
                    className="bg-[#F6F6F6] border border-[#E8E8E8] px-3 py-1.5 rounded-md text-xs font-medium text-slate-600 flex items-center gap-1.5 shadow-xs"
                  >
                    <FileText className="w-3.5 h-3.5 text-slate-400" />
                    <span>Page {s.page || '?'}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Detailed Context Passages Accordion */}
          {lastAnswer.context && lastAnswer.context.length > 0 && (
            <div className="bg-white border border-[#e2e8f0] rounded-xl overflow-hidden shadow-sm">
              <button
                onClick={() => setShowPassages(!showPassages)}
                className="w-full px-5 py-3.5 flex items-center justify-between text-left text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
              >
                <span>Show detailed context passages ({lastAnswer.context.length})</span>
                {showPassages ? (
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                )}
              </button>

              {showPassages && (
                <div className="p-5 border-t border-slate-100 bg-slate-50/50 space-y-3">
                  {lastAnswer.context.map((chunk, idx) => {
                    const pageNum = chunk.metadata?.page_number || '?';
                    const docText = chunk.document || '';
                    return (
                      <div
                        key={idx}
                        className="bg-white border border-slate-200 rounded-lg p-3 text-xs space-y-1 shadow-xs"
                      >
                        <div className="font-bold text-slate-800">
                          Source {idx + 1} — Page {pageNum}
                        </div>
                        <div className="font-mono text-[11px] text-slate-600 whitespace-pre-wrap leading-relaxed">
                          {docText.length > 600 ? `${docText.substring(0, 600)}…` : docText}
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
