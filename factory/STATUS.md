# Factory status

Last updated: 2026-11-26

## Active item

**P3.5-03** — Photo + text+photo (`ready`, next).  
**Branch:** `main` (Phase 3.5 media nudges).

## Last gate result

- **P3.5-00** done — Core envelope v1 + caps (121 Core tests green).
- **P3.5-01** done — relay rejects ciphertext &gt; 8 MiB (413); deployed.
- **P3.5-02** done — ship_horn / truck_horn / hell_yeah presets in compose + interrupt play (`expo-av`).

## Human decisions / inputs pending

| Need | Why | Status |
|------|-----|--------|
| Device smoke for presets (optional until P3.5-08) | hear SFX on interrupt | when phones available |
| Two-device media acceptance (P3.5-08) | milestone | later |

## Notes

- Caps: photo/GIF ≤2 MiB; voice ≤30s/≤1 MiB; video ≤10s/≤8 MiB (~720p); envelope ≤8 MiB.
- Preset WAVs are original synth SFX under `apps/mobile/assets/buddy-presets/` (`scripts/generate-nudge-presets.mjs`).
