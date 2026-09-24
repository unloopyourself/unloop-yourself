# Testing strategy — agent autonomy first

Unloop prioritizes **deterministic, local tests** the coding agent can run without a human and without SaaS. Physical device acceptance stays a **batch** gate, not a per-commit babysitting loop.

## Layers

| Layer | What | Who runs | When |
|-------|------|----------|------|
| **L0 — Unit / scenario** | Vitest in `@unloop/core`: FSM, policy, shake math, **`SessionEngine` interrupt loop** | Agent always | Every change touching Core / interrupt flow |
| **L1 — Boundaries** | `scripts/check-boundaries.sh` | Agent | Deps / privacy / Core isolation |
| **L2 — Mobile typecheck** | `apps/mobile` `tsc` | Agent | UI / settings / challenges |
| **L3 — Emulator smoke** (optional) | Install APK, grant perms via `adb`, launch | Agent if AVD exists | Before asking human for device |
| **L4 — Physical device** | SM-A405FN (or other) real UsageStats + overlay + sensors | Human | Milestone / batch of features |

## SessionEngine (L0 “almost E2E”)

`SessionEngine` is the interrupt loop without React Native:

* start → threshold → challenge → complete **or** soft-fail (timeout/skip) → cooldown → re-arm  
* hydrate after Activity death (native outstanding / cooldown)  
* injectable **clock** so timeouts are instant in tests  

Regression scenarios live in `packages/core/src/sessionEngine.test.ts` and are named `REGRESSION …` when they lock a past bug.

### Commands

```bash
npm test                 # Core including SessionEngine scenarios
./scripts/check-boundaries.sh
cd apps/mobile && npx tsc --noEmit
```

## Growing the regression basket

When a bug is found (device or review):

1. Reproduce as a **failing** `SessionEngine` (or pure helper) test titled `REGRESSION <short name>`.
2. Fix until green.
3. Never delete the test — only refine if the product rule changes (then update STATUS / ADR).

UI-only bugs (layout) may need L3/L4; domain/timing/FSM bugs must land in L0.

## Emulator vs device

* **Emulator** helps the agent install/launch and poke permissions; UsageStats, overlay-over-YouTube, and realistic shake/face-down remain weak.  
* **No AVD yet** in this environment — creating one downloads a large system image (ask human before first create).  
* Until an AVD exists, agent autonomy = **L0+L1+L2**. Human runs L4 when STATUS asks for a batch smoke.

## Out of scope for autonomy

* Maestro/Detox E2E (not installed) — optional later, still local.  
* Cloud device farms / paid CI agents.
