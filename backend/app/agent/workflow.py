import datetime
from typing import TypedDict, Annotated, List, Dict, Any
from langgraph.graph import StateGraph, END
import app.database.mock_data as db

# Define the state of our agent
class AgentState(TypedDict):
    event: Dict[str, Any]
    severity: str
    incidents: List[Dict[str, Any]]
    predicted_cause: str
    sla_hours: float
    dispatch_plan: List[Dict[str, Any]]
    report: str
    messages: Annotated[list, "messages"]

# Node 1: Triage
def triage_node(state: AgentState):
    event = state.get("event", {})
    # Mocking classification
    severity = "P0 (Full Outage)" if "voltage drop" in event.get("logs", "").lower() else "P1 (Degraded)"
    state["messages"].append(f"Triaged event as {severity}")
    return {"severity": severity}

# Node 2: Retrieve Incidents
def retrieve_node(state: AgentState):
    tower_id = state.get("event", {}).get("tower_id", "TOWER-42")
    incidents = db.query_incidents(tower_id)
    state["messages"].append(f"Retrieved {len(incidents)} past incidents for {tower_id}")
    return {"incidents": incidents}

# Node 3: Root Cause Analysis
def rca_node(state: AgentState):
    incidents = state.get("incidents", [])
    predicted_cause = "Unknown"
    confidence = "Low"
    if len(incidents) >= 3 and all(i["root_cause"] == "Faulty rectifier" for i in incidents[:3]):
        predicted_cause = "Faulty rectifier"
        confidence = "92%"
    state["messages"].append(f"Predicted cause: {predicted_cause} (Confidence: {confidence})")
    
    # Check SLA
    sla = db.get_sla("VendorX", "rectifier_replacement")
    
    return {"predicted_cause": predicted_cause, "sla_hours": sla}

# Node 4: Dispatch Planning
def dispatch_node(state: AgentState):
    plan = []
    
    # Step 1: Schedule Crew
    crews = db.get_available_crews("Electrical")
    crew = crews[0]["name"] if crews else "Unknown Crew"
    plan.append({
        "step": 1, "action": f"Dispatch {crew} (Cert: Electrical)", 
        "owner": "Ops Team", "eta": "2026-07-05T15:00Z", "status": "✅ On Track"
    })
    
    # Step 2: Check Inventory
    part_info = db.check_inventory("Rectifier Part #X-2000")
    if part_info["stock"] == 0:
        plan.append({
            "step": 2, "action": "Order Rectifier Part #X-2000", 
            "owner": "Inventory", "eta": "2026-07-05T16:00Z", "status": "⚠️ Delay Risk"
        })
    
    # Step 3: Escalate if SLA at risk
    sla_hours = state.get("sla_hours", 4.0)
    if part_info["stock"] == 0 and sla_hours <= 4.0:
        plan.append({
            "step": 3, "action": "Escalate to Vendor Y", 
            "owner": "Agent", "eta": "2026-07-05T17:00Z", "status": "❌ SLA Breach"
        })
    
    state["messages"].append(f"Generated dispatch plan with {len(plan)} steps")
    return {"dispatch_plan": plan}

# Node 5: Execute & Report
def report_node(state: AgentState):
    event = state.get("event", {})
    severity = state.get("severity", "Unknown")
    predicted_cause = state.get("predicted_cause", "Unknown")
    plan = state.get("dispatch_plan", [])
    
    plan_table = " | Step | Action | Owner | ETA | SLA Status |\n |---|---|---|---|---|\n"
    for p in plan:
        plan_table += f" | {p['step']} | {p['action']} | {p['owner']} | {p['eta']} | {p['status']} |\n"
        
    report = f"""# **Priority Action Report: {event.get("tower_id", "Unknown")} Outage**
**Timestamp:** 2026-07-05T14:30:00Z
**Severity:** {severity}

---
## **Root Cause Analysis**
- **Predicted Cause:** {predicted_cause} (92% confidence).
- **Evidence:**
  - [Log 2026-07-04](s3://logs/tower42/2026-07-04.pdf): "{event.get("logs", "No logs provided.")}"
  - [Vendor SLA](s3://contracts/vendorX.pdf): "Rectifier replacement within 4h."
  - Past {len(state.get("incidents", []))} incidents at this tower: Same symptoms → rectifier failure.

---
## **Dispatch Plan**
{plan_table}

---
## **Citations**
- [Maintenance Log](s3://logs/tower42/2026-07-04.pdf)
- [Vendor Contract](s3://contracts/vendorX.pdf)
- [Crew Availability](workday://crews/A)
"""
    state["messages"].append("Action report generated")
    return {"report": report}

# Build the Graph
workflow = StateGraph(AgentState)

workflow.add_node("triage", triage_node)
workflow.add_node("retrieve_incidents", retrieve_node)
workflow.add_node("predict_rca", rca_node)
workflow.add_node("dispatch", dispatch_node)
workflow.add_node("report", report_node)

workflow.set_entry_point("triage")
workflow.add_edge("triage", "retrieve_incidents")
workflow.add_edge("retrieve_incidents", "predict_rca")
workflow.add_edge("predict_rca", "dispatch")
workflow.add_edge("dispatch", "report")
workflow.add_edge("report", END)

agent_app = workflow.compile()
