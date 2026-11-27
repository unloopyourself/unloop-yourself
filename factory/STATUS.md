# Factory status

Last updated: 2026-11-27

## Active item

**P3.5-08** — Two-device media acceptance (human milestone).  
**Branch:** `main` (Phase 3.5 media nudges).

## Last gate result

- **P3.5-00…07** done.
- **Hotfix (2026-11-27):** stuck CHALLENGE shield with no Start/Skip — in-app Start+Skip, overlay Skip, Buddy in hamburger (list + revoke).

## Human decisions / inputs pending

| Need | Why | Status |
|------|-----|--------|
| **P3.5-08** two-device media acceptance | milestone — preset + photo + voice (± video) on both phones | **waiting on human** |
| Republish privacy HTML if hosted | pages / GitHub Pages mirror of `docs/site/privacy.html` | when publishing |
| Play Console Data safety paste | mic/camera/photos + short-TTL media wording | human Console |

## Notes

- Voice: hard stop at 30s; mono ~48 kbps AAC; mailbox ≤1 MiB.
- Video: no FFmpeg re-encode; oversize/over-duration rejected on device.
- If Samsung is stuck mid-challenge on an older APK: force-stop Unloop or wait soft-unlock (~3 min), then install the new build.
