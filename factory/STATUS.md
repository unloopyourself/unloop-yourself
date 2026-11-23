# Factory status

Last updated: 2026-11-23

## Active item

**0.1.1 (`versionCode` 3)** merged to `main`. Next: signed AAB → Play Internal testing for testers.

## Last gate result

- Core tests: 91 passed
- Sensor harden: world-yaw for look_away / coin_spin / long_press / rotate_phone; progressive stand_up / hold_still
- Boot auto-start monitor when enabled; Settings expandable challenge list; disabled challenges never picked
- Splash brand + overlay copy; unlock phrases curated
- Application ID: `io.github.unloopyourself.unloop` (ADR-009)

## Human decisions pending

- Play Console: upload AAB `versionCode` 3 to Internal testing (needs upload keystore on the build machine)
  - Expected AAB: `apps/mobile/android/app/build/outputs/bundle/release/app-release.aab`
  - Privacy URL: `https://unloopyourself.github.io/unloop-yourself/site/privacy.html`
  - This Windows host has no `unloop-upload.jks` / `UNLOOP_UPLOAD_*` — build signed AAB on the machine that holds the upload keystore (or restore credentials locally), then upload.

## Notes

- Defaults unchanged; pack is Settings opt-in. `air_write` stays hidden. `coin_spin` still rough; leave for later.
- Experiment notes: [`docs/experiment_challenge_pack_10.md`](../docs/experiment_challenge_pack_10.md).
- Play prep: [`docs/play_publishing.md`](../docs/play_publishing.md).
