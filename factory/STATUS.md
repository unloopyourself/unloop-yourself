# Factory status

Last updated: 2026-11-25

## Active item

**P3-05** — Progressive live path: approaching / cancel / B notify UI (`in_progress`).  
**Branch:** `feature/phase3-nudge-buddy`  
Autonomy: light factory (ADR-007). Human go-ahead 2026-11-25 (“parti pure…”).

Living plan: [`docs/phase3_nudge_buddy.md`](../docs/phase3_nudge_buddy.md). ADR-010 accepted.

## Last gate result

- **P3-00…P3-04** done (ADR-010, Core ports, Buddy UI, Worker+KV+FCM, Expo PushPort).
- **P3-05** Core `NudgeBus` eventId lifecycle + Vitest landed; app approaching/B-notify UI still open.
- Relay: `https://unloop-relay.unloopyourself.workers.dev`
- Device E2E push / two-device smoke pending ADB rebuild with `google-services.json`.
- Timing defaults: interrupt 10 / grace 20 / soft unlock 3 min.

## Human decisions / inputs pending

| Need | Why | Status |
|------|-----|--------|
| **Approve Phase 3 start** | Scope | **approved** |
| **CF deploy OK** | External | **approved** + deployed |
| **Firebase/FCM** | P3-04 | **done** (`credentials/`) |
| **GitHub push auth** (`unloopyourself`) | push may 403 | as needed |
| Second Android device | P3-10 | nice-to-have |
| Wi‑Fi ADB | device offline | as needed |
| Play upload-key / privacy paste | Console | human |

## Autonomy contract (Phase 3)

- Continue P3-04 → … without per-step asks; stop for paid spend, new vendors, privacy ambiguity, store submit, secrets in git.
- Specialized review optional on crypto/pairing/relay.

## Notes

- Relay URL also in `.env.local` as `UNLOOP_RELAY_URL`.
- Prefer Cloudflare Pages later for pair HTTPS + assetlinks (P3-08).
- No Analytics / Crashlytics / OneSignal.
