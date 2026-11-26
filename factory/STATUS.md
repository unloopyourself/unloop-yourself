# Factory status

Last updated: 2026-11-26

## Active item

**P3.5-04** — GIF + text+GIF (`ready`, next).  
**Branch:** `main` (Phase 3.5 media nudges).

## Last gate result

- **P3.5-00…03** done — envelope v1, relay 8 MiB reject (deployed), sound presets, photo (+ caption) compose/render.
- Mobile typecheck green; Core tests green.

## Human decisions / inputs pending

| Need | Why | Status |
|------|-----|--------|
| Rebuild debug APK + device smoke | new native modules (`expo-av`, image picker) | when phones available |
| P3.5-08 two-device media acceptance | milestone | later |

## Notes

- Caps unchanged. Preset WAVs under `apps/mobile/assets/buddy-presets/`.
- Photo path needs a fresh native build (plugins/permissions).
