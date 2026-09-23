# Unloop — Architecture Decision Records (ADR)

> *"Trace architectural choices and their rationale so the vision stays coherent over time."*

---

## ADR structure (lightweight MADR)

Each record includes: **Date and status**, **Context**, **Decision**, **Alternatives**, **Consequences**.

---

## ADR-001: Android-first development for the prototype

* **Date:** 2026-08-05
* **Status:** Accepted

### Context
MVP needs to validate quickly: *“Does a 5–10 second challenge break scroll autopilot?”* Parallel iOS work requires paid Apple Developer enrollment, certificates, and Screen Time entitlements.

### Decision
Adopt **Android-first** for the initial MVP.

### Alternatives
1. **iOS-first** — immediate entitlement and paid account friction.
2. **Full parallel** — doubles platform debugging and slows learning.

### Consequences
* **Pros:** APK distribution without mid-stream license cost; fast cycles on real devices.
* **Trade-off:** Core must sit behind ports from day one so Android adapters do not poison iOS portability.

---

## ADR-002: Technology stack (React Native + Expo + TypeScript)

* **Date:** 2026-08-05
* **Status:** Accepted

### Context
Need shared business logic for Android and iOS, a gentle learning curve, and strong LLM/tooling familiarity for accelerated development.

### Decision
Use **React Native with Expo**, in **TypeScript**.

### Alternatives
1. **Pure native (Kotlin + Swift)** — max performance, doubled codebase, weaker shared refactoring.
2. **Flutter (Dart)** — strong UI, weaker TypeScript/Expo ecosystem fit for this team and tooling.

### Consequences
* **Pros:** One TypeScript Core; mature libraries; good Cursor fit.
* **Trade-off:** OS-specific APIs need Native Modules / Expo config plugins.

---

## ADR-003: Challenge model via Strategy pattern (no over-engineering)

* **Date:** 2026-08-05
* **Status:** Accepted

### Context
Temptation existed to build a plugin framework with dynamic HTML WebViews, sandboxes, and a marketplace—analysis paralysis risk.

### Decision
Challenges are simple TypeScript / native components implementing a minimal `Challenge` contract.

### Alternatives
1. **WebView plugin system** — security, memory, and load-time cost for MVP.
2. **Remote dynamic sources (WASM / micro-frontends)** — premature.

### Consequences
* **Pros:** Fast MVP; easy to add `ShakeChallenge`, `ReflectionChallenge`, etc.
* **Trade-off:** MVP challenges are compiled into the app, not downloaded.

---

## ADR-004: Hexagonal architecture for OS API isolation

* **Date:** 2026-08-05
* **Status:** Accepted

### Context
iOS (DeviceActivity callbacks) and Android (UsageStats / services) differ radically.

### Decision
Isolate monitoring and blocking behind **`UsageDetectorPort`** (and sibling ports).

### Alternatives
1. **`if Platform.OS === ...` everywhere** — hard to test, fragile to OS updates.

### Consequences
* **Pros:** Core never knows how time is measured; OS changes hit adapters only.
* **Trade-off:** Two separate adapter stacks to maintain.

---

## ADR-005: Lightweight typed event emitter

* **Date:** 2026-08-05
* **Status:** Accepted

### Context
Audit trail, Autopilot Score, and Buddy sync should react to challenge completion without Core knowing them.

### Decision
Minimal **typed event emitter** without a heavy third-party bus.

### Alternatives
1. **RxJS / Redux-Saga** — dependency and tracing cost.
2. **Direct synchronous calls** — tight coupling.

### Consequences
* **Pros:** Modular, testable, transparent local audit.
* **Trade-off:** Event payload types must stay disciplined.

---

## ADR-006: Local-first app and stateless relay for privacy

* **Date:** 2026-08-05
* **Status:** Accepted

### Context
Manifesto forbids collecting or profiling usage on centralized servers.

### Decision
**Local-first** app. Future Buddy feature uses a **stateless encrypted relay** (e.g. Cloudflare Workers) as a temporary postman—no database, no retention. Deploy only with explicit human approval.

### Alternatives
1. **Traditional backend (Firebase / Supabase)** — personal data, GDPR surface, auth, infra cost.

### Consequences
* **Pros:** Strong privacy story; near-zero server fixed cost.
* **Trade-off:** No cloud recovery of local history without an explicit user backup.

---

## ADR-007: Minimal in-repo Software Factory

* **Date:** 2026-09-23
* **Status:** Accepted

### Context
The project needs resumable, low-babysitting development in Cursor without paid cloud agents or orchestration theater. An earlier design proposed multiple skills, role docs, markdown contracts, and dual status files—most of which are not native Cursor runtimes and would burn tokens.

### Decision
Represent the factory as:

* [`AGENTS.md`](../AGENTS.md) — project workflow and conventions
* [`.cursor/rules/unloop.mdc`](../.cursor/rules/unloop.mdc) — concise always-on Cursor guardrails only (no duplication of AGENTS.md)
* [`factory/BACKLOG.md`](../factory/BACKLOG.md) + [`factory/STATUS.md`](../factory/STATUS.md) — work and resumability
* [`scripts/check-boundaries.sh`](../scripts/check-boundaries.sh) — deterministic gates

No project skills swarm, hooks, automations, or multi-agent orchestration unless a concrete problem later requires them.

### Alternatives
1. **Heavy factory** (many skills, roles, contract markdown trees) — high maintenance, little native enforcement.
2. **No persistent backlog** — poor resumability across chats.

### Consequences
* **Pros:** Understandable by a human takeover; cost-aware; Cursor-native where it matters (rules).
* **Trade-off:** Discipline depends on agents reading AGENTS/STATUS; mitigated by alwaysApply rule pointing at privacy/cost constraints.
