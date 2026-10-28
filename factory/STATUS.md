# Factory status

Last updated: 2026-10-28

## Active item

**Challenge pack ×10** merged to `main` (opt-in in Settings). Next: upload AAB `versionCode` 2 to Play Internal testing.

## Last gate result

- Application ID: `io.github.unloopyourself.unloop` (ADR-009)
- Debug harness in `src/debug` only; ToneGenerator adapter for `audio_silence_tap`
- Exit-oriented pack on main (opt-in): hold_still, countdown_type, long_press, intention_type, look_away, rotate_phone, stand_up, sip_water, feeling_check, audio_silence_tap
- Privacy policy + Play checklist + AAB scripts landed

## Human decisions pending

- Play Console: listing / Data safety / upload AAB Internal testing
  - AAB: `apps/mobile/android/app/build/outputs/bundle/release/app-release.aab`
  - Privacy URL: `https://unloopyourself.github.io/unloop-yourself/site/privacy.html`

## Notes

- Defaults unchanged; pack is Settings opt-in. `air_write` stays hidden.
- Experiment notes: [`docs/experiment_challenge_pack_10.md`](../docs/experiment_challenge_pack_10.md).
- Play prep: [`docs/play_publishing.md`](../docs/play_publishing.md).
