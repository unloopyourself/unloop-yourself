# Factory status

Last updated: 2026-09-24

## Active item

**None.** L3 hardening done: Skip + breath_tap complete E2E proven; shake sensor→complete remains PARTIAL on AVD.

## Last gate result

- L0 `npm test`: SessionEngine REGRESSION suite
- L3 `./scripts/avd/run-l3-scenarios.sh`: soft_fail + challenge_complete + threshold/overlay/open + sensor inject (shake complete via emu sensor PARTIAL)
- L4 Samsung: ask human only when batching after L0–L3 green

## Human decisions pending

- None blocking. Start AVD yourself if headless flakes; disconnect Samsung during L3.

## Notes

- AVD: `unloop_api34`. Dummy: `dev.unloopyourself.dummytarget`.
- Debug APK embeds JS (`debuggableVariants = []`) — Metro optional for L3.
- Docs: `docs/testing.md`, `docs/l3_spike_results.md`.
