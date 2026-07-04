from typing import List, Dict, Any

INCIDENTS_DB = [
    {"incident_id": "INC-001", "tower_id": "TOWER-42", "symptoms": ["power failure", "battery drain"], "root_cause": "Faulty rectifier", "date": "2026-06-15"},
    {"incident_id": "INC-002", "tower_id": "TOWER-42", "symptoms": ["power failure"], "root_cause": "Faulty rectifier", "date": "2026-05-20"},
    {"incident_id": "INC-003", "tower_id": "TOWER-42", "symptoms": ["low voltage", "battery drain"], "root_cause": "Faulty rectifier", "date": "2026-04-10"},
    {"incident_id": "INC-004", "tower_id": "TOWER-18", "symptoms": ["signal drop"], "root_cause": "Antenna misalignment", "date": "2026-06-01"},
]

SLA_DB = {
    "VendorX": {"rectifier_replacement": 4.0, "general_maintenance": 24.0},
    "VendorY": {"antenna_repair": 12.0}
}

INVENTORY_DB = {
    "Rectifier Part #X-2000": {"stock": 0, "status": "Out of Stock", "eta": "2026-07-06"},
    "Antenna Part #A-100": {"stock": 5, "status": "In Stock", "eta": "Immediate"}
}

CREW_DB = {
    "Crew A": {"certifications": ["Electrical", "Tower Climbing"], "available_from": "2026-07-05T15:00:00Z", "location": "Zone 1 (Near TOWER-42)"},
    "Crew B": {"certifications": ["General"], "available_from": "2026-07-05T14:00:00Z", "location": "Zone 2"}
}

def query_incidents(tower_id: str) -> List[Dict[str, Any]]:
    return [inc for inc in INCIDENTS_DB if inc["tower_id"] == tower_id]

def get_sla(vendor: str, issue_type: str) -> float:
    return SLA_DB.get(vendor, {}).get(issue_type, 48.0)

def check_inventory(part_name: str) -> Dict[str, Any]:
    return INVENTORY_DB.get(part_name, {"stock": 0, "status": "Unknown"})

def get_available_crews(certification_required: str) -> List[Dict[str, Any]]:
    available = []
    for name, data in CREW_DB.items():
        if certification_required in data["certifications"]:
            available.append({"name": name, **data})
    return available
