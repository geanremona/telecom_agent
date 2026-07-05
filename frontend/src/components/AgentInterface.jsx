import React, { useState, useRef, useEffect } from 'react';
import {
  Play, Bot, FileText, CheckCircle2, Loader2, Sparkles,
  Zap, GitBranch, AlertTriangle, Truck, ArrowRight
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import ToolCallCard from './ToolCallCard';
import DocumentCitations from './DocumentCitations';

const NODE_ICONS = {
  triage: Zap,
  retrieve_incidents: FileText,
  rca: Bot,
  retrieve_sla: FileText,
  decision: GitBranch,
  dispatch: Truck,
  escalate: AlertTriangle,
  report: CheckCircle2,
};

const NODE_COLORS = {
  triage:             'border-blue-500/40 bg-blue-500/10 text-blue-300',
  retrieve_incidents: 'border-purple-500/40 bg-purple-500/10 text-purple-300',
  rca:                'border-cyan-500/40 bg-cyan-500/10 text-cyan-300',
  retrieve_sla:       'border-purple-500/40 bg-purple-500/10 text-purple-300',
  decision:           'border-amber-500/40 bg-amber-500/10 text-amber-300',
  dispatch:           'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
  escalate:           'border-red-500/40 bg-red-500/10 text-red-300',
  report:             'border-indigo-500/40 bg-indigo-500/10 text-indigo-300',
};

const AgentStep = ({ step, index }) => {
  const Icon = NODE_ICONS[step.node] || Bot;
  const colorClass = NODE_COLORS[step.node] || 'border-slate-500/40 bg-slate-500/10 text-slate-300';

  return (
    <div
      className={`rounded-xl border p-4 space-y-3 animate-in fade-in slide-in-from-bottom-3 duration-400 ${colorClass}`}
      style={{ animationDelay: `${index * 50}ms` }}
    >
      {/* Node Header */}
      <div className="flex items-center gap-2">
        <span className="text-base">{step.icon}</span>
        <Icon className="w-4 h-4 flex-shrink-0" />
        <span className="font-semibold text-sm">{step.label}</span>
      </div>

      {/* Agent message */}
      {step.message && (
        <p className="text-xs leading-relaxed opacity-80 pl-1 border-l-2 border-current/30 ml-1">
          {step.message.replace(/^\[.*?\]\s*/, '')}
        </p>
      )}

      {/* Decision badge */}
      {step.node === 'decision' && step.output?.decision && (
        <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold
          ${step.output.decision === 'escalate'
            ? 'bg-red-500/20 text-red-300 border border-red-500/30'
            : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
          }`}>
          <GitBranch className="w-3 h-3" />
          {step.output.decision === 'escalate' ? '🔴 ESCALATION PATH' : '🟢 DISPATCH PATH'}
          <ArrowRight className="w-3 h-3" />
        </div>
      )}

      {/* Tool Calls */}
      {step.tool_calls && step.tool_calls.length > 0 && (
        <div className="space-y-2 pt-1">
          <p className="text-[10px] uppercase tracking-wider opacity-50 font-semibold">Tool Calls</p>
          {step.tool_calls.map((tc, i) => (
            <ToolCallCard key={i} toolCall={tc} index={i} />
          ))}
        </div>
      )}
    </div>
  );
};

const AgentInterface = ({ incident }) => {
  const [isRunning, setIsRunning] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const [steps, setSteps] = useState([]);
  const [finalResult, setFinalResult] = useState(null);
  const [error, setError] = useState(null);
  const bottomRef = useRef(null);

  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [steps, finalResult]);

  const handleTriggerAgent = async () => {
    if (!incident || isRunning) return;
    setIsRunning(true);
    setIsDone(false);
    setSteps([]);
    setFinalResult(null);
    setError(null);

    const apiUrl = import.meta.env.VITE_API_URL || 'http://136.244.111.138:8000';

    try {
      const response = await fetch(`${apiUrl}/api/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          incident_id: incident.id,
          tower_id: incident.tower,
          event_type: 'Outage',
          logs: incident.logs,
        }),
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const chunk of lines) {
          if (!chunk.startsWith('data: ')) continue;
          try {
            const parsed = JSON.parse(chunk.slice(6));
            if (parsed.type === 'node_complete') {
              setSteps(prev => [...prev, parsed.data]);
            } else if (parsed.type === 'complete') {
              setFinalResult(parsed.data);
              setIsDone(true);
            } else if (parsed.type === 'error') {
              setError(parsed.data.message);
            }
          } catch { /* skip malformed */ }
        }
      }
    } catch (err) {
      setError(err.message || 'Connection error. Is the backend running?');
    } finally {
      setIsRunning(false);
    }
  };

  const reset = () => {
    setSteps([]);
    setFinalResult(null);
    setIsDone(false);
    setError(null);
  };

  return (
    <div className="glass-panel h-full flex flex-col overflow-hidden relative">

      {/* Header */}
      <div className="p-4 border-b border-slate-700/50 bg-slate-800/30 flex justify-between items-center z-10 flex-shrink-0">
        <div>
          <h2 className="font-semibold text-lg flex items-center gap-2">
            <Bot className="w-5 h-5 text-indigo-400" />
            Nexus AI Agent
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">Multi-step • Document-grounded • Branching decisions</p>
        </div>

        <div className="flex items-center gap-2">
          {(steps.length > 0 || isDone) && !isRunning && (
            <button
              onClick={reset}
              className="px-3 py-1.5 text-xs rounded-lg border border-slate-700 text-slate-400 hover:text-slate-200 transition-colors"
            >
              Reset
            </button>
          )}
          <button
            onClick={handleTriggerAgent}
            disabled={!incident || isRunning}
            id="trigger-analysis-btn"
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all shadow-lg
              ${!incident
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                : isRunning
                  ? 'bg-indigo-600/50 text-white cursor-wait border border-indigo-500/30'
                  : 'bg-gradient-to-r from-indigo-500 to-cyan-500 text-white hover:shadow-cyan-500/25 hover:scale-[1.02]'
              }`}
          >
            {isRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            {isRunning ? `Reasoning… (${steps.length}/8)` : isDone ? 'Re-run Analysis' : 'Trigger Analysis'}
          </button>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4 relative z-10">

        {/* Empty state */}
        {!incident && steps.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-slate-500 gap-4">
            <Sparkles className="w-12 h-12 opacity-20" />
            <p className="text-sm">Select an incident from the queue to begin analysis.</p>
          </div>
        )}

        {/* Ready state */}
        {incident && steps.length === 0 && !isRunning && !isDone && (
          <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-3">
            <div className="p-4 rounded-2xl bg-slate-800/50 border border-slate-700">
              <Bot className="w-8 h-8 text-indigo-400" />
            </div>
            <p className="text-sm font-medium">Ready to analyze <span className="text-cyan-400">{incident.tower}</span></p>
            <p className="text-xs text-slate-500 text-center max-w-xs">
              The agent will plan, retrieve documents multiple times, call tools, make branching decisions, and produce an enterprise report.
            </p>
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="p-4 rounded-xl border border-red-500/30 bg-red-500/10 text-red-300 text-sm">
            <p className="font-semibold mb-1">⚠️ Agent Error</p>
            <p className="text-xs opacity-80">{error}</p>
          </div>
        )}

        {/* Progress pipeline */}
        {steps.length > 0 && (
          <div>
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
              Agent Reasoning Trace — {steps.length} of 8 nodes
            </h3>

            {/* Node progress bar */}
            <div className="flex gap-1 mb-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className={`h-1 flex-1 rounded-full transition-all duration-500 ${
                    i < steps.length ? 'bg-gradient-to-r from-indigo-500 to-cyan-500' : 'bg-slate-800'
                  }`}
                />
              ))}
            </div>

            <div className="space-y-3">
              {steps.map((step, i) => (
                <AgentStep key={i} step={step} index={i} />
              ))}
            </div>
          </div>
        )}

        {/* Live pulsing indicator */}
        {isRunning && (
          <div className="flex items-center gap-2 text-slate-500 text-xs pl-2">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />
            <span className="animate-pulse">Agent is reasoning…</span>
          </div>
        )}

        {/* Final report */}
        {isDone && finalResult && (
          <div className="mt-2 space-y-4 animate-in fade-in zoom-in-95 duration-500">
            {/* Decision outcome banner */}
            <div className={`flex items-center gap-3 p-3 rounded-xl border font-semibold text-sm
              ${finalResult.decision === 'escalate'
                ? 'border-red-500/30 bg-red-500/10 text-red-300'
                : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
              }`}>
              <GitBranch className="w-5 h-5" />
              <div>
                <p className="font-bold">
                  {finalResult.decision === 'escalate' ? '🔴 Escalation Path Executed' : '🟢 Dispatch Path Executed'}
                </p>
                <p className="text-xs opacity-70 font-normal">
                  Severity: {finalResult.severity} • Root Cause: {finalResult.predicted_cause}
                </p>
              </div>
            </div>

            {/* Document citations */}
            <DocumentCitations citations={finalResult.citations} />

            {/* Markdown report */}
            <div>
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                <FileText className="w-3.5 h-3.5" /> Priority Action Report
              </h3>
              <div className="bg-slate-950 border border-slate-700/50 rounded-xl p-5 shadow-2xl
                            prose prose-invert prose-slate max-w-none text-sm
                            prose-headings:text-slate-100 prose-headings:font-bold
                            prose-code:text-cyan-400 prose-code:bg-cyan-500/10 prose-code:px-1 prose-code:rounded
                            prose-a:text-cyan-400 hover:prose-a:text-cyan-300
                            prose-blockquote:border-indigo-500 prose-blockquote:text-slate-400">
                <ReactMarkdown>{finalResult.report}</ReactMarkdown>
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-indigo-500/3 via-transparent to-cyan-500/3 pointer-events-none" />
    </div>
  );
};

export default AgentInterface;
