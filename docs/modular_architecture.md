# Unloop — Modular architecture notes (appendix)

English supersession of the former Italian high-level modular appendix.

## Abstraction level

Describe domain concepts, boundaries, and responsibilities. Avoid premature binding to folder layouts, detailed algorithms, or library names. Keep decisions reversible.

## Core independence

Domain logic lives in a Core that is agnostic of mobile/web/desktop hosts, UI frameworks, and OS APIs.

## Macro-blocks

| Module | Responsibility |
|--------|----------------|
| Session FSM | Monitoring/interrupt lifecycle; prevent incoherent races |
| Policy Engine | When to interrupt, intensity/category, cooldown, later Buddy/AI escalation |
| Challenge Engine | Pick a compatible challenge for DeviceContext |
| Persistence / monitoring state | Reconstruct thresholds and session after restart/crash |
| Typed event emitter | 1→N domain events for audit, metrics, sync listeners |
| Ports and adapters | Usage, notifications, sensors, storage at the edge |

## Documentation layers

| Layer | Role |
|-------|------|
| Manifesto | Philosophy and ethics |
| Architecture | Modules, boundaries, flows |
| Roadmap | Timing and MVP perimeter |
| ADRs | Specific technology decisions |

Canonical detail: [architecture.md](architecture.md).
