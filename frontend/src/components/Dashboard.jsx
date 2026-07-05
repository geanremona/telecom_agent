import React, { useState } from 'react';
import { AlertTriangle, RadioTower, Clock, ChevronRight, Users, Signal } from 'lucide-react';

const TOWER_MAP = [
  { id: 'TOWER-42', x: 28, y: 40, status: 'critical' },
  { id: 'TOWER-18', x: 63, y: 56, status: 'degraded' },
  { id: 'TOWER-09', x: 72, y: 22, status: 'ok' },
  { id: 'TOWER-33', x: 42, y: 72, status: 'ok' },
  { id: 'TOWER-61', x: 17, y: 66, status: 'ok' },
];

const TOWER_COLOR = {
  critical: '#F43F5E',
  degraded:  '#F59E0B',
  ok:        '#00D4FF',
};

const Dashboard = ({ incidents, selectedIncident, onSelectIncident }) => {
  const [hovered, setHovered] = useState(null);

  const edges = [];
  for (let i = 0; i < TOWER_MAP.length; i++) {
    for (let j = i + 1; j < TOWER_MAP.length; j++) {
      const a = TOWER_MAP[i], b = TOWER_MAP[j];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (d < 42) edges.push({ a, b, critical: a.status === 'critical' || b.status === 'critical' });
    }
  }

  return (
    <div className="flex flex-col gap-4 h-full">

      {/* ── Network Map ── */}
      <div className="glass-panel overflow-hidden flex-shrink-0">
        <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: 'var(--border-subtle)' }}>
          <h3 className="flex items-center gap-2 text-sm font-semibold" style={{ fontFamily: "'Space Grotesk', sans-serif", color: 'var(--text-primary)' }}>
            <RadioTower className="w-4 h-4" style={{ color: 'var(--accent)' }} />
            Live Network Topology
          </h3>
          <div className="flex items-center gap-3 text-[10px]" style={{ color: 'var(--text-muted)' }}>
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: '#F43F5E' }} />Critical
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: '#F59E0B' }} />Degraded
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: '#00D4FF' }} />Online
            </span>
          </div>
        </div>

        <div className="relative h-48" style={{ background: 'rgba(0,0,0,0.3)' }}>
          {/* Grid */}
          <div className="absolute inset-0"
               style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)', backgroundSize: '28px 28px' }} />
          {/* Radial fade */}
          <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse 70% 70% at 50% 50%, transparent 40%, rgba(6,10,18,0.8) 100%)' }} />

          <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
            {edges.map((e, i) => (
              <line key={i}
                x1={e.a.x} y1={e.a.y} x2={e.b.x} y2={e.b.y}
                stroke={e.critical ? 'rgba(244,63,94,0.25)' : 'rgba(0,212,255,0.12)'}
                strokeWidth="0.4" strokeDasharray="1.5 2" />
            ))}
          </svg>

          {TOWER_MAP.map(t => {
            const color = TOWER_COLOR[t.status];
            const inc = incidents.find(i => i.tower === t.id);
            const isSelected = selectedIncident?.tower === t.id;
            return (
              <div
                key={t.id}
                className="absolute cursor-pointer"
                style={{ left: `${t.x}%`, top: `${t.y}%`, transform: 'translate(-50%, -50%)' }}
                onClick={() => inc && onSelectIncident(inc)}
                onMouseEnter={() => setHovered(t.id)}
                onMouseLeave={() => setHovered(null)}
              >
                {/* Ping ring for critical */}
                {t.status === 'critical' && (
                  <div className="absolute inset-0 rounded-full animate-ping"
                       style={{ width: 28, height: 28, top: -8, left: -8, background: `${color}20`, animationDuration: '1.5s' }} />
                )}
                {/* Dot */}
                <div
                  className="relative w-3 h-3 rounded-full transition-transform duration-150"
                  style={{
                    background: color,
                    boxShadow: `0 0 ${isSelected ? 14 : 8}px ${color}`,
                    transform: isSelected || hovered === t.id ? 'scale(1.5)' : 'scale(1)',
                    border: isSelected ? `2px solid ${color}` : '1.5px solid rgba(255,255,255,0.3)',
                  }}
                />
                {/* Tooltip */}
                {hovered === t.id && (
                  <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 whitespace-nowrap px-2 py-1 rounded text-[10px] font-mono z-20 pointer-events-none"
                       style={{ background: 'rgba(6,10,18,0.95)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}>
                    {t.id}
                    {inc && <span className="ml-1.5" style={{ color }}>{inc.severity}</span>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Incident Queue ── */}
      <div className="glass-panel flex flex-col overflow-hidden flex-1 min-h-0">
        <div className="px-4 py-3 border-b flex items-center justify-between flex-shrink-0"
             style={{ borderColor: 'var(--border-subtle)', background: 'rgba(255,255,255,0.015)' }}>
          <h2 className="flex items-center gap-2 font-semibold" style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 14, color: 'var(--text-primary)' }}>
            <AlertTriangle className="w-4 h-4" style={{ color: '#F59E0B' }} />
            Incident Queue
          </h2>
          <span className="badge badge-p0 text-[10px]">
            {incidents.filter(i => i.severity === 'P0').length} Critical
          </span>
        </div>

        <div className="overflow-y-auto p-3 space-y-2 flex-1">
          {incidents.map(inc => {
            const isSelected = selectedIncident?.id === inc.id;
            const severityClass = inc.severity === 'P0' ? 'p0' : inc.severity === 'P1' ? 'p1' : 'p2';

            return (
              <div
                key={inc.id}
                onClick={() => onSelectIncident(inc)}
                className={`incident-card ${severityClass} ${isSelected ? 'selected' : ''}`}
              >
                {/* Top row */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className={`badge badge-${inc.severity.toLowerCase()}`}>{inc.severity}</span>
                    <span className="font-semibold text-sm" style={{ fontFamily: "'Space Grotesk', sans-serif", color: 'var(--text-primary)' }}>
                      {inc.tower}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded" style={{ background: 'rgba(255,255,255,0.04)', color: 'var(--text-muted)', fontFamily: "'JetBrains Mono', monospace" }}>
                      {inc.id}
                    </span>
                  </div>
                  <span className="flex items-center gap-1 text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>
                    <Clock className="w-3 h-3" />{inc.time}
                  </span>
                </div>

                {/* Log line */}
                <p className="text-xs mb-3 leading-relaxed line-clamp-2" style={{ color: 'var(--text-secondary)' }}>
                  {inc.logs}
                </p>

                {/* Metrics row */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 text-[10px]" style={{ color: 'var(--text-muted)' }}>
                    <span className="flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, color: inc.affected_users > 0 ? '#F43F5E' : 'var(--text-muted)' }}>
                        {inc.affected_users.toLocaleString()}
                      </span> users
                    </span>
                    <span className="flex items-center gap-1">
                      <Signal className="w-3 h-3" />
                      <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, color: inc.coverage < 50 ? '#F59E0B' : '#10B981' }}>
                        {inc.coverage}%
                      </span> coverage
                    </span>
                  </div>
                  {isSelected && (
                    <span className="flex items-center gap-1 text-[10px] font-medium" style={{ color: 'var(--accent)' }}>
                      Analyzing <ChevronRight className="w-3 h-3" />
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
