# Unloop — Agent & contributor guide

This file is the project-level operating manual for humans and coding agents.
Cursor-specific always-on guardrails live only in [`.cursor/rules/unloop.mdc`](.cursor/rules/unloop.mdc); do not duplicate them here.

**Contact for this project:** `unloopyourself.dev@gmail.com`

## What Unloop is

A privacy-first, open-source mobile app that briefly interrupts doomscrolling (5–15 seconds) with a challenge incompatible with scrolling—not a punisher, paywall, or tracker.

Product intent: [`docs/manifesto.md`](docs/manifesto.md), [`docs/vision.md`](docs/vision.md).  
Architecture: [`docs/architecture.md`](docs/architecture.md).  
Decisions: [`docs/decisions.md`](docs/decisions.md).  
Roadmap: [`docs/roadmap.md`](docs/roadmap.md).

## Factory layout

| Path | Purpose |
|------|---------|
| [`factory/BACKLOG.md`](factory/BACKLOG.md) | Ordered work items, dependencies, acceptance criteria |
| [`factory/STATUS.md`](factory/STATUS.md) | Active item, last gate result, human decisions pending |
| [`scripts/check-boundaries.sh`](scripts/check-boundaries.sh) | Deterministic privacy / isolation checks |
| [`docs/`](docs/) | Product and architecture documentation (English) |

There is no multi-agent orchestration layer and no project skills swarm. Scaffold application packages only when a backlog item requires them (Core from P0-03; Expo app from Phase 1).

## Resuming a session

1. Read [`factory/STATUS.md`](factory/STATUS.md).
2. Read [`factory/BACKLOG.md`](factory/BACKLOG.md) and pick the next item whose status is `ready` and whose dependencies are `done`.
3. If STATUS lists a human decision pending, stop and wait—do not guess.
4. Work only that item (or a clearly documented spike sub-step). Update STATUS when you start and when you finish or block.

## Development loop

1. Select the next ready backlog item.
2. Implement the smallest change that satisfies its acceptance criteria.
3. Run the item’s declared test command (when code exists) and `scripts/check-boundaries.sh`.
4. On failure: diagnose and iterate while making concrete progress. Use a practical retry budget (default around three cycles) as a **safeguard**, not a hard stop. Escalate when attempts fail without new information or progress, or when the diagnosis points to architecture, environment, scope, or a human decision.
5. Mark the item `done` (or `blocked`) in BACKLOG; refresh STATUS.
6. Scaffold only what the active backlog item requires (no premature Expo app).

## Architecture expectations

- **Core domain** (`packages/core`, when it exists) is pure TypeScript: Session FSM, Policy Engine, Challenge Engine, local persistence/ΔU, typed event emitter. No React Native, Expo, or OS APIs in Core.
- **Ports & adapters:** platform APIs live only in adapters (Android first for MVP).
- **Challenges:** minimal `Challenge` contract with declared capabilities; selection rule `requires ⊆ availableCapabilities`. No plugin marketplace in MVP.
- **Local-first:** usage data and audit logs stay on device. No analytics SDKs, no behavioral telemetry backends. Buddy relay (later) is a stateless encrypted postman only—see ADRs.
- Prefer the simplest ADR-consistent option for routine details; record lasting choices as ADRs in [`docs/decisions.md`](docs/decisions.md).

## Stack assumptions (until an ADR changes them)

- React Native + Expo + TypeScript; Android-first MVP; npm workspaces monorepo (`packages/core`, `apps/mobile`, later `workers/relay`).
- Unit/integration tests for Core with Vitest. Physical Android device acceptance for Phase 1 milestone. E2E framework choice deferred until UI exists.
- Local agent execution only. Free-tier CI later when GitHub CLI auth works—optional, not required for progress.

## Quality gates

| Gate | When |
|------|------|
| Backlog acceptance criteria | Before marking an item `done` |
| Declared tests for the item | Before marking an item `done` (once code exists) |
| `scripts/check-boundaries.sh` | Before marking an item `done` when touching deps, networking, or Core/app boundaries |
| Human device acceptance | Phase 1 milestone only (see BACKLOG) |

Self-check against the item’s AC is enough for routine work. Independent review (fresh chat or human) is for the Phase 1 milestone, not every item.

## Human escalation

Escalate and record in `factory/STATUS.md` under **Human decisions pending** when:

- Changing an accepted ADR
- Expanding product scope (Buddy, AI Companion, iOS, web) before Phase 1 acceptance
- Privacy/security ambiguity (anything that might leave the device)
- Paid accounts, store submissions, or deploying external services (e.g. Cloudflare Workers)
- Breaking port/contract changes
- Milestone acceptance on a physical device
- Environment blockers you cannot resolve locally (including GitHub/`gh` auth)

Do **not** escalate routine implementation details omitted by the spec—choose the simplest option consistent with docs and ADRs.

## Conventions

- Durable artifacts (code, comments, docs, commits, UI strings): **English**.
- Project email: `unloopyourself.dev@gmail.com` only.
- Never commit secrets. MVP needs none.
- Ideas outside MVP: [`docs/ideas_parking_lot.md`](docs/ideas_parking_lot.md).
- Parallel implementation agents: default **no**. Prefer one local session completing one backlog item.
- **Autonomy (Phase 0–1 implementation):** After a backlog item’s gates pass, commit and push to `main` without waiting for confirmation. Do not ask for permission on routine next-item selection within Phase 0. Stop only for the Human escalation list or Phase 1 device milestone (P1-08).
