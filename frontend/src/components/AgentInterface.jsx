import React, { useState, useRef, useEffect } from 'react';
import {
  Play, Bot, FileText, Loader2, Sparkles, Zap, GitBranch,
  AlertTriangle, Truck, CheckCircle2, ArrowRight, RefreshCw
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import ToolCallCard from './ToolCallCard';
import DocumentCitations from './DocumentCitations';

const NODE_META = {
  triage:             { icon: '🔎', label: 'Triage & Severity Classification',  Icon: Zap },
  retrieve_incidents: { icon: '📂', label: 'Retrieve Incident History',          Icon: FileText },
  rca:                { icon: '🧠', label: 'Root Cause Analysis',                Icon: Bot },
  retrieve_sla:       { icon: '📄', label: 'Retrieve SLA Contract Document',     Icon: FileText },
  decision:           { icon: '⚡', label: 'Agent Decision & Path Selection',    Icon: GitBranch },
  dispatch:           { icon: '🚛', label: 'Dispatch Planning',                  Icon: Truck },
  escalate:           { icon: '🚨', label: 'Vendor Escalation',                  Icon: AlertTriangle },
  report:             { icon: '📋', label: 'Generate Priority Action Report',    Icon: CheckCircle2 },
};

const AgentStep = ({ step, index }) => {
  const meta = NODE_META[step.node] || { icon: '🔷', label: step.node, Icon: Bot };
  const { Icon } = meta;

  return (
    <div
      className={`step-card node-${step.node}`}
      style={{ animationDelay: `${index * 40}ms` }}
    >
      {/* Node header */}
      <div className="flex items-center gap-2.5 mb-2">
        <span className="text-sm leading-none">{step.icon || meta.icon}</span>
        <Icon className="w-3.5 h-3.5 flex-shrink-0" style={{ opacity: 0.7 }} />
        <span className="text-xs font-semibold tracking-tight" style={{ fontFamily: "'Space Grotesk', sans-serif", color: 'var(--text-primary)' }}>
          {step.label || meta.label}
        </span>
      </div>

      {/* Agent message */}
      {step.message && (
        <p className="text-xs leading-relaxed mb-2 pl-2 border-l"
           style={{ borderColor: 'rgba(255,255,255,0.1)', color: 'var(--text-secondary)' }}>
          {step.message.replace(/^\[.*?\]\s*/, '')}
        </p>
      )}

      {/* Decision branch indicator */}
      {step.node === 'decision' && step.output?.decision && (
        <div className={`decision-banner ${step.output.decision} mt-2`}>
          <GitBranch className="w-4 h-4 flex-shrink-0" />
          <div>
            <div className="text-xs font-bold" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              {step.output.decision === 'escalate' ? '🔴 Escalation Path Selected' : '🟢 Dispatch Path Selected'}
            </div>
            <div className="text-[10px] mt-0.5 opacity-70">
              {step.output.decision === 'escalate'
                ? 'SLA breach risk + repeat failure — invoking vendor emergency escalation'
                : 'Within SLA window — standard crew dispatch is appropriate'}
            </div>
          </div>
          <ArrowRight className="w-4 h-4 flex-shrink-0 ml-auto opacity-60" />
        </div>
      )}

      {/* Tool calls */}
      {step.tool_calls?.length > 0 && (
        <div className="mt-2 space-y-1.5">
          <div className="section-label mb-1.5">Tool Calls</div>
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
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [steps, finalResult]);

  const handleTrigger = async () => {
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
        const parts = buffer.split('\n\n');
        buffer = parts.pop() || '';

        for (const chunk of parts) {
          if (!chunk.startsWith('data: ')) continue;
          try {
            const parsed = JSON.parse(chunk.slice(6));
            if (parsed.type === 'node_complete') setSteps(p => [...p, parsed.data]);
            else if (parsed.type === 'complete') { setFinalResult(parsed.data); setIsDone(true); }
            else if (parsed.type === 'error') setError(parsed.data.message);
          } catch { /* skip */ }
        }
      }
    } catch (err) {
      setError(err.message || 'Connection error. Is the backend running?');
    } finally {
      setIsRunning(false);
    }
  };

  const reset = () => { setSteps([]); setFinalResult(null); setIsDone(false); setError(null); };

  const totalNodes = 7;

  return (
    <div className="glass-panel h-full flex flex-col overflow-hidden">

      {/* ── Panel Header ── */}
      <div className="px-5 py-3.5 flex items-center justify-between flex-shrink-0"
           style={{ borderBottom: '1px solid var(--border-subtle)', background: 'rgba(255,255,255,0.015)' }}>
        <div>
          <h2 className="font-semibold flex items-center gap-2" style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 15, color: 'var(--text-primary)' }}>
            <Bot className="w-4 h-4" style={{ color: 'var(--indigo)' }} />
            Nexus AI Agent
          </h2>
          <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)', letterSpacing: '0.04em' }}>
            Multi-step · Document-grounded · Conditional branching · 5 tool calls
          </p>
        </div>

        <div className="flex items-center gap-2">
          {(steps.length > 0 || isDone) && !isRunning && (
            <button onClick={reset} className="btn-ghost">
              <RefreshCw className="w-3 h-3" /> Reset
            </button>
          )}
          <button
            id="trigger-analysis-btn"
            onClick={handleTrigger}
            disabled={!incident || isRunning}
            className={`btn-primary ${isRunning ? 'loading' : ''}`}
          >
            {isRunning
              ? <Loader2 className="w-4 h-4 animate-spin-slow" />
              : isDone
                ? <RefreshCw className="w-4 h-4" />
                : <Play className="w-4 h-4" />
            }
            {isRunning ? `Reasoning… (${steps.length}/${totalNodes})` : isDone ? 'Re-run Analysis' : 'Trigger Analysis'}
          </button>
        </div>
      </div>

      {/* ── Scrollable Body ── */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">

        {/* Empty state */}
        {!incident && steps.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center gap-4" style={{ color: 'var(--text-muted)' }}>
            <div className="p-5 rounded-2xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-subtle)' }}>
              <Sparkles className="w-8 h-8 opacity-40" />
            </div>
            <p className="text-sm">Select an incident from the queue to begin analysis</p>
          </div>
        )}

        {/* Ready state */}
        {incident && steps.length === 0 && !isRunning && !isDone && (
          <div className="h-full flex flex-col items-center justify-center gap-4">
            <div className="text-center max-w-xs">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
                   style={{ background: 'rgba(129,140,248,0.1)', border: '1px solid rgba(129,140,248,0.2)' }}>
                <Bot className="w-7 h-7" style={{ color: 'var(--indigo)' }} />
              </div>
              <p className="font-semibold text-sm mb-1" style={{ fontFamily: "'Space Grotesk', sans-serif", color: 'var(--text-primary)' }}>
                Ready to analyze <span style={{ color: 'var(--accent)' }}>{incident.tower}</span>
              </p>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                The agent will plan, retrieve documents twice, call 5 tools, make a branching decision, and produce a cited enterprise report.
              </p>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="p-4 rounded-xl text-sm" style={{ background: 'var(--danger-dim)', border: '1px solid rgba(244,63,94,0.25)', color: '#FCA5A5' }}>
            <p className="font-semibold mb-1" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>⚠️ Agent Error</p>
            <p className="text-xs opacity-80">{error}</p>
          </div>
        )}

        {/* Steps */}
        {steps.length > 0 && (
          <div className="space-y-3">
            {/* Progress bar */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="section-label">Agent Reasoning Trace</span>
                <span className="text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>{steps.length}/{totalNodes} nodes</span>
              </div>
              <div className="agent-progress">
                {Array.from({ length: totalNodes }).map((_, i) => (
                  <div key={i} className={`agent-progress-segment ${i < steps.length ? 'active' : ''}`} />
                ))}
              </div>
            </div>

            {steps.map((step, i) => <AgentStep key={i} step={step} index={i} />)}

            {isRunning && (
              <div className="flex items-center gap-2 py-1 pl-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                <Loader2 className="w-3.5 h-3.5 animate-spin-slow" style={{ color: 'var(--indigo)' }} />
                <span className="animate-pulse">Agent is reasoning…</span>
              </div>
            )}
          </div>
        )}

        {/* Final result */}
        {isDone && finalResult && (
          <div className="space-y-4 mt-1">
            {/* Decision outcome banner */}
            <div className={`decision-banner ${finalResult.decision}`}>
              <GitBranch className="w-5 h-5 flex-shrink-0" />
              <div className="flex-1">
                <div className="font-bold text-sm" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                  {finalResult.decision === 'escalate' ? '🔴 Escalation Path Executed' : '🟢 Dispatch Path Executed'}
                </div>
                <div className="text-[11px] opacity-70 mt-0.5">
                  Severity: {finalResult.severity} &nbsp;·&nbsp; Root Cause: {finalResult.predicted_cause}
                </div>
              </div>
            </div>

            {/* Citations */}
            <DocumentCitations citations={finalResult.citations} />

            {/* Report */}
            <div>
              <div className="section-label mb-3 flex items-center gap-2">
                <FileText className="w-3 h-3" /> Priority Action Report
              </div>
              <div className="report-card">
                <ReactMarkdown>{finalResult.report}</ReactMarkdown>
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  );
};

export default AgentInterface;
