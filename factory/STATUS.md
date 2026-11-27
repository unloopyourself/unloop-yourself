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
- **Hotfix (2026-11-27):** Seeker auto-opens Buddy nudge (distinct copy vs challenge gate). Notification tap force-opens live compose (text/video first); FCM `channelId` tray verified on Nokia.
- **Hotfix (2026-11-27):** Native monitor threshold sync from Settings (`updateNativeThreshold` on persist + Start watching) — stuck harness 12s was firing push/interrupt almost together. Happy-path 5 min Dummy (Samsung→Nokia): push@180s HTTP 200 + compose, staged autosend@270s, interrupt@300s.
- **Hotfix (2026-11-27):** Live Buddy compose wizard — type chips (text / GIF·emoji / audio / video), built-in stickers+emoticons, save-after-record prompt.
- **Hotfix (2026-11-27):** Broader default challenge set so unlock_phrase is not ~1/3 of interrupts when Settings only had a tiny enabled list.
- **Hotfix (2026-11-27):** Audio silence-tap — bring MainActivity to front before tone; defer ToneGenerator until AppState active (no buried-feed beep).

## Human decisions / inputs pending

| Need | Why | Status |
|------|-----|--------|
| **P3.5-08** two-device media acceptance | milestone — preset + photo + voice (± video) on both phones | **waiting on human** |
| Play Console Data safety paste | mic/camera/photos | human Console |

## Notes

- Existing pairs load with `notifyApproaching=false` until the seeker opts in per buddy (Buddy list toggles).
- Staged/auto-send on the Buddy phone still requires an approaching push — enable “Notify when I scroll” for buddies who should auto-send or compose live.
