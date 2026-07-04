from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import asyncio
from typing import Dict, Any

from app.agent.workflow import agent_app

app = FastAPI(title="Telecom Enterprise Agent API")

# Allow CORS for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class TriggerRequest(BaseModel):
    tower_id: str
    event_type: str
    logs: str

@app.post("/api/trigger")
async def trigger_agent(request: TriggerRequest):
    initial_state = {
        "event": {
            "tower_id": request.tower_id,
            "event_type": request.event_type,
            "logs": request.logs
        },
        "severity": "",
        "incidents": [],
        "predicted_cause": "",
        "sla_hours": 0.0,
        "dispatch_plan": [],
        "report": "",
        "messages": []
    }
    
    # We will simulate a streaming response or just return the final state for simplicity
    # LangGraph execute
    final_state = agent_app.invoke(initial_state)
    
    return {
        "status": "success",
        "report": final_state.get("report", ""),
        "messages": final_state.get("messages", []),
        "severity": final_state.get("severity", ""),
        "predicted_cause": final_state.get("predicted_cause", "")
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
