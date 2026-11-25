# Factory status

Last updated: 2026-11-26

## Active item

None — **Phase 3 Buddy/nudge MVP accepted** (P3-00…P3-10 done).  
**Branch:** `feature/phase3-nudge-buddy` (merging to `main`).

## Last gate result

- **P3-10** human sign-off 2026-11-26 (trust; cancel/leave-early not re-run).
- Live smoke: Samsung SM-A405FN + Nokia 3.2 — approaching → FCM compose → mailbox nudge → interrupt cascade showed buddy text.
- Pair: **https://unloop-pair.pages.dev**
- Relay: **https://unloop-relay.unloopyourself.workers.dev**

## Human decisions / inputs pending

| Need | Why | Status |
|------|-----|--------|
| Paste privacy into Play / GitHub Pages | Console + public URL | human |
| Add Play App Signing SHA-256 to assetlinks | production App Links | human when certs known |

## Notes

- Privacy: `docs/privacy_policy.md` + `docs/site/privacy.html` updated for Buddy/FCM.
- Do not commit secrets; `google-services.json` stays gitignored under `apps/mobile/`.
