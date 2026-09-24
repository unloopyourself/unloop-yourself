# Unloop — Architecture Specification

> *"Isolate the problem domain from platform details so the architecture stays portable, extensible, and resilient."*

---

## 1. Guiding principles

* **Domain-driven and technology-agnostic:** The architecture expresses digital-wellbeing concepts. Frameworks, libraries, and OS APIs stay at the edges.
* **Fully isolated Core:** The Core module holds pure business logic and must not depend on UI frameworks (React / React Native) or OS-specific APIs.
* **Ports and adapters:** The Core talks to the outside world only through abstract ports. Changing platform or OS APIs means changing adapters only.
* **Decoupling via events:** Actors need not know all passive modules. A minimal typed event emitter supports 1→N fan-out.

---

## 2. Domain modules and responsibilities

```text
                     ┌─────────────────────────────────────────┐
                     │              POLICY ENGINE              │
                     │  (Decide WHEN and HOW to intervene)     │
                     └────────────────────┬────────────────────┘
                                          │
                                          ▼
┌──────────────────────┐     ┌─────────────────────────┐     ┌──────────────────────┐
│     SESSION FSM      │ ──► │    CHALLENGE ENGINE     │ ──► │  PERSISTENCE STATE   │
│ (Session lifecycle)  │     │ (Select suitable challenge)│  │  (Local state & ΔU)  │
└──────────────────────┘     └─────────────────────────┘     └──────────────────────┘
                                          │
                                          ▼
                             ┌─────────────────────────┐
                             │   TYPED EVENT EMITTER   │
                             │ (Audit trail & logging) │
                             └─────────────────────────┘
```

### A. Session FSM

Models monitoring and interruption lifecycle with explicit, coherent state.

* **Core states:** `PAUSED` (inactive), `MONITORING` (listening for thresholds), `CHALLENGE` (challenge on screen), `COOLDOWN` (grace period).
* **Events:** Treat threshold exceeded (`ThresholdReached`) as transition *events*, not states, to avoid race conditions.

### B. Policy Engine

Decision brain of the system. Reads context and sets intervention rules.

* Decide whether a threshold event requires an immediate interrupt.
* Choose intensity and challenge category.
* Compute cooldown duration and conditions.
* Later: evaluate escalation to Buddy network or AI Companion (not MVP).

### C. Challenge Engine

Selects and prepares the challenge to show.

* **Compatibility rule:**

$$\text{challenge.requires} \subseteq \text{deviceContext.availableCapabilities}$$

* **Scoring / context:** Prefer challenges by user prefs, time of day, and recent history to reduce repetition.

### D. Persistence and monitoring state

On-device memory for continuity.

* Survive restarts: persist session state and usage baselines.
* Compute $\Delta U = U_{\text{now}} - U_1$ in a platform-agnostic way.

### E. Typed event emitter

Lightweight internal messaging with no heavy third-party bus.

* Passive subscribers (local audit trail, Autopilot Score later, Buddy sync later) listen without Core or Challenges knowing them.

---

## 3. System boundaries: ports and adapters

| Abstract port (Core) | Android adapter | iOS adapter | Future (web/desktop) |
| --- | --- | --- | --- |
| **`UsageDetectorPort`** | `AndroidUsageStatsAdapter` | `IOSDeviceActivityAdapter` | `WebExtensionUsageAdapter` |
| **`SensorPort`** | `AndroidSensorsAdapter` | `IOSCoreMotionAdapter` | `WebSensorsAdapter` |
| **`NotificationPort`** | `AndroidPushAdapter` | `IOSAPNSAdapter` | `WebNotificationAdapter` |
| **`StoragePort`** | `SQLiteAdapter` / `KVStorageAdapter` | same | `IndexedDBAdapter` |

---

## 4. Main logical flow

1. **Start:** User enables monitoring → FSM `PAUSED` → `MONITORING`.
2. **Detect:** Platform adapter hits threshold → event via `UsageDetectorPort`.
3. **Evaluate:** Policy Engine confirms interrupt; Challenge Engine picks a challenge for current `DeviceContext`.
4. **Interrupt:** FSM → `CHALLENGE`; UI shows the challenge.
5. **Resolve:** On success emit `CHALLENGE_COMPLETED`, or on **soft timeout** emit `CHALLENGE_FAILED`; both enter `COOLDOWN`, clear the shield, and return the feeds. Unloop is an interrupt, not a lock — see soft unlock below.

### Soft unlock (not a ban)

The challenge must **not** hard-block apps until success. That would make Unloop a prohibition tool and fights the manifesto (“restore awareness, do not punish”).

* While `CHALLENGE` is active, the shield may cover the feed — that is the interrupt.
* After a **generous timeout** (order of tens of seconds, tunable in settings later), dismiss the shield, enter cooldown, and show a short **wake-up** line — not a scold.
* Tone target (EN source; localize): something in the spirit of *“No worries — the challenge slipped by. Glad you looked up for a moment. The world outside the feed is still there.”* Avoid guilt, lectures, or “you failed.”
* Optional later: a quiet **Skip** control with the same outcome as timeout (same event, same copy family).
* FSM already models this: `CHALLENGE` + `CHALLENGE_FAILED` → `COOLDOWN`.

Implementation today still waits for success; soft timeout is the intended product rule for the next challenge/UX pass.

---

## 5. Challenges and capabilities

Challenges declare required **capabilities** (domain concept, not an Expo detail). Each host exposes a **DeviceContext** with *actually available* capabilities (permissions, sensors, Buddy configured, etc.).

Examples:

* `ShakeChallenge` → accelerometer
* `WalkChallenge` → pedometer
* Buddy challenges → Buddy available + notifications + media
* `ReflectionChallenge` → may require none

Incompatible challenges are excluded before their code runs. New hosts (browser, desktop) only need a DeviceContext; new challenges only declare requirements and logic.

When multiple challenges exist, **Settings → Challenges** lets the user enable/disable each one. Selection is always:

$$\text{enabledByUser} \cap \{ c \mid c.\mathrm{requires} \subseteq \mathrm{availableCapabilities} \}$$

Candidate catalog: [`offline_challenges.md`](offline_challenges.md).

See also [capabilities appendix](capabilities.md) and [modular architecture notes](modular_architecture.md).

---

## 6. Localization

All user-visible copy (app UI, interrupt overlay, challenge prompts, notifications, settings) must be **localizable**. Source of truth: English string catalogs; locale packs (e.g. `it`) for translation. Challenge *content* (math templates, synonym lists, air-write words) is authored per locale when idioms do not translate 1:1. Default locale follows the OS; optional in-app override can come later.

This was implicit for MVP English-only shipping; it is now an explicit product requirement before any multi-challenge or store-facing pass.
