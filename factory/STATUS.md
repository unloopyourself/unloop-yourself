# Factory status

Last updated: 2026-11-26

## Active item

**P3.5-05** — Voice note ≤30s (`ready`, next).  
**Branch:** `main` (Phase 3.5 media nudges).

## Last gate result

- **P3.5-00…04** done — envelope, relay size reject, presets, photo, GIF.
- Mobile typecheck green.

## Human decisions / inputs pending

| Need | Why | Status |
|------|-----|--------|
| Rebuild debug APK + device smoke | native modules + permissions | when phones available |
| P3.5-08 two-device media acceptance | milestone | after voice (± video) |

## Notes

- GIF: no re-encode (must already be ≤2 MiB). Photo: JPEG compress loop.
