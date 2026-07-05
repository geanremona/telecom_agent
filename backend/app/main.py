import json
import asyncio
import os
from fastapi import FastAPI, Depends, HTTPException, Security
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.security.api_key import APIKeyHeader
from pydantic import BaseModel, Field
from typing import Dict, Any, Optional

from app.agent.workflow import agent_app

app = FastAPI(title="Nexus Telecom Enterprise Agent API", version="2.0.0")

# Security: CORS restriction
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173,http://136.244.111.138:5173").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Security: API Key Authentication
API_KEY = os.getenv("API_KEY", "nexus-hackathon-demo-key-2026")
api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)

def get_api_key(api_key_header: str = Security(api_key_header)):
    if api_key_header == API_KEY:
        return api_key_header
    raise HTTPException(status_code=403, detail="Could not validate credentials")

# Security: Input Validation
class TriggerRequest(BaseModel):
    incident_id: str = Field(default="INC-2026-89", pattern=r"^INC-\d{4}-\d{2,4}$", max_length=20)
    tower_id: str = Field(pattern=r"^TOWER-\d{2,4}$", max_length=20)
    event_type: str = Field(max_length=50)
    logs: str = Field(max_length=2000)

class FeedbackRequest(BaseModel):
    incident_id: str = Field(max_length=20)
    cause_key: str = Field(max_length=50)
    action: str = Field(pattern=r"^(approve|dismiss)$")

# ── SSE Helper ────────────────────────────────────────────────────────────────
def sse_event(event_type: str, data: Any) -> str:
    """Format a Server-Sent Event message."""
    payload = json.dumps({"type": event_type, "data": data})
    return f"data: {payload}\n\n"


# ── NODE METADATA ─────────────────────────────────────────────────────────────
NODE_META = {
    "triage":             {"label": "Triage & Severity Classification",     "icon": "🔎"},
    "retrieve_incidents": {"label": "Retrieve Incident History",             "icon": "📂"},
    "rca":                {"label": "Root Cause Analysis",                   "icon": "🧠"},
    "threat_analysis":    {"label": "Zero-Day Threat Analysis",              "icon": "🛡️"},
    "retrieve_sla":       {"label": "Retrieve SLA Contract Document",        "icon": "📄"},
    "decision":           {"label": "Agent Decision & Path Selection",       "icon": "⚡"},
    "dispatch":           {"label": "Dispatch Planning",                     "icon": "🚛"},
    "escalate":           {"label": "Vendor Escalation",                     "icon": "🚨"},
    "report":             {"label": "Generate Priority Action Report",       "icon": "📋"},
}


# ── STREAMING ENDPOINT ────────────────────────────────────────────────────────
@app.post("/api/stream")
async def stream_agent(request: TriggerRequest, api_key: str = Depends(get_api_key)):
    """
    Streams LangGraph node outputs as Server-Sent Events.
    Each node emits a structured event with its name, label, tool calls, and output.
    """
    initial_state = {
        "event": {
            "incident_id": request.incident_id,
            "tower_id": request.tower_id,
            "event_type": request.event_type,
            "logs": request.logs,
        },
        "severity": "", "triage_reasoning": "",
        "incident_tool_call": {}, "incidents": [], "incident_pattern": "",
        "predicted_cause": "", "confidence": "", "rca_reasoning": "",
        "sla_tool_call": {}, "sla_doc": None, "sla_hours": 4.0, "sla_breach_risk": False,
        "decision": "", "decision_reasoning": "",
        "inventory_tool_call": {}, "crew_tool_call": {}, "dispatch_plan": [],
        "escalation_tool_call": {}, "escalation_result": None,
        "report": "", "citations": [],
        "messages": [],
    }

    async def generate():
        yield sse_event("start", {"message": "Agent initializing…", "total_nodes": len(NODE_META)})
        await asyncio.sleep(0.1)

        # Accumulate full state across all streaming chunks — avoids running the
        # workflow a second time via invoke() which caused crashes for some towers.
        accumulated_state: Dict[str, Any] = {**initial_state}

        try:
            # LangGraph stream yields {node_name: output_dict} dicts
            for chunk in agent_app.stream(initial_state):
                for node_name, node_output in chunk.items():
                    if node_name == "__end__":
                        continue

                    # Merge this node's output into the running state
                    accumulated_state.update(node_output)

                    meta = NODE_META.get(node_name, {"label": node_name, "icon": "🔷"})
                    await asyncio.sleep(0.5)

                    # Build structured tool_calls list for this node
                    tool_calls = []
                    if node_name == "retrieve_incidents" and node_output.get("incident_tool_call"):
                        tc = node_output["incident_tool_call"]
                        tool_calls.append({
                            "tool": tc.get("tool"),
                            "input": tc.get("input"),
                            "citation": tc.get("citation"),
                            "output_summary": f"{len(tc.get('output', []))} incident records retrieved",
                            "output": tc.get("output"),
                        })
                    elif node_name == "retrieve_sla" and node_output.get("sla_tool_call"):
                        tc = node_output["sla_tool_call"]
                        doc = tc.get("output")
                        tool_calls.append({
                            "tool": tc.get("tool"),
                            "input": tc.get("input"),
                            "citation": tc.get("citation"),
                            "output_summary": doc.get("title") if doc else "No SLA document found",
                            "excerpt": (
                                list(doc["clauses"].values())[0].get("excerpt") if doc else None
                            ),
                        })
                    elif node_name == "threat_analysis" and node_output.get("threat_tool_call"):
                        tc = node_output["threat_tool_call"]
                        result = tc.get("output", {})
                        tool_calls.append({
                            "tool": tc.get("tool"),
                            "input": tc.get("input"),
                            "citation": tc.get("citation"),
                            "output_summary": result.get("description", "No threat found") if result.get("match_found") else "Clean - No threats detected",
                        })
                    elif node_name == "dispatch":
                        if node_output.get("inventory_tool_call") and node_output["inventory_tool_call"].get("tool"):
                            tc = node_output["inventory_tool_call"]
                            item = tc.get("output", {})
                            tool_calls.append({
                                "tool": tc.get("tool"),
                                "input": tc.get("input"),
                                "citation": tc.get("citation"),
                                "output_summary": f"{item.get('status', 'Unknown')} — Stock: {item.get('stock', 0)}",
                            })
                        if node_output.get("crew_tool_call") and node_output["crew_tool_call"].get("tool"):
                            tc = node_output["crew_tool_call"]
                            crews = tc.get("output", [])
                            tool_calls.append({
                                "tool": tc.get("tool"),
                                "input": tc.get("input"),
                                "citation": tc.get("citation"),
                                "output_summary": f"{len(crews)} qualified crew(s) available",
                            })
                    elif node_name == "escalate":
                        if node_output.get("escalation_tool_call") and node_output["escalation_tool_call"].get("tool"):
                            tc = node_output["escalation_tool_call"]
                            result = tc.get("output", {})
                            tool_calls.append({
                                "tool": tc.get("tool"),
                                "input": tc.get("input"),
                                "citation": tc.get("citation"),
                                "output_summary": f"Ticket: {result.get('escalation_ticket')} — {result.get('status')}",
                            })
                        if node_output.get("crew_tool_call") and node_output["crew_tool_call"].get("tool"):
                            tc = node_output["crew_tool_call"]
                            crews = tc.get("output", [])
                            tool_calls.append({
                                "tool": tc.get("tool"),
                                "input": tc.get("input"),
                                "citation": tc.get("citation"),
                                "output_summary": f"{len(crews)} crew(s) dispatched for parallel triage",
                            })

                    # Extract the last message emitted by this node
                    messages_so_far = node_output.get("messages", [])
                    last_message = messages_so_far[-1] if messages_so_far else ""

                    event_payload = {
                        "node": node_name,
                        "label": meta["label"],
                        "icon": meta["icon"],
                        "message": last_message,
                        "tool_calls": tool_calls,
                        "output": {
                            k: v for k, v in node_output.items()
                            if k not in ("messages", "incident_tool_call", "sla_tool_call",
                                         "inventory_tool_call", "crew_tool_call", "escalation_tool_call")
                        }
                    }
                    yield sse_event("node_complete", event_payload)

            # Emit complete event using the accumulated state — no second invoke() needed
            yield sse_event("complete", {
                "report": accumulated_state.get("report", ""),
                "citations": accumulated_state.get("citations", []),
                "decision": accumulated_state.get("decision", ""),
                "severity": accumulated_state.get("severity", ""),
                "predicted_cause": accumulated_state.get("predicted_cause", ""),
                "dispatch_plan": accumulated_state.get("dispatch_plan", []),
            })

        except Exception as e:
            yield sse_event("error", {"message": str(e)})

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        }
    )


# ── LEGACY SYNC ENDPOINT (kept for compatibility) ──────────────────────────────
@app.post("/api/trigger")
async def trigger_agent(request: TriggerRequest, api_key: str = Depends(get_api_key)):
    initial_state = {
        "event": {
            "incident_id": request.incident_id,
            "tower_id": request.tower_id,
            "event_type": request.event_type,
            "logs": request.logs,
        },
        "severity": "", "triage_reasoning": "",
        "incident_tool_call": {}, "incidents": [], "incident_pattern": "",
        "predicted_cause": "", "confidence": "", "rca_reasoning": "",
        "sla_tool_call": {}, "sla_doc": None, "sla_hours": 4.0, "sla_breach_risk": False,
        "decision": "", "decision_reasoning": "",
        "inventory_tool_call": {}, "crew_tool_call": {}, "dispatch_plan": [],
        "escalation_tool_call": {}, "escalation_result": None,
        "report": "", "citations": [],
        "messages": [],
    }
    final_state = agent_app.invoke(initial_state)
    return {
        "status": "success",
        "report": final_state.get("report", ""),
        "messages": final_state.get("messages", []),
        "severity": final_state.get("severity", ""),
        "predicted_cause": final_state.get("predicted_cause", ""),
        "decision": final_state.get("decision", ""),
        "citations": final_state.get("citations", []),
    }


@app.get("/api/health")
def health(api_key: str = Depends(get_api_key)):
    return {"status": "ok", "agent": "Nexus Network Ops Agent v2.0"}

# ── RLHF FEEDBACK ENDPOINT ───────────────────────────────────────────────────
from app.agent.knowledge_base import update_sensitivity, log_feedback

@app.post("/api/feedback")
def submit_feedback(request: FeedbackRequest, api_key: str = Depends(get_api_key)):
    """
    RLHF Loop Endpoint: Updates the agent's internal thresholds based on human feedback.
    """
    new_val = update_sensitivity(request.cause_key, request.action)
    log_feedback(request.incident_id, request.cause_key, request.action)
    return {"status": "success", "cause_key": request.cause_key, "new_sensitivity": new_val}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
