# Factory status

Last updated: 2026-11-25

## Active item

**P3-05** — Progressive live path: approaching / cancel / B notify UI (`in_progress`).  
**Branch:** `feature/phase3-nudge-buddy`  
Autonomy: light factory (ADR-007). Human go-ahead 2026-11-25 (“parti pure…”).

Living plan: [`docs/phase3_nudge_buddy.md`](../docs/phase3_nudge_buddy.md). ADR-010 accepted.

## Last gate result

- **P3-00…P3-04** done.
- **Device smoke (Samsung SM-A405FN Wi‑Fi ADB `192.168.1.7:44068`):**
  - Debug `0.1.1` / `versionCode` 3 installed (`installDebug`).
  - Buddy screen opens; QR + fingerprint; deep link `unloop://pair?…` accepted → “Associato con SAMSUNGB” + paired list + Revoke.
  - Relay `/health` OK; `PUT /v1/push-token` OK.
- **P3-05:** Core `NudgeBus` + app wiring (begin on Start watching, cancel on Stop, approaching notify to paired mailboxes, interrupt fetch audit). B compose UI still open.
- Rebuild after latest App.tsx wiring may still be in flight / pending reinstall.

## Human decisions / inputs pending

| Need | Why | Status |
|------|-----|--------|
| Second Android device | P3-10 full acceptance | nice-to-have |
| Wi‑Fi ADB | device testing | **online** (Samsung A40) |
| Play upload-key / privacy paste | Console | human |

## Autonomy contract (Phase 3)

- Continue without per-step asks; stop for paid spend, new vendors, privacy ambiguity, store submit, secrets in git.

## Notes

- Relay: `https://unloop-relay.unloopyourself.workers.dev`
- `google-services.json` local under `apps/mobile/` (gitignored).
