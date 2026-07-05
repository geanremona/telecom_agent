import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Database, FileText, AlertTriangle, Terminal } from 'lucide-react';

const TOOL_META = {
  query_incidents:      { icon: Database,      label: 'query_incidents',       cls: 'tool-query_incidents',      color: '#00D4FF' },
  get_sla_document:     { icon: FileText,      label: 'get_sla_document',      cls: 'tool-get_sla_document',     color: '#A78BFA' },
  check_inventory:      { icon: Database,      label: 'check_inventory',       cls: 'tool-check_inventory',      color: '#F59E0B' },
  find_available_crews: { icon: Database,      label: 'find_available_crews',  cls: 'tool-find_available_crews', color: '#10B981' },
  escalate_to_vendor:   { icon: AlertTriangle, label: 'escalate_to_vendor',    cls: 'tool-escalate_to_vendor',   color: '#F43F5E' },
};

const ToolCallCard = ({ toolCall, index }) => {
  const [open, setOpen] = useState(false);
  const meta = TOOL_META[toolCall.tool] || { icon: Terminal, label: toolCall.tool, cls: '', color: '#8B9CC5' };
  const Icon = meta.icon;

  // Format the input params as a short string
  const inputStr = toolCall.input
    ? Object.values(toolCall.input).join(', ')
    : '';

  return (
    <div
      className={`tool-card ${meta.cls}`}
      style={{ animationDelay: `${index * 60}ms`, animation: 'step-enter 0.3s both' }}
    >
      {/* Header row — always visible */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-white/5 transition-colors"
      >
        <Icon className="w-3 h-3 flex-shrink-0" style={{ color: meta.color }} />
        <span style={{ color: meta.color, fontWeight: 500 }}>{meta.label}</span>
        <span style={{ color: 'rgba(255,255,255,0.3)' }}>(</span>
        <span className="truncate max-w-[160px]" style={{ color: 'rgba(255,255,255,0.5)' }}>{inputStr}</span>
        <span style={{ color: 'rgba(255,255,255,0.3)' }}>)</span>
        <span className="ml-auto flex-shrink-0" style={{ color: 'var(--text-muted)' }}>
          {open ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        </span>
      </button>

      {/* Output summary — always visible */}
      <div className="px-3 pb-2 flex items-center gap-1.5 text-[10.5px]">
        <span style={{ color: '#10B981', fontWeight: 600 }}>→</span>
        <span style={{ color: 'rgba(255,255,255,0.5)' }}>{toolCall.output_summary || 'No output'}</span>
      </div>

      {/* Expanded detail */}
      {open && (
        <div className="border-t px-3 py-2.5 space-y-2" style={{ borderColor: 'rgba(255,255,255,0.06)', background: 'rgba(0,0,0,0.25)' }}>
          {toolCall.citation && (
            <p className="text-[9.5px] leading-relaxed" style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
              {toolCall.citation}
            </p>
          )}
          {toolCall.excerpt && (
            <blockquote className="border-l-2 pl-2 text-[10px] leading-relaxed italic"
                        style={{ borderColor: meta.color, color: 'rgba(255,255,255,0.45)' }}>
              "{toolCall.excerpt}"
            </blockquote>
          )}
          {toolCall.output && Array.isArray(toolCall.output) && toolCall.output.length > 0 && (
            <div className="space-y-1">
              {toolCall.output.slice(0, 3).map((item, i) => (
                <div key={i} className="text-[10px]" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  <span style={{ color: meta.color }}>·</span> {item.incident_id}: {item.root_cause} <span style={{ opacity: 0.5 }}>({item.date})</span>
                </div>
              ))}
              {toolCall.output.length > 3 && (
                <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>+{toolCall.output.length - 3} more records</div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ToolCallCard;
