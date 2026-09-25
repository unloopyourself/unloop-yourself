# Play Console — first testing release

Checklist for the first **internal / closed testing** upload of Unloop.

## Identifiers

| Field | Value |
|-------|--------|
| App name | **Unloop** |
| Application ID | `io.github.unloopyourself.unloop` |
| Version name | from `apps/mobile/app.json` → `expo.version` (currently `0.1.0`) |
| Version code | from `apps/mobile/app.json` → `expo.android.versionCode` (currently `1`) |
| Contact | `unloopyourself.dev@gmail.com` |

## Before you build the AAB

1. **Upload keystore (once)**  
   ```bash
   ./scripts/android/create-upload-keystore.sh
   ```  
   Store the `.jks` + passwords offline. Never commit them.

2. **Configure signing** — either:
   - `apps/mobile/android/keystore.properties` (after prebuild), from `apps/mobile/keystore.properties.example`, or
   - export `UNLOOP_UPLOAD_STORE_FILE`, `UNLOOP_UPLOAD_STORE_PASSWORD`, `UNLOOP_UPLOAD_KEY_ALIAS`, `UNLOOP_UPLOAD_KEY_PASSWORD`

3. **Privacy Policy URL** — publish `docs/site/privacy.html` (e.g. GitHub Pages) and paste the HTTPS URL into Play Console.  
   Markdown source: [`docs/privacy_policy.md`](privacy_policy.md).

4. Confirm **debug harness** is not in release: `DebugHarnessReceiver` lives only under `modules/unloop-usage/android/src/debug/`.

## Build the AAB

```bash
./scripts/android/build-play-aab.sh
```

Output: `apps/mobile/android/app/build/outputs/bundle/release/app-release.aab`

## Play Console steps (human)

1. Create app → name **Unloop**, language, free, declarations as applicable.
2. **Store listing** (can stay draft for internal testing, but fill early): short description, full description, icon 512, feature graphic 1024×500, screenshots, email.
3. **App content → Privacy policy** → URL to the published privacy page.
4. **Data safety**: no off-device collection/sharing for the MVP; declare on-device Usage Access / sensors as needed by the form wording.
5. **App access / Sensitive permissions**: explain Usage Access, overlay, and foreground service (digital wellbeing interrupt requested by the user).
6. Create **Internal testing** track → upload AAB → add tester emails / Google group → share opt-in link.

## Smoke on a tester device

Install from the Play testing link (not the old `dev.unloopyourself.app` debug APK):

- Grant Usage Access + overlay
- Start watching → open a feed → interrupt → complete or soft-unlock
- Confirm no Metro / debug harness dependence

## Do not upload

- Debug-signed AAB/APK
- Builds that still export `DebugHarnessReceiver`
- Personal keystores into git

## Related

- ADR-009 (applicationId): [`docs/decisions.md`](decisions.md)
- Testing layers: [`docs/testing.md`](testing.md)
