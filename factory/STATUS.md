# Factory status

Last updated: 2026-09-24

## Active item

**None.** Phase 1.5 pack + **SessionEngine regression suite** (agent-autonomous L0).

## Last gate result

- `npm test`: **32** Core tests (incl. REGRESSION SessionEngine scenarios)
- mobile typecheck / boundaries: run on commit
- Device batch smoke: deferred to human when convenient

## Human decisions pending

- **Create Android AVD?** (first-time system image download; enables agent L3 smoke). Say yes/no.
- Soft-unlock default remains 45s unless you change Timings.
- Later fork: iOS / Buddy / Play / parking challenges.

## Notes

- Autonomy path: L0 SessionEngine scenarios ≫ emulator ≫ physical batch (see `docs/testing.md`).
- App runtime now driven by `SessionEngine` (same brain as tests).
