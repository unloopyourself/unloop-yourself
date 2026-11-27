# Factory status

Last updated: 2026-11-27

## Active item

**P3.5-08** — Two-device media acceptance (human milestone).  
Next after that: **P3.5-09** auto-send staged + lockout (~30s).  
**Branch:** `main` (Phase 3.5 media nudges).

## Last gate result

- **P3.5-00…07** done.
- **Hotfix (2026-11-27):** stuck CHALLENGE shield with no Start/Skip — in-app Start+Skip, overlay Skip, Buddy in hamburger (list + revoke).
- **Hotfix (2026-11-27):** staged nudges now support photo/GIF/voice/video/preset (file-backed on device); prepare under Buddy ☰, send from compose.
- **Hotfix (2026-11-27):** approaching push is usage-driven (not wall-clock from Start). Hourly cap + quiet hours stay Buddy-side; FCM duplicates deduped by eventId so they do not burn the cap.
- **Design locked (2026-11-27):** quiet hours mute UI; optional auto-send staged (RR); active live until ~T−30s then staged fallback if flag on — see BACKLOG P3.5-09 / `docs/phase3_nudge_buddy.md`.

## Human decisions / inputs pending

| Need | Why | Status |
|------|-----|--------|
| **P3.5-08** two-device media acceptance | milestone — preset + photo + voice (± video) on both phones | **waiting on human** |
| Lockout lead default 30s | P3.5-09 feel | assumed 30s unless you change it |
| Republish privacy HTML if hosted | pages / GitHub Pages mirror of `docs/site/privacy.html` | when publishing |
| Play Console Data safety paste | mic/camera/photos + short-TTL media wording | human Console |

## Notes

- Voice: hard stop at 30s; mono ~48 kbps AAC; mailbox ≤1 MiB.
- Video: no FFmpeg re-encode; oversize/over-duration rejected on device.
- If Samsung is stuck mid-challenge on an older APK: force-stop Unloop or wait soft-unlock (~3 min), then install the new build.
