import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Terminal, Database, FileText, AlertTriangle } from 'lucide-react';

const TOOL_ICONS = {
  query_incidents: Database,
  get_sla_document: FileText,
  check_inventory: Database,
  find_available_crews: Database,
  escalate_to_vendor: AlertTriangle,
};

const TOOL_COLORS = {
  query_incidents:   'border-blue-500/30 bg-blue-500/5 text-blue-400',
  get_sla_document:  'border-purple-500/30 bg-purple-500/5 text-purple-400',
  check_inventory:   'border-amber-500/30 bg-amber-500/5 text-amber-400',
  find_available_crews: 'border-emerald-500/30 bg-emerald-500/5 text-emerald-400',
  escalate_to_vendor:'border-red-500/30 bg-red-500/5 text-red-400',
};

const ToolCallCard = ({ toolCall, index }) => {
  const [expanded, setExpanded] = useState(false);
  const Icon = TOOL_ICONS[toolCall.tool] || Terminal;
  const colorClass = TOOL_COLORS[toolCall.tool] || 'border-slate-500/30 bg-slate-500/5 text-slate-400';

  return (
    <div className={`border rounded-lg overflow-hidden text-xs font-mono animate-in fade-in slide-in-from-bottom-2 duration-300 ${colorClass}`}
         style={{ animationDelay: `${index * 80}ms` }}>
      {/* Header */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between px-3 py-2 hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Icon className="w-3.5 h-3.5 flex-shrink-0" />
          <span className="font-semibold">{toolCall.tool}(</span>
          <span className="opacity-70 truncate max-w-[180px]">
            {JSON.stringify(toolCall.input).replace(/[{}]/g, '')}
          </span>
          <span className="font-semibold">)</span>
        </div>
        {expanded ? <ChevronDown className="w-3 h-3 flex-shrink-0" /> : <ChevronRight className="w-3 h-3 flex-shrink-0" />}
      </button>

      {/* Result summary always visible */}
      <div className="px-3 pb-2 flex items-center gap-2 opacity-80">
        <span className="text-emerald-400">→</span>
        <span>{toolCall.output_summary || 'No output'}</span>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-current/10 px-3 py-2 space-y-2 bg-black/20">
          {toolCall.citation && (
            <p className="opacity-60 italic text-[10px] leading-relaxed">{toolCall.citation}</p>
          )}
          {toolCall.excerpt && (
            <blockquote className="border-l-2 border-current pl-2 opacity-80 text-[10px] leading-relaxed italic">
              "{toolCall.excerpt}"
            </blockquote>
          )}
          {toolCall.output && Array.isArray(toolCall.output) && (
            <div className="space-y-1">
              {toolCall.output.map((item, i) => (
                <div key={i} className="text-[10px] opacity-70 leading-relaxed">
                  {item.incident_id}: {item.root_cause} ({item.date})
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ToolCallCard;
