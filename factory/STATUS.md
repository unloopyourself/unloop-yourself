# Factory status

Last updated: 2026-11-25

## Active item

**P3-10** — Two-device acceptance (human milestone).  
**Branch:** `feature/phase3-nudge-buddy`

## Last gate result

- **P3-00…P3-09** done on branch.
- Pair HTTPS: **https://unloop-pair.pages.dev** (`/.well-known/assetlinks.json` serves JSON; debug cert fingerprint included — add Play signing certs before store App Links).
- Relay: **https://unloop-relay.unloopyourself.workers.dev**
- Samsung A40: debug 0.1.1 installed; Buddy pair UI smoked; screen lock blocked further UI automation tonight.
- Enable **Buddy** in Settings to arm approaching/warn.

## Human decisions / inputs pending

| Need | Why | Status |
|------|-----|--------|
| Unlock Samsung / keep Wi‑Fi ADB | more device smoke | as needed |
| Second Android device | P3-10 | required for milestone |
| Paste privacy into Play / GitHub Pages | Console + public URL | human |
| Add Play App Signing SHA-256 to assetlinks | production App Links | human when certs known |

## Notes

- Privacy: `docs/privacy_policy.md` + `docs/site/privacy.html` updated for Buddy/FCM.
- Do not commit secrets; `google-services.json` stays gitignored under `apps/mobile/`.
