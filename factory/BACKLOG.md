# Factory backlog

Statuses: `ready` | `in_progress` | `blocked` | `done` | `deferred`

Pick the first `ready` item whose dependencies are all `done`. Update this file and [`STATUS.md`](STATUS.md) when starting or finishing work.

---

## Phase 0 — Foundation (no native APIs)

### P0-01 — Translate and normalize product docs (English)
- **Status:** done
- **Deps:** —
- **AC:** All active docs under `docs/` are English; Italian `.txt` appendices superseded; meaning preserved.
- **Tests:** — (docs only)
- **Escalate if:** Product intent would change in translation (ask human).

### P0-02 — Materialize minimal Software Factory
- **Status:** done
- **Deps:** —
- **AC:** `AGENTS.md`, `.cursor/rules/unloop.mdc`, `factory/BACKLOG.md`, `factory/STATUS.md`, `scripts/check-boundaries.sh`, English `README.md`, ADR-007 present. No app scaffold.
- **Tests:** `scripts/check-boundaries.sh` exits 0.
- **Escalate if:** —

### P0-03 — Scaffold monorepo (npm workspaces) with empty Core package
- **Status:** done
- **Deps:** P0-02
- **AC:** Root npm workspace; `packages/core` with TypeScript + Vitest wired; `npm test` runs Core tests (can be a smoke test). No Expo app yet unless required to host the workspace—prefer Core-only until P0 ports exist.
- **Tests:** `npm test` in repo root (or package) passes; `scripts/check-boundaries.sh` passes.
- **Escalate if:** Tooling would require paid services.

### P0-04 — Core domain contracts (Challenge, Capability, DeviceContext)
- **Status:** done
- **Deps:** P0-03
- **AC:** Pure TS types/interfaces in Core matching architecture docs; no RN/Expo imports; unit tests for capability subset selection helper if introduced.
- **Tests:** Core Vitest suite green.
- **Escalate if:** Contract shape would break published ADR Challenge model.

### P0-05 — Session FSM (PAUSED, MONITORING, CHALLENGE, COOLDOWN)
- **Status:** done
- **Deps:** P0-04
- **AC:** Explicit FSM with tests for legal/illegal transitions; threshold treated as event not state.
- **Tests:** Core Vitest suite covers transitions.
- **Escalate if:** Need more than the four MVP states.

### P0-06 — Typed event emitter
- **Status:** done
- **Deps:** P0-03
- **AC:** Minimal typed emitter in Core, no heavy third-party bus; tests for subscribe/emit.
- **Tests:** Core Vitest green.
- **Escalate if:** —

### P0-07 — Ports: UsageDetector, Storage, Sensor, Notification
- **Status:** done
- **Deps:** P0-04
- **AC:** Port interfaces only in Core; fake in-memory adapters for tests.
- **Tests:** Integration-style Vitest with fakes green.
- **Escalate if:** New port categories beyond the four.

### P0-08 — Policy Engine (minimal MVP)
- **Status:** done
- **Deps:** P0-05, P0-07
- **AC:** Given threshold event + context, decides interrupt vs ignore and cooldown basics; tests with fakes.
- **Tests:** Core Vitest green.
- **Escalate if:** Policy needs Buddy/AI escalation (out of MVP).

### P0-09 — Challenge Engine (selection by capabilities)
- **Status:** done
- **Deps:** P0-04, P0-08
- **AC:** Selects challenge where `requires ⊆ availableCapabilities`; excludes incompatible; tests.
- **Tests:** Core Vitest green.
- **Escalate if:** —

### P0-10 — Phase 0 gate
- **Status:** done
- **Deps:** P0-05, P0-06, P0-07, P0-08, P0-09
- **AC:** Core package documents how to run tests; `check-boundaries.sh` passes; STATUS notes Phase 0 complete.
- **Tests:** Full Core suite + boundary script.
- **Escalate if:** —

---

## Phase 1 — Android MVP (local engine)

### P1-01 — Spike: Android UsageStats + overlay via Expo Module
- **Status:** done
- **Deps:** P0-10
- **AC:** Short spike notes in `docs/` or STATUS: feasible path for Usage Access + overlay (or explicit blocker). Prefer Expo Modules. No production polish required.
- **Tests:** Spike demo on emulator or device as available; document result.
- **Escalate if:** Expo path blocked or requires paid infra; unclear permission UX trade-offs that change product promises.

### P1-02 — Scaffold Expo app (`apps/mobile`) wiring Core
- **Status:** ready
- **Deps:** P1-01 (or parallel only if spike already proved path—default after P1-01)
- **AC:** Expo TypeScript app depends on `packages/core`; app builds for Android locally.
- **Tests:** App typecheck/build smoke; boundary script.
- **Escalate if:** —

### P1-03 — StoragePort + ΔU persistence
- **Status:** ready
- **Deps:** P0-07, P1-02
- **AC:** Local persistence reconstructs monitoring baselines after restart; ΔU logic tested in Core with fake storage.
- **Tests:** Core tests + app smoke.
- **Escalate if:** —

### P1-04 — Android UsageDetector adapter
- **Status:** ready
- **Deps:** P1-01, P1-02, P1-03
- **AC:** Adapter implements UsageDetectorPort; threshold events reach Core FSM in debug builds.
- **Tests:** As feasible without device; manual note on device/emulator.
- **Escalate if:** OEM/background limits make MVP infeasible.

### P1-05 — ShakeChallenge + SensorPort adapter
- **Status:** ready
- **Deps:** P0-09, P1-02
- **AC:** ShakeChallenge declares accelerometer capability; completes in ~5–10s; unit tests for challenge contract; sensor adapter on Android.
- **Tests:** Core tests + manual shake on device when available.
- **Escalate if:** —

### P1-06 — Shield / interrupt UI (non-punitive copy)
- **Status:** ready
- **Deps:** P1-04, P1-05
- **AC:** On interrupt, show shield/challenge UI; tone matches manifesto (“you asked for this”); unlock on success.
- **Tests:** Manual on device/emulator.
- **Escalate if:** Copy/tone trade-offs need product call.

### P1-07 — Local audit trail subscriber
- **Status:** ready
- **Deps:** P0-06, P1-06
- **AC:** Domain events append to on-device log only; no network.
- **Tests:** Boundary script; manual confirm no egress.
- **Escalate if:** —

### P1-08 — Phase 1 human acceptance (physical Android)
- **Status:** ready
- **Deps:** P1-04, P1-05, P1-06, P1-07
- **AC:** On a physical Android device: configure target short-video app → exceed threshold → interrupt → complete ShakeChallenge → unlock. Human signs off in STATUS.
- **Tests:** Manual acceptance checklist (E2E framework deferred).
- **Escalate if:** Always—this item is human milestone acceptance.
