# Factory status

Last updated: 2026-11-25

## Active item

**P3-00** — ADR NudgeProvider / PushPort / cascade / pairing v0 (`ready`).  
**Branch:** `feature/phase3-nudge-buddy` (all Phase 3 work stays off `main` until merge).  
Autonomy mode: light factory (ADR-007). One backlog item at a time; specialized review only on crypto/pairing/relay. No multi-agent swarm.

Living plan: [`docs/phase3_nudge_buddy.md`](../docs/phase3_nudge_buddy.md).

## Last gate result

- Phase 1 / 1.5: Play prep + signed AAB `0.1.1` / `versionCode` 3 (upload key reset may still be pending on Console).
- Timing defaults: interrupt 10 min, grace 20 min, soft unlock 3 min; Settings minute chip pickers.
- Phase 3 docs: parking lot + roadmap + living plan landed (may still be uncommitted on this machine).

## Human decisions / inputs pending

Fill these so the agent can run P3 without babysitting:

| Need | Why | Status |
|------|-----|--------|
| **Approve Phase 3 start** while Play internal testing continues | Scope expansion (AGENTS escalation list) | awaiting |
| **GitHub push auth** for `unloopyourself` org (switch `gh` account or PAT) | `main` is ahead locally; personal account got 403 | awaiting |
| Confirm commit of pending local work (timings UI + Phase 3 docs) | Dirty tree + 3 commits unpushed | awaiting ask-to-commit if required by user rules — agent will commit when told or under AGENTS autonomy once approved |
| **Cloudflare account** under project control + **API token** (Workers + Pages edit, account read) | P3-03 / P3-08 deploy | awaiting |
| **Explicit OK to create/deploy** Worker + Pages on CF free tier | External deploy | awaiting |
| **Firebase/FCM project** (or OK to create with `unloopyourself.dev@gmail.com`) + share `google-services` / server key path **without** Analytics | P3-04 push | awaiting |
| Second Android device (or emulator) for pairing acceptance | P3-10 | nice-to-have |
| Wi‑Fi ADB re-pair when device testing needed | Device currently offline in `adb devices` | as needed |
| Play: confirm upload-key reset active; keep `credentials/UPLOAD_KEY_BACKUP.txt` offline | Release continuity | human |

**Do not send:** passwords in chat. Prefer local files under gitignored `credentials/` or env vars the agent can read on this machine.

## Autonomy contract (Phase 3)

- After you clear the table above (or mark rows N/A), agent picks next `ready` item, implements, tests, updates BACKLOG/STATUS, commits & pushes without per-step asks.
- Still stops for: paid spend, new cloud vendors, privacy ambiguity, ADR changes, store submit, secrets in git.
- Specialized subagent review: optional on P3-00/P3-03/P3-04 only if it catches real issues; otherwise single-session implementation.

## Notes

- Prefer Cloudflare Pages (not GitHub Pages) for pair HTTPS + assetlinks; privacy page may stay on GitHub Pages until migrated.
- Relay stays postman (KV + TTL); avoid D1/R2 unless a later ADR says so.
