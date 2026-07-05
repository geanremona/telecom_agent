import React, { useState } from 'react';
import { AlertTriangle, MapPin, RadioTower, Clock, ChevronRight, Users, Signal, Wifi } from 'lucide-react';

// Tower positions for the SVG map (percentage-based)
const TOWER_MAP = [
  { id: 'TOWER-42', x: 28, y: 38, status: 'critical' },
  { id: 'TOWER-18', x: 62, y: 55, status: 'degraded' },
  { id: 'TOWER-09', x: 72, y: 25, status: 'resolved' },
  { id: 'TOWER-33', x: 42, y: 70, status: 'ok' },
  { id: 'TOWER-61', x: 18, y: 65, status: 'ok' },
];

const TOWER_COLORS = {
  critical: { dot: '#ef4444', glow: 'rgba(239,68,68,0.6)', ring: '#ef4444' },
  degraded: { dot: '#f59e0b', glow: 'rgba(245,158,11,0.5)', ring: '#f59e0b' },
  resolved: { dot: '#10b981', glow: 'rgba(16,185,129,0.4)', ring: '#10b981' },
  ok:       { dot: '#06b6d4', glow: 'rgba(6,182,212,0.3)', ring: '#06b6d4' },
};

const Dashboard = ({ incidents, selectedIncident, onSelectIncident }) => {
  const [hoveredTower, setHoveredTower] = useState(null);

  return (
    <div className="flex flex-col gap-5 h-full">

      {/* Network Map */}
      <div className="glass-panel overflow-hidden relative flex-shrink-0">
        <div className="p-3 border-b border-slate-700/50 flex items-center justify-between">
          <h3 className="text-sm font-semibold flex items-center gap-2 text-slate-200">
            <RadioTower className="w-4 h-4 text-cyan-400" /> Live Network Topology
          </h3>
          <div className="flex items-center gap-3 text-[10px] text-slate-500">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" />Critical</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />Degraded</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-cyan-400 inline-block" />Online</span>
          </div>
        </div>

        {/* SVG Map */}
        <div className="relative h-52 bg-slate-900/80">
          {/* Grid background */}
          <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1.5px,transparent_1.5px)] [background-size:24px_24px] opacity-60" />
          {/* Gradient scan line */}
          <div className="absolute inset-x-0 h-px bg-gradient-to-r from-transparent via-cyan-500/30 to-transparent animate-pulse top-1/2" />

          <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
            {/* Connection lines */}
            {TOWER_MAP.slice(0, -1).map((t, i) => (
              TOWER_MAP.slice(i + 1).map((t2, j) => {
                const dist = Math.hypot(t.x - t2.x, t.y - t2.y);
                if (dist > 40) return null;
                return (
                  <line key={`${t.id}-${t2.id}`}
                    x1={t.x} y1={t.y} x2={t2.x} y2={t2.y}
                    stroke={t.status === 'critical' || t2.status === 'critical' ? '#ef444440' : '#06b6d430'}
                    strokeWidth="0.5" strokeDasharray="2,2"
                  />
                );
              })
            ))}
          </svg>

          {/* Tower nodes */}
          {TOWER_MAP.map(tower => {
            const colors = TOWER_COLORS[tower.status];
            const isSelected = selectedIncident?.tower === tower.id;
            const incident = incidents.find(i => i.tower === tower.id);
            return (
              <div
                key={tower.id}
                className="absolute transform -translate-x-1/2 -translate-y-1/2 cursor-pointer group"
                style={{ left: `${tower.x}%`, top: `${tower.y}%` }}
                onClick={() => incident && onSelectIncident(incident)}
                onMouseEnter={() => setHoveredTower(tower.id)}
                onMouseLeave={() => setHoveredTower(null)}
              >
                {tower.status === 'critical' && (
                  <div className="absolute inset-0 w-8 h-8 -translate-x-1/4 -translate-y-1/4 rounded-full animate-ping"
                       style={{ backgroundColor: colors.glow, opacity: 0.4 }} />
                )}
                <div className={`w-4 h-4 rounded-full border-2 relative z-10 transition-transform group-hover:scale-125
                  ${isSelected ? 'scale-125 shadow-lg' : ''}`}
                     style={{ backgroundColor: colors.dot, borderColor: colors.ring, boxShadow: `0 0 8px ${colors.glow}` }}>
                </div>
                {/* Tooltip */}
                {hoveredTower === tower.id && (
                  <div className="absolute z-20 -top-7 left-1/2 -translate-x-1/2 bg-slate-800 border border-slate-600 
                                  rounded px-2 py-0.5 text-[9px] font-mono whitespace-nowrap text-slate-200 shadow-xl">
                    {tower.id}
                    {incident && <span className="ml-1 text-amber-400">({incident.severity})</span>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Incident Queue */}
      <div className="glass-panel flex-1 flex flex-col overflow-hidden min-h-0">
        <div className="p-4 border-b border-slate-700/50 bg-slate-800/30 flex justify-between items-center flex-shrink-0">
          <h2 className="font-semibold text-lg flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            Incident Queue
          </h2>
          <span className="bg-red-500/20 text-red-300 border border-red-500/20 text-xs px-2 py-1 rounded-md font-medium">
            {incidents.filter(i => i.severity === 'P0').length} Critical
          </span>
        </div>

        <div className="overflow-y-auto p-2 space-y-2 flex-1">
          {incidents.map(inc => {
            const isSelected = selectedIncident?.id === inc.id;
            const severityColor =
              inc.severity === 'P0' ? 'text-red-400 bg-red-400/10 border-red-400/30' :
              inc.severity === 'P1' ? 'text-amber-400 bg-amber-400/10 border-amber-400/30' :
                                      'text-slate-400 bg-slate-800 border-slate-700';

            return (
              <div
                key={inc.id}
                onClick={() => onSelectIncident(inc)}
                className={`p-4 rounded-xl border transition-all cursor-pointer group
                  ${isSelected
                    ? 'border-cyan-500/50 bg-cyan-950/30 shadow-[0_0_20px_rgba(6,182,212,0.12)]'
                    : 'border-slate-800 bg-slate-900/40 hover:border-slate-700 hover:bg-slate-800/40'
                  }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-xs font-bold border ${severityColor}`}>
                      {inc.severity}
                    </span>
                    <span className="font-mono text-sm text-slate-200 font-semibold">{inc.tower}</span>
                  </div>
                  <span className="text-[10px] text-slate-500 flex items-center gap-1 font-mono">
                    <Clock className="w-3 h-3" /> {inc.time}
                  </span>
                </div>

                <p className="text-xs text-slate-400 mb-2 line-clamp-2">{inc.logs}</p>

                <div className="flex items-center justify-between text-[10px] text-slate-600">
                  <span className="flex items-center gap-1">
                    <Users className="w-3 h-3" /> {inc.affected_users?.toLocaleString()} affected
                  </span>
                  <span className="flex items-center gap-1">
                    <Signal className="w-3 h-3" /> {inc.coverage}% coverage
                  </span>
                  {isSelected && (
                    <span className="text-cyan-400 font-medium flex items-center gap-1 animate-pulse">
                      Selected <ChevronRight className="w-3 h-3" />
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
