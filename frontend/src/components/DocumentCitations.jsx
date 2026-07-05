import React from 'react';
import { BookOpen, ExternalLink } from 'lucide-react';

const DocumentCitations = ({ citations }) => {
  if (!citations?.length) return null;

  return (
    <div style={{ animation: 'step-enter 0.4s both' }}>
      <div className="section-label mb-2.5 flex items-center gap-2">
        <BookOpen className="w-3 h-3" />
        Grounding Citations ({citations.length})
      </div>
      <div className="space-y-1.5">
        {citations.map((c, i) => (
          <div
            key={i}
            className="citation-card"
            style={{ animationDelay: `${i * 80}ms` }}
          >
            <ExternalLink className="w-3 h-3 flex-shrink-0 mt-0.5" style={{ color: 'var(--accent)' }} />
            <span>{c}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DocumentCitations;
