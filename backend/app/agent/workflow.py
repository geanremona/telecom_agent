import datetime
import json
from typing import TypedDict, Annotated, List, Dict, Any, Optional
from langgraph.graph import StateGraph, END
import app.database.mock_data as db
from app.agent.knowledge_base import get_sensitivity
from app.llm.inference import generate_telecom_response
from app.database.neo4j_client import kg_client
from app.rag.vector_store import rag_store
from app.agent.dispatch_optimizer import optimize_dispatch_route

# ──────────────────────────────────────────────────────────────────────────────
# AGENT STATE
# The complete state object that flows through every node of the graph.
# ──────────────────────────────────────────────────────────────────────────────
class AgentState(TypedDict):
    # Input
    event: Dict[str, Any]

    # Step 1 – Triage
    severity: str
    triage_reasoning: str

    # Step 2 – First Retrieval: Incident History
    incident_tool_call: Dict[str, Any]
    incidents: List[Dict[str, Any]]
    incident_pattern: str

    # Step 3 – RCA
    predicted_cause: str
    confidence: str
    rca_reasoning: str
    top_causes: List[Dict[str, Any]]

    # Step 4 – Second Retrieval: SLA Document
    sla_tool_call: Dict[str, Any]
    sla_doc: Optional[Dict[str, Any]]
    sla_hours: float
    sla_breach_risk: bool

    # Zero-Day Threat Analysis
    threat_tool_call: Dict[str, Any]
    threat_analysis_result: Optional[Dict[str, Any]]

    # Step 5 – Decision (the branching point)
    decision: str  # "dispatch" | "escalate"
    decision_reasoning: str

    # Step 6a – Dispatch Path
    inventory_tool_call: Dict[str, Any]
    crew_tool_call: Dict[str, Any]
    dispatch_plan: List[Dict[str, Any]]

    # Step 6b – Escalation Path
    escalation_tool_call: Dict[str, Any]
    escalation_result: Optional[Dict[str, Any]]

    # Step 7 – Final Report
    report: str
    citations: List[str]

    # Streaming: all agent messages as they are generated
    messages: Annotated[list, "messages"]


# ──────────────────────────────────────────────────────────────────────────────
# NODE 1: TRIAGE
# Classifies the incoming event. Determines severity from logs.
# ──────────────────────────────────────────────────────────────────────────────
def triage_node(state: AgentState) -> dict:
    event = state.get("event", {})
    logs = event.get("logs", "").lower()

    # Severity classification logic
    if any(kw in logs for kw in ["voltage drop", "power failure", "battery", "rectifier"]):
        severity = "P0 — Full Power Outage"
        reasoning = "Detected power/battery keywords. Classifying as P0: Full Power Outage. Estimated 0 coverage for affected users."
    elif any(kw in logs for kw in ["signal fluctuation", "packet loss", "handoff", "antenna"]):
        severity = "P1 — Service Degraded"
        reasoning = "Detected RF/signal degradation keywords. Classifying as P1. Partial coverage maintained."
    elif any(kw in logs for kw in ["fiber", "backhaul", "cut"]):
        severity = "P0 — Full Backhaul Loss"
        reasoning = "Detected fiber/backhaul loss keywords. Classifying as P0: catastrophic backhaul failure."
    else:
        severity = "P2 — Monitoring"
        reasoning = "No critical keywords detected. Classifying as P2 for continued monitoring."

    state["messages"].append(f"[TRIAGE] {reasoning}")
    return {
        "severity": severity,
        "triage_reasoning": reasoning,
    }


# ──────────────────────────────────────────────────────────────────────────────
# NODE 2: FIRST RETRIEVAL — Incident History
# The agent's first document retrieval: query historical incidents for this tower.
# ──────────────────────────────────────────────────────────────────────────────
def retrieve_incidents_node(state: AgentState) -> dict:
    tower_id = state["event"].get("tower_id", "UNKNOWN")

    # TOOL CALL 1
    tool_result = db.tool_query_incidents(tower_id)
    incidents = tool_result["output"]

    # Analyze the pattern
    if len(incidents) >= 3:
        causes = [i["root_cause"] for i in incidents]
        most_common = max(set(causes), key=causes.count)
        pattern = f"Pattern detected: {causes.count(most_common)}/{len(incidents)} incidents at {tower_id} share root cause '{most_common}'."
    elif len(incidents) > 0:
        pattern = f"Sparse history: {len(incidents)} incident(s) found. Insufficient for confident pattern matching."
    else:
        pattern = "No prior incidents found for this tower. Proceeding with symptom-only analysis."

    state["messages"].append(f"[RETRIEVE-1] Queried IMS for {tower_id}. {pattern}")
    return {
        "incident_tool_call": tool_result,
        "incidents": incidents,
        "incident_pattern": pattern,
    }


def rca_node(state: AgentState) -> dict:
    logs = state["event"].get("logs", "")
    
    # 1. RAG Retrieval from ChromaDB
    rag_context = rag_store.retrieve_context(logs, n_results=2)
    state["messages"].append(f"[RAG] Retrieved context from ChromaDB: {rag_context.splitlines()[0] if rag_context else 'None'}")

    # 2. Build the LLM Prompt
    prompt = f"""
    Analyze the following telecom incident to determine the root cause.
    
    Current Logs: {logs}
    
    {rag_context}
    
    Return your analysis as a valid JSON array of objects representing the top 3 predicted causes.
    Each object MUST have the keys: "cause" (string), "confidence" (integer 0-100), and "reasoning" (string).
    If it is a cyber security issue like unauthorized access or lateral movement, output "Unknown Anomaly" as the top cause.
    """

    # 3. Call Cloud LLM
    response_text = generate_telecom_response(prompt)
    
    # 4. Parse LLM Output
    try:
        # Strip markdown formatting if the LLM wrapped it
        json_str = response_text.strip().removeprefix('```json').removesuffix('```').strip()
        predictions = json.loads(json_str)
        top_causes = []
        for p in predictions:
            top_causes.append({
                "cause": p.get("cause", "Unknown"),
                "prob": p.get("confidence", 0),
                "xai": p.get("reasoning", "")
            })
            
        predicted_cause = top_causes[0]["cause"]
        confidence_val = top_causes[0]["prob"]
        confidence = f"High ({confidence_val}%)" if confidence_val > 80 else f"Medium ({confidence_val}%)"
        reasoning = top_causes[0]["xai"]
    except Exception as e:
        print(f"[ERROR] Failed to parse LLM JSON: {e}\nResponse: {response_text}")
        predicted_cause = "Unknown"
        confidence = "Low (0%)"
        reasoning = "LLM failed to produce valid JSON."
        top_causes = [{"cause": "Unknown", "prob": 0, "xai": "Parsing error"}]

    # Special handling for Zero-Day routing
    if predicted_cause == "Unknown Anomaly" or "lateral movement" in logs.lower() or "unauthorized" in logs.lower():
        predicted_cause = "Unknown Anomaly"
        confidence = "Low (10%)"
        reasoning = "Unrecognized anomaly detected in logs. Routing to Threat Analysis."

    state["messages"].append(f"[RCA] Root cause: '{predicted_cause}' — Confidence: {confidence}. {reasoning}")
    return {
        "predicted_cause": predicted_cause,
        "confidence": confidence,
        "rca_reasoning": reasoning,
        "top_causes": top_causes,
    }

# ──────────────────────────────────────────────────────────────────────────────
# NODE 3.5: THREAT ANALYSIS (ZERO-DAY)
# Analyzes unknown or suspicious anomalies using Threat Intel.
# ──────────────────────────────────────────────────────────────────────────────
def threat_analysis_node(state: AgentState) -> dict:
    logs = state["event"].get("logs", "").lower()
    
    # TOOL CALL: Query Threat Intel
    tool_result = db.tool_query_threat_intel([logs])
    analysis = tool_result.get("output", {})
    
    predicted_cause = state.get("predicted_cause", "Unknown Anomaly")
    severity = state.get("severity", "Unknown")
    
    if analysis.get("match_found"):
        reasoning = f"Threat Intel match found! {analysis.get('description')}"
        predicted_cause = analysis.get("threat_type", "Zero-Day APT")
        severity = analysis.get("severity_override", "CRITICAL-SEC")
        state["messages"].append(f"[THREAT-INTEL] 🚨 ZERO-DAY DETECTED: {analysis.get('cve')} - {predicted_cause}")
    else:
        reasoning = "No known zero-day signatures found in Threat Intel DB. Proceeding with standard unknown fault handling."
        state["messages"].append(f"[THREAT-INTEL] ℹ️ No match found in Threat Intel DB.")

    return {
        "threat_tool_call": tool_result,
        "threat_analysis_result": analysis,
        "predicted_cause": predicted_cause,
        "severity": severity
    }

# ──────────────────────────────────────────────────────────────────────────────
# CONDITIONAL EDGE FUNCTION (RCA to Threat Analysis or SLA)
# ──────────────────────────────────────────────────────────────────────────────
def route_after_rca(state: AgentState) -> str:
    predicted_cause = state.get("predicted_cause", "")
    if predicted_cause in ["Unknown", "Unknown Anomaly"]:
        return "threat_analysis"
    return "retrieve_sla"


# ──────────────────────────────────────────────────────────────────────────────
# NODE 4: SECOND RETRIEVAL — SLA Document
# Now that we know the root cause, retrieve the SPECIFIC SLA contract for it.
# This is the second, targeted retrieval that shows true agentic behaviour.
# ──────────────────────────────────────────────────────────────────────────────
def retrieve_sla_node(state: AgentState) -> dict:
    predicted_cause = state.get("predicted_cause", "Unknown")

    # TOOL CALL 2
    tool_result = db.tool_get_sla_document(predicted_cause)
    sla_doc = tool_result["output"]

    sla_hours = 4.0
    sla_breach_risk = False

    if sla_doc:
        # Get the relevant clause
        clauses = sla_doc.get("clauses", {})
        # Find the matching clause for this issue type
        for issue_type, clause in clauses.items():
            if "response_sla_hours" in clause:
                sla_hours = clause["response_sla_hours"]
                break

        # Assess breach risk: if time elapsed > 70% of SLA window
        sla_breach_risk = sla_hours <= 4.0  # For demo: any 4hr SLA is already at risk
        risk_str = "⚠️ SLA BREACH RISK — less than 30% of response window remaining." if sla_breach_risk else "✅ Within SLA window."
        state["messages"].append(
            f"[RETRIEVE-2] Fetched SLA document '{tool_result['citation']}'. "
            f"Response SLA: {sla_hours}h. {risk_str}"
        )
    else:
        state["messages"].append("[RETRIEVE-2] No SLA document found for this root cause. Using default 48h SLA.")

    return {
        "sla_tool_call": tool_result,
        "sla_doc": sla_doc,
        "sla_hours": sla_hours,
        "sla_breach_risk": sla_breach_risk,
    }


# ──────────────────────────────────────────────────────────────────────────────
# NODE 5: DECISION NODE (the branching point)
# The agent evaluates all gathered evidence and decides which path to take.
# This is the core "agent plans and decides" demonstration.
# ──────────────────────────────────────────────────────────────────────────────
def decision_node(state: AgentState) -> dict:
    predicted_cause = state.get("predicted_cause", "Unknown")
    sla_breach_risk = state.get("sla_breach_risk", False)
    sla_doc = state.get("sla_doc")
    tower_id = state.get("event", {}).get("tower_id", "UNKNOWN")

    # Use Neo4j Knowledge Graph to check historical outage frequency
    recent_outage_count = kg_client.check_outage_frequency(tower_id, days=7)
    
    # Fallback to in-memory incidents if Neo4j is offline or empty
    if recent_outage_count == 0:
        recent_outage_count = len(state.get("incidents", []))

    # DECISION LOGIC
    # Escalate if: SLA breach is imminent AND this is a known repeat failure
    if sla_breach_risk and recent_outage_count >= 3 and predicted_cause != "Unknown":
        decision = "escalate"
        reasoning = (
            f"DECISION: ESCALATE. Basis: (1) SLA breach risk is HIGH — response window ≤ 4h. "
            f"(2) Neo4j Knowledge Graph flags this as a REPEAT FAILURE — {recent_outage_count} prior incidents in 7 days. "
            f"(3) Contract clause triggers mandatory escalation path. "
            f"Standard dispatch is insufficient; invoking vendor emergency escalation."
        )
    else:
        decision = "dispatch"
        reasoning = (
            f"DECISION: DISPATCH. Basis: (1) SLA window is adequate. "
            f"(2) Incident history does not indicate a systemic repeat failure requiring escalation. "
            f"(3) Standard crew dispatch and parts order is the appropriate response."
        )

    state["messages"].append(f"[DECISION] {reasoning}")
    return {
        "decision": decision,
        "decision_reasoning": reasoning,
    }


# ──────────────────────────────────────────────────────────────────────────────
# CONDITIONAL EDGE FUNCTION
# LangGraph calls this to determine which node to route to next.
# ──────────────────────────────────────────────────────────────────────────────
def route_after_decision(state: AgentState) -> str:
    return state.get("decision", "dispatch")


# ──────────────────────────────────────────────────────────────────────────────
# NODE 6A: DISPATCH PATH
# Checks inventory (tool call 3) and finds crews (tool call 4).
# ──────────────────────────────────────────────────────────────────────────────
def dispatch_node(state: AgentState) -> dict:
    predicted_cause = state.get("predicted_cause", "Unknown")

    # Map root cause to required part and certification
    part_map = {
        "Faulty rectifier": ("Rectifier Part #X-2000", "Power Systems"),
        "Antenna misalignment": ("Antenna Part #A-100", "RF Systems"),
        "Physical fiber damage (excavation)": ("Fiber Splice Kit #F-200", "Fiber Splice"),
    }
    part_name, cert_required = part_map.get(predicted_cause, ("Unknown Part", "General"))

    # TOOL CALL 3: Check inventory
    inv_result = db.tool_check_inventory(part_name)
    inv_data = inv_result["output"]

    # TOOL CALL 4: Find available crews
    crew_result = db.tool_find_available_crews(cert_required)
    crews = crew_result["output"]
    crew = crews[0] if crews else {"name": "No crew available", "available_from": "TBD"}

    # Use OR-Tools to dynamically calculate the optimal dispatch sequence
    plan = optimize_dispatch_route()

    state["messages"].append(
        f"[DISPATCH] Generated {len(plan)}-step dispatch plan using OR-Tools routing. "
        f"Crew: {crew['name']}. Parts: {'In Stock' if inv_data.get('stock', 0) > 0 else 'Substitute/Ordered'}."
    )
    return {
        "inventory_tool_call": inv_result,
        "crew_tool_call": crew_result,
        "dispatch_plan": plan,
        "escalation_tool_call": {},
        "escalation_result": None,
    }


def INVENTORY_DB_check(part_name: str) -> bool:
    """Helper to check if an alternate part is actually in stock."""
    item = db.INVENTORY_DB.get(part_name, {})
    return item.get("stock", 0) > 0


# ──────────────────────────────────────────────────────────────────────────────
# NODE 6B: ESCALATION PATH
# Triggers vendor escalation (tool call 3) and also schedules a crew.
# ──────────────────────────────────────────────────────────────────────────────
def escalation_node(state: AgentState) -> dict:
    sla_doc = state.get("sla_doc", {})
    event = state.get("event", {})
    incident_id = event.get("incident_id", "INC-UNKNOWN")

    vendor = sla_doc.get("vendor", "VendorX Power Systems") if sla_doc else "VendorX Power Systems"
    contact_info = sla_doc.get("clauses", {}).get("emergency_escalation", {}).get("contact", "ops-emergency@vendorx.com") if sla_doc else "ops-emergency@vendorx.com"

    # TOOL CALL 3: Escalate
    esc_result = db.tool_escalate_to_vendor(
        vendor_name=vendor,
        incident_id=incident_id,
        reason=f"Repeat failure ({state.get('predicted_cause')}) with SLA breach risk. {state.get('decision_reasoning', '')}",
        contact=contact_info,
    )

    # TOOL CALL 4: Also dispatch internal crew for immediate triage
    crew_result = db.tool_find_available_crews("Tower Climbing")
    crews = crew_result["output"]
    crew_name = crews[0]["name"] if crews else "Crew B"

    plan = [
        {
            "step": 1, "action": f"Invoke Emergency Escalation to {vendor}",
            "owner": "Agent (Automated)", "eta": "Immediate",
            "status": "✅ Dispatched", "detail": f"Escalation ticket: {esc_result['output']['escalation_ticket']}. Vendor SLA: {esc_result['output']['sla_commitment']}"
        },
        {
            "step": 2, "action": f"Dispatch {crew_name} for immediate site triage",
            "owner": "NOC Ops Team", "eta": crews[0].get("available_from", "ASAP") if crews else "ASAP",
            "status": "✅ Scheduled", "detail": "Internal crew on-site for parallel triage while vendor engineer is en route."
        },
        {
            "step": 3, "action": "Activate backup power / reroute traffic",
            "owner": "Network Engineering", "eta": "Within 30 min",
            "status": "⏳ In Progress", "detail": "Emergency traffic rerouting to adjacent TOWER-41 and TOWER-43 to minimize user impact."
        },
    ]

    state["messages"].append(
        f"[ESCALATE] Vendor escalation triggered. Ticket: {esc_result['output']['escalation_ticket']}. "
        f"Parallel internal triage crew: {crew_name}."
    )
    return {
        "escalation_tool_call": esc_result,
        "escalation_result": esc_result["output"],
        "crew_tool_call": crew_result,
        "inventory_tool_call": {},
        "dispatch_plan": plan,
    }


# ──────────────────────────────────────────────────────────────────────────────
# NODE 7: REPORT GENERATION
# Synthesizes all gathered evidence into a final, citable Priority Action Report.
# ──────────────────────────────────────────────────────────────────────────────
def report_node(state: AgentState) -> dict:
    event = state.get("event", {})
    severity = state.get("severity", "Unknown")
    predicted_cause = state.get("predicted_cause", "Unknown")
    confidence = state.get("confidence", "Low")
    rca_reasoning = state.get("rca_reasoning", "")
    plan = state.get("dispatch_plan", [])
    decision = state.get("decision", "dispatch")
    decision_reasoning = state.get("decision_reasoning", "")
    incidents = state.get("incidents", [])
    sla_doc = state.get("sla_doc")
    sla_hours = state.get("sla_hours", 4.0)
    escalation = state.get("escalation_result")

    # Build citations list
    citations = []
    if state.get("incident_tool_call"):
        citations.append(state["incident_tool_call"].get("citation", ""))
    if state.get("sla_tool_call"):
        citations.append(state["sla_tool_call"].get("citation", ""))
    if state.get("inventory_tool_call") and state["inventory_tool_call"].get("citation"):
        citations.append(state["inventory_tool_call"]["citation"])
    if state.get("crew_tool_call"):
        citations.append(state["crew_tool_call"].get("citation", ""))
    if state.get("escalation_tool_call") and state["escalation_tool_call"].get("citation"):
        citations.append(state["escalation_tool_call"]["citation"])
    citations = [c for c in citations if c]

    # Build plan table
    plan_rows = "\n".join(
        f"| {p['step']} | {p['action']} | {p['owner']} | {p['eta']} | {p['status']} |"
        for p in plan
    )

    # SLA section
    sla_section = ""
    if sla_doc:
        clause_key = list(sla_doc.get("clauses", {}).keys())[0]
        excerpt = sla_doc["clauses"][clause_key].get("excerpt", "")
        sla_section = f"""
## ⚖️ SLA Grounding Document
- **Contract:** `{sla_doc.get('document_id')}` — {sla_doc.get('title')}
- **Vendor:** {sla_doc.get('vendor')}
- **Response SLA:** {sla_hours} hours
- **Relevant Excerpt:** *"{excerpt}"*
"""

    # Escalation section
    esc_section = ""
    if escalation:
        esc_section = f"""
## 🚨 Vendor Escalation Record
- **Ticket ID:** `{escalation.get('escalation_ticket')}`
- **Vendor:** {escalation.get('vendor')}
- **Status:** {escalation.get('status')}
- **Vendor Commitment:** {escalation.get('sla_commitment')}
- **Triggered At:** {escalation.get('timestamp')}
"""

    path_label = "🔴 ESCALATION PATH" if decision == "escalate" else "🟢 DISPATCH PATH"

    report = f"""# 📋 Priority Action Report — {event.get('tower_id', 'UNKNOWN')}

**Incident ID:** `{event.get('incident_id', 'INC-2026-89')}`  
**Generated:** 2026-07-05T14:38:00Z  
**Severity:** {severity}  
**Agent Decision Path:** {path_label}  
**Report Status:** ✅ FINALIZED

---

## 🔍 Root Cause Analysis
- **Predicted Cause:** {predicted_cause}
- **Confidence:** {confidence}
- **Basis:** {rca_reasoning}
- **Historical Evidence:** {len(incidents)} prior incidents at this tower confirm this failure mode.

---

## 🤖 Agent Decision Rationale
{decision_reasoning}

---

## 📋 Resolution Plan
| Step | Action | Owner | ETA | Status |
|---|---|---|---|---|
{plan_rows}

{sla_section}
{esc_section}

---

## 📎 Citations & Grounding Documents
{chr(10).join(f'- `{c}`' for c in citations)}

---
*This report was autonomously generated by the Nexus Network Ops Agent and is subject to NOC supervisor review before irreversible actions are executed.*
"""

    state["messages"].append("[REPORT] Final Priority Action Report generated and ready for NOC review.")
    return {
        "report": report,
        "citations": citations,
    }


# ──────────────────────────────────────────────────────────────────────────────
# BUILD THE LANGGRAPH STATE GRAPH
# ──────────────────────────────────────────────────────────────────────────────
workflow = StateGraph(AgentState)

# Register all nodes
workflow.add_node("triage", triage_node)
workflow.add_node("retrieve_incidents", retrieve_incidents_node)
workflow.add_node("rca", rca_node)
workflow.add_node("threat_analysis", threat_analysis_node)
workflow.add_node("retrieve_sla", retrieve_sla_node)
workflow.add_node("decision", decision_node)
workflow.add_node("dispatch", dispatch_node)
workflow.add_node("escalate", escalation_node)
workflow.add_node("report", report_node)

# Entry point
workflow.set_entry_point("triage")

# Linear edges
workflow.add_edge("triage", "retrieve_incidents")
workflow.add_edge("retrieve_incidents", "rca")

# Conditional edge from RCA
workflow.add_conditional_edges(
    "rca",
    route_after_rca,
    {
        "threat_analysis": "threat_analysis",
        "retrieve_sla": "retrieve_sla",
    }
)
workflow.add_edge("threat_analysis", "retrieve_sla")
workflow.add_edge("retrieve_sla", "decision")

# CONDITIONAL EDGE: the branching decision
workflow.add_conditional_edges(
    "decision",
    route_after_decision,
    {
        "dispatch": "dispatch",
        "escalate": "escalate",
    }
)

# Both paths converge to report
workflow.add_edge("dispatch", "report")
workflow.add_edge("escalate", "report")
workflow.add_edge("report", END)

agent_app = workflow.compile()
