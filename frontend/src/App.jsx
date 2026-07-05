import React, { useState, useEffect } from 'react';
import Dashboard from './components/Dashboard';
import AgentInterface from './components/AgentInterface';
import { Activity, Cpu, Shield, Wifi, AlertTriangle, TrendingDown, Radio } from 'lucide-react';

const INCIDENTS = [
  {
    id: 'INC-2026-89',
    tower: 'TOWER-42',
    status: 'Active',
    severity: 'P0',
    time: '14:30:00Z',
    logs: 'CRIT: Battery voltage drop to 12V detected. Rectifier alarm active. Backup power engaged. UPS runtime est. 45 min remaining.',
    affected_users: 18400,
    coverage: 0,
    region: 'Zone North-A',
  },
  {
    id: 'INC-2026-90',
    tower: 'TOWER-18',
    status: 'Pending',
    severity: 'P1',
    time: '14:45:00Z',
    logs: 'WARN: Signal fluctuation on sector 2/3. Packet loss 18%. Antenna bearing deviation detected. Handoff failure rate +340%.',
    affected_users: 6200,
    coverage: 62,
    region: 'Zone East-B',
  },
  {
    id: 'INC-2026-91',
    tower: 'TOWER-09',
    status: 'Resolved',
    severity: 'P3',
    time: '10:15:00Z',
    logs: 'INFO: Routine maintenance complete. Signal levels nominal. Fiber optic inspection passed. All systems green.',
    affected_users: 0,
    coverage: 100,
    region: 'Zone West-C',
  },
];

const useNetworkStats = () => {
  const [stats, setStats] = useState({ towers: 1847, alerts: 3, uptime: 99.3, affected: 24600 });
  useEffect(() => {
    const iv = setInterval(() => {
      setStats(s => ({ ...s, affected: Math.max(0, s.affected + Math.floor((Math.random() - 0.5) * 60)) }));
    }, 3500);
    return () => clearInterval(iv);
  }, []);
  return stats;
};

function App() {
  const [selectedIncident, setSelectedIncident] = useState(null);
  const stats = useNetworkStats();

  return (
    <>
      {/* Background scene */}
      <div className="app-bg">
        <div className="app-bg-grid" />
      </div>

      <div className="relative z-10 min-h-screen flex flex-col">
        {/* ── Header ── */}
        <header className="app-header">
          <div className="max-w-screen-2xl mx-auto px-5 h-14 flex items-center justify-between gap-4">

            {/* Logo */}
            <div className="flex items-center gap-3 flex-shrink-0">
              <div className="logo-icon">
                <Activity className="w-5 h-5 text-[#00D4FF]" />
              </div>
              <div className="leading-none">
                <div className="logo-text text-base font-bold" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                  Nexus Network Ops
                </div>
                <div className="text-[9px] font-medium tracking-widest uppercase mt-0.5" style={{ color: 'var(--text-muted)', fontFamily: "'Space Grotesk', sans-serif" }}>
                  Enterprise AI Agent · Telecom
                </div>
              </div>
            </div>

            {/* Live stats */}
            <div className="hidden lg:flex items-center gap-2">
              <StatPill icon={<Wifi className="w-3 h-3" />} label="Towers" value={stats.towers.toLocaleString()} color="#00D4FF" />
              <StatPill icon={<AlertTriangle className="w-3 h-3" />} label="Alerts" value={String(stats.alerts)} color="#F59E0B" />
              <StatPill icon={<TrendingDown className="w-3 h-3" />} label="Affected" value={stats.affected.toLocaleString()} color="#F43F5E" />
              <StatPill icon={<Shield className="w-3 h-3" />} label="Uptime" value={`${stats.uptime}%`} color="#10B981" />
            </div>

            {/* Status */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <div className="status-live">
                <span className="dot" />
                <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 11 }}>All Systems Nominal</span>
              </div>
              <div className="stat-pill" style={{ color: 'var(--indigo)', borderColor: 'rgba(129,140,248,0.2)', background: 'rgba(129,140,248,0.06)' }}>
                <Cpu className="w-3 h-3" />
                <span>Agent v2.0</span>
              </div>
            </div>
          </div>
        </header>

        {/* ── Main Layout ── */}
        <main className="flex-1 max-w-screen-2xl mx-auto w-full px-4 sm:px-5 py-5 grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-4 min-h-0">
            <Dashboard
              incidents={INCIDENTS}
              selectedIncident={selectedIncident}
              onSelectIncident={setSelectedIncident}
            />
          </div>
          <div className="lg:col-span-8 h-[calc(100vh-7.5rem)]">
            <AgentInterface incident={selectedIncident} />
          </div>
        </main>
      </div>
    </>
  );
}

function StatPill({ icon, label, value, color }) {
  return (
    <div className="stat-pill">
      <span style={{ color }}>{icon}</span>
      <span style={{ color: 'var(--text-muted)' }}>{label}:</span>
      <span style={{ color, fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600 }}>{value}</span>
    </div>
  );
}

export default App;
