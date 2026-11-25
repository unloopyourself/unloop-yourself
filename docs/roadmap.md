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

* **Deferred** while Android Buddy (Phase 3) is the priority — no Apple developer spend planned for now.
* Later: `IOSDeviceActivityAdapter` (FamilyControls, DeviceActivity, ManagedSettings), shield extensions, `PushPort` APNs adapter.

---

## Phase 3: Nudge system & human Buddy

**Living plan:** [`phase3_nudge_buddy.md`](phase3_nudge_buddy.md) (pairing protocol, cascade, slices, domain/deep-link options).

* Abstract `NudgeProvider` / `NudgeBus` / `PushPort` (FCM now; iOS later)
* Cascade: human Buddy → AI stub → embedded challenges
* Progressive live warn window + mailbox TTL + cancel
* Stateless Cloudflare Workers relay (deploy only with human approval)
* Pairing: QR + shareable deep link (`unloop://` first; optional HTTPS via Pages)
* Single app, Buddy opt-in (not a second package)

Parked for later slices: anonymous benefactor nudges, full AI — see [`ideas_parking_lot.md`](ideas_parking_lot.md).

---

## Phase 4: AI Companion (local / privacy-preserving)

* Real `AiCompanionProvider` on the same nudge cascade (Phase 3 ships a no-op stub)
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
