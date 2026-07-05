from typing import List, Dict, Any

# ──────────────────────────────────────────────────────────────────────────────
# INCIDENT HISTORY DATABASE
# The agent retrieves from this on its first pass to detect patterns.
# ──────────────────────────────────────────────────────────────────────────────
INCIDENTS_DB = [
    {
        "incident_id": "INC-2026-001", "tower_id": "TOWER-42",
        "symptoms": ["battery voltage drop", "backup power failure", "rectifier alarm"],
        "root_cause": "Faulty rectifier", "resolution": "Part replacement", "resolution_hours": 3.5,
        "date": "2026-06-15", "technician": "Crew A", "cost": 4200
    },
    {
        "incident_id": "INC-2026-002", "tower_id": "TOWER-42",
        "symptoms": ["power failure", "battery drain", "voltage irregularity"],
        "root_cause": "Faulty rectifier", "resolution": "Part replacement", "resolution_hours": 4.0,
        "date": "2026-05-20", "technician": "Crew A", "cost": 4200
    },
    {
        "incident_id": "INC-2025-089", "tower_id": "TOWER-42",
        "symptoms": ["low voltage", "battery drain", "thermal overload"],
        "root_cause": "Faulty rectifier", "resolution": "Emergency vendor escalation",
        "resolution_hours": 6.2, "date": "2025-11-10", "technician": "Crew B", "cost": 7800
    },
    {
        "incident_id": "INC-2026-041", "tower_id": "TOWER-18",
        "symptoms": ["signal fluctuation", "packet loss", "handoff failure"],
        "root_cause": "Antenna misalignment", "resolution": "Remote re-alignment",
        "resolution_hours": 1.5, "date": "2026-06-01", "technician": "Crew C", "cost": 900
    },
    {
        "incident_id": "INC-2026-055", "tower_id": "TOWER-09",
        "symptoms": ["fiber cut", "backhaul loss", "complete outage"],
        "root_cause": "Physical fiber damage (excavation)", "resolution": "Fiber splice team dispatch",
        "resolution_hours": 8.0, "date": "2026-06-20", "technician": "Crew D", "cost": 12000
    },
]

# ──────────────────────────────────────────────────────────────────────────────
# SLA CONTRACT DOCUMENTS
# These are "documents" the agent grounds its decisions in.
# The agent retrieves the specific relevant doc AFTER it knows the root cause.
# ──────────────────────────────────────────────────────────────────────────────
SLA_DOCUMENTS = {
    "VendorX_PowerSystems": {
        "document_id": "CONTRACT-VX-2024-007",
        "vendor": "VendorX Power Systems",
        "title": "Rectifier & Power Module SLA Agreement",
        "effective_date": "2024-01-01",
        "expiry_date": "2027-12-31",
        "clauses": {
            "rectifier_replacement": {
                "response_sla_hours": 4.0,
                "resolution_sla_hours": 8.0,
                "penalty_per_hour": 2500,
                "excerpt": (
                    "Clause 7.3: VendorX shall dispatch a certified power systems engineer "
                    "within 4 hours of a confirmed rectifier fault ticket. Full restoration "
                    "must be achieved within 8 hours. Breach of resolution SLA incurs a "
                    "penalty of $2,500 per hour of delay, deducted from the annual contract value."
                )
            },
            "emergency_escalation": {
                "contact": "ops-emergency@vendorx.com",
                "hotline": "+1-800-VDX-EMER",
                "excerpt": (
                    "Clause 9.1: In cases where first-response resolution is not achieved "
                    "within the response SLA window, the operator may invoke Emergency Escalation. "
                    "VendorX guarantees senior engineer on-site within 2 hours of escalation trigger."
                )
            }
        }
    },
    "VendorY_Antenna": {
        "document_id": "CONTRACT-VY-2025-003",
        "vendor": "VendorY Antenna Systems",
        "title": "Antenna & RF Systems Maintenance Agreement",
        "effective_date": "2025-03-01",
        "expiry_date": "2028-02-28",
        "clauses": {
            "antenna_repair": {
                "response_sla_hours": 6.0,
                "resolution_sla_hours": 12.0,
                "penalty_per_hour": 1200,
                "excerpt": (
                    "Clause 4.2: Antenna alignment and repair incidents must receive remote "
                    "diagnostic support within 6 hours. Physical site visits will be "
                    "scheduled within the 12-hour resolution window. Penalty: $1,200/hour overrun."
                )
            }
        }
    },
    "InternalOps_Fiber": {
        "document_id": "POLICY-INFRA-2026-001",
        "vendor": "Internal Infrastructure Ops",
        "title": "Fiber & Backhaul Incident Response Policy",
        "effective_date": "2026-01-01",
        "expiry_date": "2026-12-31",
        "clauses": {
            "fiber_splice": {
                "response_sla_hours": 2.0,
                "resolution_sla_hours": 10.0,
                "penalty_per_hour": 0,
                "excerpt": (
                    "Policy Section 3: Fiber damage incidents are classified as Severity 1. "
                    "A specialized fiber splice team must be dispatched within 2 hours of "
                    "diagnosis. Restoration target is 10 hours. This is an internal SLA "
                    "with no financial penalty but triggers executive escalation if breached."
                )
            }
        }
    }
}

# Map from root_cause → which SLA document to retrieve
ROOT_CAUSE_TO_SLA_DOC = {
    "Faulty rectifier": "VendorX_PowerSystems",
    "Antenna misalignment": "VendorY_Antenna",
    "Physical fiber damage (excavation)": "InternalOps_Fiber",
}

# ──────────────────────────────────────────────────────────────────────────────
# INVENTORY DATABASE
# ──────────────────────────────────────────────────────────────────────────────
INVENTORY_DB = {
    "Rectifier Part #X-2000": {
        "stock": 0, "status": "Out of Stock", "eta_days": 1,
        "alternate": "Rectifier Part #X-1900 (Legacy)", "alternate_stock": 2,
        "unit_cost": 4200
    },
    "Rectifier Part #X-1900 (Legacy)": {
        "stock": 2, "status": "In Stock", "eta_days": 0,
        "alternate": None, "unit_cost": 3800
    },
    "Antenna Part #A-100": {
        "stock": 5, "status": "In Stock", "eta_days": 0,
        "alternate": None, "unit_cost": 900
    },
    "Fiber Splice Kit #F-200": {
        "stock": 3, "status": "In Stock", "eta_days": 0,
        "alternate": None, "unit_cost": 1200
    },
}

# ──────────────────────────────────────────────────────────────────────────────
# CREW DATABASE
# ──────────────────────────────────────────────────────────────────────────────
CREW_DB = {
    "Crew A": {
        "certifications": ["Electrical", "Power Systems", "Tower Climbing"],
        "available_from": "2026-07-05T15:00:00Z",
        "location": "Zone 1 (2.3 km from TOWER-42)",
        "current_job": None, "clearance_level": "L3"
    },
    "Crew B": {
        "certifications": ["General", "Tower Climbing"],
        "available_from": "2026-07-05T14:00:00Z",
        "location": "Zone 2 (8.1 km from TOWER-42)",
        "current_job": "INC-2026-088", "clearance_level": "L1"
    },
    "Crew C": {
        "certifications": ["RF Systems", "Antenna", "Tower Climbing"],
        "available_from": "2026-07-05T13:30:00Z",
        "location": "Zone 3 (1.1 km from TOWER-18)",
        "current_job": None, "clearance_level": "L2"
    },
    "Crew D": {
        "certifications": ["Fiber Splice", "Backhaul", "Civil Works"],
        "available_from": "2026-07-05T14:30:00Z",
        "location": "Zone 4 (5.4 km from TOWER-09)",
        "current_job": None, "clearance_level": "L2"
    },
}


# ──────────────────────────────────────────────────────────────────────────────
# TOOL FUNCTIONS (called by agent nodes)
# ──────────────────────────────────────────────────────────────────────────────

def tool_query_incidents(tower_id: str) -> Dict[str, Any]:
    """Tool: Retrieve historical incident records for a specific tower."""
    results = [inc for inc in INCIDENTS_DB if inc["tower_id"] == tower_id]
    return {
        "tool": "query_incidents",
        "input": {"tower_id": tower_id},
        "output": results,
        "citation": f"Source: NOC Incident Management System (IMS) — {len(results)} records found for {tower_id}"
    }


def tool_get_sla_document(root_cause: str) -> Dict[str, Any]:
    """Tool: Retrieve the relevant SLA contract document based on diagnosed root cause."""
    doc_key = ROOT_CAUSE_TO_SLA_DOC.get(root_cause)
    if not doc_key:
        return {
            "tool": "get_sla_document",
            "input": {"root_cause": root_cause},
            "output": None,
            "citation": "No SLA document found for this root cause."
        }
    doc = SLA_DOCUMENTS[doc_key]
    return {
        "tool": "get_sla_document",
        "input": {"root_cause": root_cause},
        "output": doc,
        "citation": f"Source: {doc['document_id']} — {doc['title']} (Valid: {doc['effective_date']} to {doc['expiry_date']})"
    }


def tool_check_inventory(part_name: str) -> Dict[str, Any]:
    """Tool: Query the parts inventory management system."""
    item = INVENTORY_DB.get(part_name, {"stock": 0, "status": "Unknown", "eta_days": -1})
    return {
        "tool": "check_inventory",
        "input": {"part_name": part_name},
        "output": item,
        "citation": f"Source: ERP Inventory System — {part_name} status as of 2026-07-05"
    }


def tool_find_available_crews(certification_required: str, location_zone: str = "") -> Dict[str, Any]:
    """Tool: Query the workforce management system for available certified crews."""
    available = []
    for name, data in CREW_DB.items():
        if certification_required in data["certifications"] and data["current_job"] is None:
            available.append({"name": name, **data})
    return {
        "tool": "find_available_crews",
        "input": {"certification_required": certification_required},
        "output": available,
        "citation": "Source: Workday Workforce Management System — Real-time crew availability"
    }


def tool_escalate_to_vendor(vendor_name: str, incident_id: str, reason: str, contact: str) -> Dict[str, Any]:
    """Tool: Trigger a formal vendor escalation via the ticketing system."""
    ticket_id = f"ESC-{incident_id}-VX"
    return {
        "tool": "escalate_to_vendor",
        "input": {"vendor": vendor_name, "incident": incident_id, "reason": reason},
        "output": {
            "escalation_ticket": ticket_id,
            "vendor": vendor_name,
            "contact": contact,
            "status": "DISPATCHED",
            "sla_commitment": "Senior engineer on-site within 2 hours",
            "timestamp": "2026-07-05T14:38:00Z"
        },
        "citation": f"Source: ServiceNow Escalation Engine — Ticket {ticket_id} created"
    }
