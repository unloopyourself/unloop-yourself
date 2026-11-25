# Factory status

Last updated: 2026-11-25

## Active item

**P3-08** — HTTPS pair links on Cloudflare Pages + assetlinks (`blocked` on human Pages OK — can proceed if go-ahead implied).  
**P3-09** — Privacy / Play declarations (`ready`).  
**Branch:** `feature/phase3-nudge-buddy`

Living plan: [`docs/phase3_nudge_buddy.md`](../docs/phase3_nudge_buddy.md). ADR-010.

## Last gate result

- **P3-00…P3-07** implemented on branch (Buddy settings gated off by default; approaching/compose/nudge interrupt cascade).
- Samsung A40 Wi‑Fi ADB used for install + Buddy pair smoke; full U↔B needs 2nd device (P3-10).
- Relay: `https://unloop-relay.unloopyourself.workers.dev`

## Human decisions / inputs pending

| Need | Why | Status |
|------|-----|--------|
| CF Pages project OK | P3-08 | awaiting explicit if not covered by prior go-ahead |
| Second Android device | P3-10 | nice-to-have |
| Wi‑Fi ADB | device | **online** (Samsung A40) |
| Play / privacy paste | P3-09 Console | human |

## Notes

- Enable Buddy in Settings to arm approaching/warn path.
- `google-services.json` local under `apps/mobile/` (gitignored).
