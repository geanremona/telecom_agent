import React from 'react';
import { BookOpen, ExternalLink } from 'lucide-react';

const DocumentCitations = ({ citations }) => {
  if (!citations || citations.length === 0) return null;

  return (
    <div className="mt-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
        <BookOpen className="w-3.5 h-3.5" />
        Grounding Citations ({citations.length})
      </h3>
      <div className="space-y-2">
        {citations.map((citation, i) => (
          <div
            key={i}
            className="flex items-start gap-2 px-3 py-2 rounded-lg bg-slate-900/60 border border-slate-700/40 
                       text-[11px] text-slate-400 font-mono animate-in fade-in duration-300"
            style={{ animationDelay: `${i * 100}ms` }}
          >
            <ExternalLink className="w-3 h-3 text-cyan-500 mt-0.5 flex-shrink-0" />
            <span className="leading-relaxed">{citation}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DocumentCitations;
