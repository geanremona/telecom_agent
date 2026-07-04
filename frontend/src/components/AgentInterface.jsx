import React, { useState } from 'react';
import { Play, Bot, FileText, CheckCircle2, Loader2, Sparkles } from 'lucide-react';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';

const AgentInterface = ({ incident }) => {
  const [isRunning, setIsRunning] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const [agentData, setAgentData] = useState(null);

  const handleTriggerAgent = async () => {
    if (!incident) return;
    setIsRunning(true);
    setIsDone(false);
    setAgentData(null);
    
    try {
      // Simulate network delay for UI effect, then call real backend
      await new Promise(r => setTimeout(r, 600)); 
      
      const res = await axios.post('http://localhost:8000/api/trigger', {
        tower_id: incident.tower,
        event_type: 'Outage',
        logs: incident.logs
      });
      
      // Simulate step-by-step UI updates
      let data = res.data;
      setAgentData({ messages: [], report: '' });
      
      for(let i=0; i < data.messages.length; i++) {
        await new Promise(r => setTimeout(r, 500)); // artificial delay for typing effect
        setAgentData(prev => ({
          ...prev,
          messages: [...prev.messages, data.messages[i]]
        }));
      }
      
      await new Promise(r => setTimeout(r, 400));
      setAgentData(prev => ({
        ...prev,
        report: data.report
      }));
      
      setIsDone(true);
    } catch (err) {
      console.error(err);
      setAgentData({ messages: ["Error connecting to Agent API"], report: "Backend might not be running on port 8000." });
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="glass-panel h-full flex flex-col overflow-hidden relative">
      
      {/* Header */}
      <div className="p-4 border-b border-slate-700/50 bg-slate-800/30 flex justify-between items-center z-10">
        <h2 className="font-semibold text-lg flex items-center gap-2">
          <Bot className="w-5 h-5 text-indigo-400" />
          Agentic Operations
        </h2>
        
        <button 
          onClick={handleTriggerAgent}
          disabled={!incident || isRunning}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all shadow-lg
            ${!incident ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700' : 
              isRunning ? 'bg-indigo-600 text-white cursor-wait' : 
              'bg-gradient-to-r from-indigo-500 to-cyan-500 text-white hover:shadow-cyan-500/25 hover:scale-[1.02]'}`}
        >
          {isRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
          {isRunning ? 'Agent Reasoning...' : 'Trigger Analysis'}
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto flex flex-col p-6 gap-6 relative z-10">
        
        {!incident && !agentData && (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-500 gap-4">
            <Sparkles className="w-12 h-12 opacity-20" />
            <p>Select an incident from the queue to begin analysis.</p>
          </div>
        )}

        {incident && !agentData && !isRunning && (
          <div className="flex-1 flex items-center justify-center text-slate-400">
            Ready to analyze {incident.tower}. Click 'Trigger Analysis'.
          </div>
        )}

        {/* Reasoning Steps */}
        {agentData && agentData.messages.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Agent Thought Process</h3>
            {agentData.messages.map((msg, idx) => (
              <div key={idx} className="flex items-start gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="mt-1 flex-shrink-0">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                </div>
                <div className="bg-slate-800/60 border border-slate-700/50 rounded-lg p-3 text-sm text-slate-300 w-full">
                  {msg}
                </div>
              </div>
            ))}
            {isRunning && (
              <div className="flex items-start gap-3">
                <Loader2 className="w-4 h-4 text-indigo-400 animate-spin mt-1" />
                <span className="text-sm text-slate-500 animate-pulse">Consulting documents...</span>
              </div>
            )}
          </div>
        )}

        {/* Final Report */}
        {agentData?.report && (
          <div className="mt-4 animate-in fade-in zoom-in-95 duration-500 delay-150">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
              <FileText className="w-4 h-4" /> Final Action Report
            </h3>
            <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 shadow-2xl prose prose-invert prose-slate max-w-none prose-headings:text-slate-100 prose-a:text-cyan-400 hover:prose-a:text-cyan-300">
              <ReactMarkdown>{agentData.report}</ReactMarkdown>
            </div>
          </div>
        )}

      </div>
      
      {/* Decorative gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-indigo-500/5 via-transparent to-cyan-500/5 pointer-events-none"></div>
    </div>
  );
};

export default AgentInterface;
