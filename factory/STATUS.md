# Factory status

Last updated: 2026-11-25

## Active item

**P3-10** — Two-device acceptance (`in_progress` — pairing OK; live approaching path still to exercise).  
**Branch:** `feature/phase3-nudge-buddy`

## Last gate result

- **P3-00…P3-09** done on branch.
- **Devices (Wi‑Fi ADB):** Samsung SM-A405FN (`192.168.1.7:44068`) + Nokia 3.2 (`192.168.1.225:40431`), both Android 11 — **enough for Buddy MVP**.
- Nokia: debug APK installed (first launch ANR once, then OK — slow device).
- **Mutual pair smoke:** Nokia accepted Samsung invite (`3FEDC388`); Samsung list includes Nokia (`141F17F1`).
- Pair HTTPS: **https://unloop-pair.pages.dev**
- Relay: **https://unloop-relay.unloopyourself.workers.dev**

## Human decisions / inputs pending

| Need | Why | Status |
|------|-----|--------|
| Keep both unlocked + ADB | finish P3-10 live path | as needed |
| Paste privacy into Play / GitHub Pages | Console + public URL | human |
| Add Play App Signing SHA-256 to assetlinks | production App Links | human when certs known |

## Notes

- Privacy: `docs/privacy_policy.md` + `docs/site/privacy.html` updated for Buddy/FCM.
- Do not commit secrets; `google-services.json` stays gitignored under `apps/mobile/`.
