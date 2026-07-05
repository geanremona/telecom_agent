import json
import os
from pathlib import Path
from typing import Dict, Any

KB_FILE = Path(__file__).parent / "knowledge_base.json"

# Default baseline sensitivities
DEFAULT_KB = {
    "sensitivities": {
        "rectifier_failure": 0.5,
        "antenna_misalignment": 0.5,
        "fiber_cut": 0.5,
        "zero_day_anomaly": 0.8
    },
    "history": []
}

def load_kb() -> Dict[str, Any]:
    if not KB_FILE.exists():
        save_kb(DEFAULT_KB)
        return DEFAULT_KB
    try:
        with open(KB_FILE, "r") as f:
            return json.load(f)
    except Exception:
        return DEFAULT_KB

def save_kb(kb: Dict[str, Any]):
    with open(KB_FILE, "w") as f:
        json.dump(kb, f, indent=4)

def update_sensitivity(cause_key: str, action: str):
    """
    Adjusts sensitivity based on RLHF feedback.
    action: "approve" (reward) or "dismiss" (penalty)
    """
    kb = load_kb()
    current_val = kb["sensitivities"].get(cause_key, 0.5)
    
    # RLHF logic:
    # If approved, we lower the threshold (make it more sensitive / confident)
    # If dismissed (false positive), we raise the threshold (make it less sensitive)
    if action == "approve":
        new_val = max(0.1, current_val - 0.1)
    elif action == "dismiss":
        new_val = min(0.9, current_val + 0.15)
    else:
        new_val = current_val

    kb["sensitivities"][cause_key] = new_val
    save_kb(kb)
    return new_val

def get_sensitivity(cause_key: str) -> float:
    kb = load_kb()
    return kb["sensitivities"].get(cause_key, 0.5)

def log_feedback(incident_id: str, cause_key: str, action: str):
    kb = load_kb()
    kb["history"].append({
        "incident_id": incident_id,
        "cause_key": cause_key,
        "action": action,
        "timestamp": "2026-07-05T12:00:00Z" # Mocked for demo
    })
    save_kb(kb)
