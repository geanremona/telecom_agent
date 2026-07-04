import React, { useState } from 'react';
import Dashboard from './components/Dashboard';
import AgentInterface from './components/AgentInterface';
import { Activity, ShieldAlert, Cpu } from 'lucide-react';

function App() {
  const [selectedIncident, setSelectedIncident] = useState(null);

  const incidents = [
    { id: 'INC-2026-89', tower: 'TOWER-42', status: 'Active', severity: 'P0', time: '14:30:00Z', logs: 'Battery voltage drop to 12V.' },
    { id: 'INC-2026-90', tower: 'TOWER-18', status: 'Pending', severity: 'P1', time: '14:45:00Z', logs: 'Signal fluctuation detected.' },
    { id: 'INC-2026-91', tower: 'TOWER-09', status: 'Resolved', severity: 'P3', time: '10:15:00Z', logs: 'Routine maintenance complete.' }
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 selection:bg-cyan-500/30 font-sans flex flex-col">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-cyan-500/10 rounded-lg border border-cyan-500/20">
              <Activity className="w-6 h-6 text-cyan-400" />
            </div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
              Nexus Network Ops
            </h1>
          </div>
          <div className="flex items-center gap-4 text-sm font-medium">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-800/50 border border-slate-700">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              System Optimal
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-800/50 border border-slate-700 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer">
              <Cpu className="w-4 h-4" />
              Agent Active
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Dashboard */}
        <div className="lg:col-span-5 space-y-6">
          <Dashboard 
            incidents={incidents} 
            selectedIncident={selectedIncident} 
            onSelectIncident={setSelectedIncident} 
          />
        </div>

        {/* Right Column: Agent Interface */}
        <div className="lg:col-span-7 h-[calc(100vh-8rem)]">
          <AgentInterface incident={selectedIncident} />
        </div>

      </main>
    </div>
  );
}

export default App;
