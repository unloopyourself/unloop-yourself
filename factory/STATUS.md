# Factory status

Last updated: 2026-11-27

## Active item

**P3.5-08** — Two-device media acceptance (human milestone).  
**Branch:** `main` (Phase 3.5 media nudges).

## Last gate result

- **P3.5-00…07, P3.5-09** done.
- **Hotfix (2026-11-27):** Samsung video over-duration — soft-clamp OEM clips under size cap (hard reject >20s); camera quality 0.2.
- **Hotfix (2026-11-27):** Per-buddy seeker prefs — `notifyApproaching` default **off** (no live tracking ping); `acceptNudges` default on (suspend without revoke). Approaching FCM only to opted-in buddies.
- **Hotfix (2026-11-27):** Nokia video reclaim + P3.5-09 autosend/lockout + Settings/Buddy collapsible UI.
- **Hotfix (2026-11-27):** Approaching notify moved into native UsageMonitorService (JS timers die when Unloop is backgrounded). Relay FCM adds tray `notification` for `type=approaching`.

## Human decisions / inputs pending

| Need | Why | Status |
|------|-----|--------|
| **P3.5-08** two-device media acceptance | milestone — preset + photo + voice (± video) on both phones | **waiting on human** |
| Republish privacy HTML if hosted | pages mirror | when publishing |
| Play Console Data safety paste | mic/camera/photos | human Console |

## Notes

- Existing pairs load with `notifyApproaching=false` until the seeker opts in per buddy (Buddy list toggles).
- Staged/auto-send on the Buddy phone still requires an approaching push — enable “Notify when I scroll” for buddies who should auto-send or compose live.
