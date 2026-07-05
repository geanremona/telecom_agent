import json
import asyncio
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Dict, Any, Optional

from app.agent.workflow import agent_app

app = FastAPI(title="Nexus Telecom Enterprise Agent API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class TriggerRequest(BaseModel):
    incident_id: str = "INC-2026-89"
    tower_id: str
    event_type: str
    logs: str


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
    "retrieve_sla":       {"label": "Retrieve SLA Contract Document",        "icon": "📄"},
    "decision":           {"label": "Agent Decision & Path Selection",       "icon": "⚡"},
    "dispatch":           {"label": "Dispatch Planning",                     "icon": "🚛"},
    "escalate":           {"label": "Vendor Escalation",                     "icon": "🚨"},
    "report":             {"label": "Generate Priority Action Report",       "icon": "📋"},
}


# ── STREAMING ENDPOINT ────────────────────────────────────────────────────────
@app.post("/api/stream")
async def stream_agent(request: TriggerRequest):
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
async def trigger_agent(request: TriggerRequest):
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
def health():
    return {"status": "ok", "agent": "Nexus Network Ops Agent v2.0"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
