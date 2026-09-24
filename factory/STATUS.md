# Factory status

Last updated: 2026-09-24

## Active item

**None.** Next ready: **P1.5-12** `air_write`.

## Last gate result

- P1.5-10 variety + P1.5-11 coin_spin: `npm test` 44 passed; mobile typecheck; `check-boundaries.sh` OK

## Human decisions pending

- None blocking.
- Product note: air_write next; synonyms deferred; audio only with explicit opt-in.

## Notes

- `coin_spin` is opt-in in Settings (not default-enabled); requires gyroscope.
- Compatibility matrix: `full` = accel+gyro; `no_gyro` excludes coin_spin.
