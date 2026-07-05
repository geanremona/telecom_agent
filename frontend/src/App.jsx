import React, { useState, useEffect } from 'react';
import Dashboard from './components/Dashboard';
import AgentInterface from './components/AgentInterface';
import { Activity, Cpu, Shield, Wifi, AlertTriangle, TrendingDown } from 'lucide-react';

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

// Live stats that tick over time for drama
const useNetworkStats = () => {
  const [stats, setStats] = useState({
    towers: 1847,
    active_alerts: 3,
    uptime: 99.3,
    affected_users: 24600,
  });

  useEffect(() => {
    const iv = setInterval(() => {
      setStats(s => ({
        ...s,
        affected_users: s.affected_users + Math.floor((Math.random() - 0.5) * 40),
      }));
    }, 3000);
    return () => clearInterval(iv);
  }, []);

  return stats;
};

function App() {
  const [selectedIncident, setSelectedIncident] = useState(null);
  const stats = useNetworkStats();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 selection:bg-cyan-500/30 font-sans flex flex-col">

      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-cyan-500/10 rounded-lg border border-cyan-500/20">
              <Activity className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <h1 className="text-base font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent leading-none">
                Nexus Network Ops
              </h1>
              <p className="text-[9px] text-slate-500 leading-none mt-0.5 uppercase tracking-wider">Enterprise AI Agent · Telecom</p>
            </div>
          </div>

          {/* Live stats bar */}
          <div className="hidden md:flex items-center gap-2 text-xs">
            <StatPill icon={<Wifi className="w-3 h-3" />} label="Towers Online" value={`${stats.towers.toLocaleString()}`} color="text-emerald-400" />
            <StatPill icon={<AlertTriangle className="w-3 h-3" />} label="Active Alerts" value={String(stats.active_alerts)} color="text-amber-400" />
            <StatPill icon={<TrendingDown className="w-3 h-3" />} label="Affected Users" value={stats.affected_users.toLocaleString()} color="text-red-400" />
            <StatPill icon={<Shield className="w-3 h-3" />} label="Network Uptime" value={`${stats.uptime}%`} color="text-cyan-400" />
          </div>

          <div className="flex items-center gap-2 text-xs">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-800/60 border border-slate-700">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-slate-400">System Nominal</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300">
              <Cpu className="w-3 h-3" />
              <span>Agent v2.0 Active</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main layout */}
      <main className="flex-1 max-w-screen-2xl mx-auto w-full px-4 sm:px-6 py-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-4 flex flex-col gap-5 min-h-0">
          <Dashboard
            incidents={INCIDENTS}
            selectedIncident={selectedIncident}
            onSelectIncident={setSelectedIncident}
          />
        </div>
        <div className="lg:col-span-8 h-[calc(100vh-8rem)]">
          <AgentInterface incident={selectedIncident} />
        </div>
      </main>
    </div>
  );
}

const StatPill = ({ icon, label, value, color }) => (
  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-800/60 border border-slate-700/50">
    <span className={color}>{icon}</span>
    <span className="text-slate-500">{label}:</span>
    <span className={`font-semibold ${color}`}>{value}</span>
  </div>
);

export default App;
