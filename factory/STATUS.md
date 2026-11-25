# Factory status

Last updated: 2026-11-25

## Active item

**P3-04** — PushPort + FCM Android adapter (`ready`; next).  
**Branch:** `feature/phase3-nudge-buddy`  
Autonomy: light factory (ADR-007). Human go-ahead 2026-11-25 (“parti pure…”).

Living plan: [`docs/phase3_nudge_buddy.md`](../docs/phase3_nudge_buddy.md). ADR-010 accepted.

## Last gate result

- **P3-00** done — ADR-010 in `docs/decisions.md`.
- **P3-01** done — Core nudge/pairing ports + Vitest (105 tests).
- **P3-02** done — Settings → Buddy: QR + copy/share + paste accept + revoke; scheme `unloop://`; local store (no relay yet in app).
- **P3-03** done — `workers/relay` deployed: `https://unloop-relay.unloopyourself.workers.dev` (KV bound). TLS from this Windows host may still handshake-fail briefly after subdomain create; wrangler deploy OK.
- Firebase `unloop-82179` + gitignored credentials on machine.
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
