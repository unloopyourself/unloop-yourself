# Factory status

Last updated: 2026-11-26

## Active item

**P3.5-08** — Two-device media acceptance (human milestone).  
**Branch:** `main` (Phase 3.5 media nudges).

## Last gate result

- **P3.5-00…07** done — envelope, relay size reject, presets, photo, GIF, voice (`expo-audio`), video (`expo-video`, ≤10s / ≤8 MiB reject-oversize), privacy + Play notes.
- Mobile typecheck green; Core `nudgeEnvelope` tests green.
- Debug APK with video path installed on Samsung `192.168.1.7:44068` + Nokia `192.168.1.225:40431`.

## Human decisions / inputs pending

| Need | Why | Status |
|------|-----|--------|
| **P3.5-08** two-device media acceptance | milestone — preset + photo + voice (± video) on both phones | **waiting on human** |
| Republish privacy HTML if hosted | pages / GitHub Pages mirror of `docs/site/privacy.html` | when publishing |
| Play Console Data safety paste | mic/camera/photos + short-TTL media wording | human Console |

## Notes

- Voice: hard stop at 30s; mono ~48 kbps AAC; mailbox ≤1 MiB.
- Video: no FFmpeg re-encode; oversize/over-duration rejected on device.
