# Factory status

Last updated: 2026-09-24

## Active item

**None.** Capability × platform compatibility model landed (P1.5-09 / ADR-008).

## Last gate result

- L0 `npm test`: 39 tests (incl. capability profile matrix + SessionEngine low_end path)
- L1 `scripts/check-boundaries.sh`
- L3 harness: soft-fail + breath_tap complete (prior); capability override wired for `low_end` via `--es capabilities`
- L4 Samsung: ask human only when batching

## Human decisions pending

- None blocking.

## Notes

- Compatibility: `docs/compatibility.md`, ADR-008.
- AVD: `unloop_api34`. Dummy: `dev.unloopyourself.dummytarget`.
