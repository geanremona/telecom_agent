import React from 'react';
import { AlertTriangle, MapPin, RadioTower, Clock, ChevronRight } from 'lucide-react';

const Dashboard = ({ incidents, selectedIncident, onSelectIncident }) => {
  return (
    <div className="flex flex-col gap-6 h-full">
      
      {/* Map Placeholder Area */}
      <div className="glass-panel overflow-hidden relative h-64 flex-shrink-0 group">
        <div className="absolute inset-0 bg-slate-800/80 bg-[radial-gradient(#334155_1px,transparent_1px)] [background-size:16px_16px] opacity-20"></div>
        
        {/* Fake map points */}
        <div className="absolute top-1/3 left-1/4">
          <div className="w-16 h-16 bg-red-500/20 rounded-full animate-ping absolute -inset-6"></div>
          <MapPin className="w-6 h-6 text-red-500 relative z-10 drop-shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
        </div>
        <div className="absolute top-2/3 right-1/3">
          <MapPin className="w-5 h-5 text-emerald-500 drop-shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
        </div>
        <div className="absolute top-1/4 right-1/4">
          <MapPin className="w-5 h-5 text-emerald-500 drop-shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
        </div>

        <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-slate-900 to-transparent">
          <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
            <RadioTower className="w-4 h-4" /> Live Network Map
          </h3>
        </div>
      </div>

      {/* Incident Queue */}
      <div className="glass-panel flex-1 flex flex-col overflow-hidden">
        <div className="p-4 border-b border-slate-700/50 bg-slate-800/30 flex justify-between items-center">
          <h2 className="font-semibold text-lg flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            Active Alerts
          </h2>
          <span className="bg-slate-700 text-xs px-2 py-1 rounded-md font-medium">{incidents.length} items</span>
        </div>
        
        <div className="overflow-y-auto p-2 space-y-2">
          {incidents.map(inc => {
            const isSelected = selectedIncident?.id === inc.id;
            const severityColor = inc.severity === 'P0' ? 'text-red-400 bg-red-400/10 border-red-400/20' : 
                                  inc.severity === 'P1' ? 'text-amber-400 bg-amber-400/10 border-amber-400/20' :
                                  'text-slate-400 bg-slate-800 border-slate-700';
            
            return (
              <div 
                key={inc.id}
                onClick={() => onSelectIncident(inc)}
                className={`p-4 rounded-lg border transition-all cursor-pointer hover:bg-slate-800/50 flex flex-col gap-3
                  ${isSelected ? 'border-cyan-500/50 bg-cyan-950/20 shadow-[0_0_15px_rgba(6,182,212,0.1)]' : 'border-slate-800 bg-slate-900/40'}`}
              >
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-bold border ${severityColor}`}>
                      {inc.severity}
                    </span>
                    <span className="font-mono text-sm text-slate-300 font-medium">{inc.tower}</span>
                  </div>
                  <span className="text-xs text-slate-500 flex items-center gap-1">
                    <Clock className="w-3 h-3" /> {inc.time}
                  </span>
                </div>
                
                <p className="text-sm text-slate-400 truncate">{inc.logs}</p>
                
                {isSelected && (
                  <div className="text-xs text-cyan-400 font-medium flex items-center gap-1 self-end mt-1 animate-pulse">
                    Selected for Analysis <ChevronRight className="w-3 h-3" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
