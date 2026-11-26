# Factory status

Last updated: 2026-11-26

## Active item

**P3.5-06** — Video ≤10s compressed (`ready`, next).  
**Branch:** `main` (Phase 3.5 media nudges).

## Last gate result

- **P3.5-00…05** done — envelope, relay size reject, presets, photo, GIF, voice (expo-audio).
- Mobile typecheck green.
- Device: sound-preset interrupt smoke OK after expo-av → expo-audio fix.

## Human decisions / inputs pending

| Need | Why | Status |
|------|-----|--------|
| Rebuild + voice smoke on devices | mic permission / record path | when unlocked |
| P3.5-08 two-device media acceptance | milestone | after video (±) |

## Notes

- Voice: hard stop at 30s; mono ~48 kbps AAC; mailbox ≤1 MiB.
