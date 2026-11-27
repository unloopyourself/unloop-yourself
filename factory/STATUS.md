# Factory status

Last updated: 2026-11-27

## Active item

**P3.5-08** — Two-device media acceptance (human milestone).  
**P3.5-09** auto-send staged + lockout — **done** (code); quiet/active two-device smoke optional with 08.  
**Branch:** `main` (Phase 3.5 media nudges).

## Last gate result

- **P3.5-00…07, P3.5-09** done.
- **Hotfix (2026-11-27):** Nokia video confirm — recover `getPendingResultAsync` + copy `content://` to cache before Base64 read; AppState reclaim after MainActivity death.
- **P3.5-09:** `buddyAutoSendStaged` (default off) + `buddyLockoutLeadMs` (15/30/45/60s); quiet → silent RR PUT; active → compose until lockout then staged if mailbox empty; silent autosends skip notify cap; seeker push carries `interruptAtMs`.
- **UI:** Settings/Buddy collapsible sections (HCI progressive disclosure) in flight / landed with SectionKit.

## Human decisions / inputs pending

| Need | Why | Status |
|------|-----|--------|
| **P3.5-08** two-device media acceptance | milestone — preset + photo + voice (± video) on both phones | **waiting on human** |
| Lockout lead default 30s | P3.5-09 feel | assumed 30s (configurable) |
| Republish privacy HTML if hosted | pages / GitHub Pages mirror of `docs/site/privacy.html` | when publishing |
| Play Console Data safety paste | mic/camera/photos + short-TTL media wording | human Console |

## Notes

- Voice: hard stop at 30s; mono ~48 kbps AAC; mailbox ≤1 MiB.
- Video: no FFmpeg re-encode; oversize/over-duration rejected on device.
- If Samsung is stuck mid-challenge on an older APK: force-stop Unloop or wait soft-unlock (~3 min), then install the new build.
- Dummy feed: close after overnight agent session to save battery.
