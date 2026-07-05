# Edge Computing Architecture: Nexus Agent on Raspberry Pi

This document outlines the technical specification and deployment strategy for running a lightweight, offline-capable version of the Nexus Network Ops Agent directly at the telecommunications tower site (Edge Computing).

## Objective
To provide zero-latency root cause prediction and automated failover capabilities even when the tower loses connection to the central NOC (e.g., during a complete fiber cut).

## Hardware Setup
- **Hardware:** Raspberry Pi 5 (8GB RAM) or equivalent hardened edge gateway.
- **Power:** Connected directly to the tower's un-interruptible power supply (UPS) / rectifier DC bus.
- **Connectivity:** Local ethernet connection to the Tower Switch (OAM VLAN) + out-of-band IoT SIM (LTE-M) for emergency telemetry.

## Software Architecture

### 1. The Local AI Agent (Inference Engine)
Instead of relying on the central Groq-powered TSLAM-4B cloud LLM (which requires backhaul internet), the edge node runs a heavily quantized, task-specific Small Language Model (SLM) such as Llama-3-8B-Q4 or a trained Random Forest classifier.
- **Tech Stack:** Python, ONNX Runtime, FastAPI, Local ChromaDB.
- **Responsibility:** Ingest local syslog streams from the rectifier and switch. Perform local RAG against downloaded historical logs, parse the symptoms, and output the top 3 predicted causes locally.

### 2. Edge-to-Cloud Sync (MQTT)
The central NOC (this dashboard) needs to know what the Edge Agent is doing.
- **Protocol:** MQTT (Message Queuing Telemetry Transport) over TLS.
- **Behavior:** 
  - Under normal conditions, the Edge Agent publishes a health heartbeat every 5 seconds.
  - If an anomaly is detected, it publishes an `edge/alert/{tower_id}` payload.
  - If the backhaul fiber is cut, the MQTT client queues the messages locally.
  - Once connection is restored, the Edge Agent replays the queued messages to the central NOC.

### 3. Automated Local Remediation
The primary benefit of the Edge Agent is taking action without the NOC.
- **Scenario:** The Edge Agent detects a primary grid failure and a rectifier fault, but the central NOC is unreachable.
- **Action:** The Edge Agent issues a local CLI command to the power controller to load-shed non-critical sectors (e.g., shutting down 5G mmWave antennas to preserve battery life for the core 4G macro cells).

## Deployment Flow
1. **Model Distillation:** The central TSLAM-4B agent distills its knowledge base and RAG embeddings into a lightweight offline rule-set/model.
2. **OTA Update:** The NOC pushes this updated `.onnx` model and ChromaDB snapshot to all Raspberry Pi nodes over-the-air.
3. **Execution:** The Pi runs as a `systemd` service, completely isolated from network latency.

> [!TIP]
> **Hackathon Judging Note:** Emphasize that while the main dashboard handles complex, multi-agent orchestration and vendor escalation, the Edge Agent guarantees that basic triage and battery preservation *always* happen, even in complete isolation.
