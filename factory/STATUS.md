# Factory status

Last updated: 2026-09-24

## Active item

**None.** L3 AVD spike complete; harness green for threshold→overlay→Open challenge.

## Last gate result

- L0 `npm test`: SessionEngine REGRESSION suite
- L3 `./scripts/avd/run-l3-scenarios.sh`: PASS (install, perms, UsageStats threshold→overlay, Open challenge, sensor inject)
- L4 Samsung: **ask human only when batching** after L0–L3 green

## Human decisions pending

- None blocking. Keep starting AVD yourself if agent headless start flakes; agent attaches via `adb`.

## Notes

- AVD: `unloop_api34`. Dummy: `dev.unloopyourself.dummytarget`.
- Docs: `docs/testing.md`, `docs/l3_spike_results.md`.
