# Unloop — Implementation Roadmap

> *"Build a little at a time, validate in the field, never stop protecting the vision."*

---

## Overview

Incremental delivery. Each phase adds concrete value and validates assumptions before the next, keeping the architecture reversible and modular.

Factory execution detail lives in [`factory/BACKLOG.md`](../factory/BACKLOG.md).

---

## Phase 0: Foundation and Core architecture

**Goal:** Abstract domain foundations before native APIs.

* Core domain contracts: `Challenge`, `Capability`, `DeviceContext`
* Minimal Session FSM (`PAUSED`, `MONITORING`, `CHALLENGE`, `COOLDOWN`)
* Typed event emitter
* Ports: `UsageDetectorPort`, `StoragePort`, `SensorPort`, `NotificationPort`

---

## Phase 1: MVP (Android-first, local engine)

**Goal:** Validate 5–10 second interruptions in the field without Apple license bureaucracy.

* Android adapter (`UsageStats` / foreground service path)
* Persistence and ΔU engine
* First physical challenge (`ShakeChallenge`)
* Screen shield / interrupt UI (non-punitive)
* Local audit trail via event emitter
* **Human acceptance on a physical Android device**

---

## Phase 2: iOS and platform parity

* `IOSDeviceActivityAdapter` (FamilyControls, DeviceActivity, ManagedSettings)
* Native iOS extensions and shield configuration
* Cross-platform FSM / cumulative time validation

---

## Phase 3: Social accountability (Buddy Network)

* Stateless Cloudflare Workers relay (zero fixed cost target; deploy only with human approval)
* Local P2P pairing (keys / QR)
* Buddy challenge integration
* Network listeners on domain events (encrypted payloads only)

---

## Phase 4: AI Companion (local / privacy-preserving)

* Reflection challenges and prompts
* Tone profiles (Wise, Ironic, Pragmatic)
* Policy scoring using fatigue / time-of-day patterns

---

## Phase 5: Multi-screen and community

* Web extension adapter
* Open Challenge API for community packs
* Educator / speaker kits (slides, one-page PDF)

---

## MVP perimeter (reminder)

Detect time threshold on a short-video app → interrupt → local 5–10s challenge (e.g. shake) → unlock on completion.
