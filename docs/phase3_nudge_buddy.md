# Phase 3 — Nudge system & human Buddy (living plan)

> Updatable plan. Phase 1 standalone stays in testing; Phase 2 (iOS) is **skipped for now**. Focus: abstract nudge bus + **human** Buddy first.  
> Related: [`roadmap.md`](roadmap.md), [`decisions.md`](decisions.md) ADR-006, [`ideas_parking_lot.md`](ideas_parking_lot.md), [`vision.md`](vision.md).

**Last updated:** 2026-11-25  
**Status:** Active — backlog P3-00…P3-10; ADR-010 accepted  
**Human gates:** Play / privacy copy updates for Buddy; two-device acceptance (P3-10). CF free-tier deploy approved 2026-11-25.

---

## 1. Goals

1. Add a **nudge system** behind ports so providers are swappable (human, later AI, later benefactor).
2. Ship **human Buddy** end-to-end on Android: pair → warn → live/default/prereg nudge → show at interrupt → cancel path.
3. Keep **local challenges** as the always-available fallback.
4. Do **not** build a social network (no feed, likes, discovery graph).

### Non-goals (this phase)

* iOS / APNs (Phase 2 deferred) — only abstract `PushPort`
* Full AI Companion behaviour (Phase 4) — **stub** `AiCompanionProvider` only
* Anonymous benefactor network (parking lot) — interface-shaped, not implemented
* Custom paid domain unless App Links later need it (see §7)

---

## 2. Cascade at interrupt

Ordered preference (all steps gated by Settings):

| Priority | Provider | Behaviour |
|----------|----------|-----------|
| 1 | **Human Buddy** | Nudges in mailbox for this `eventId` (live, pre-registered pick, or buddy default auto-send) |
| 2 | **AI Companion** | Same `NudgeProvider` contract; Phase 3 = no-op / local template stub |
| 3 | **Embedded challenges** | Existing pack (`shake`, `rotate_phone`, …) |

Soft-unlock / timeout unchanged. Missing buddy hardware or empty mailbox ≠ app failure → fall through.

---

## 3. Target UX (progressive live)

Defaults off until user enables Buddy features.

1. **U** doomscrolls under monitoring (existing ΔU / threshold, e.g. 10 min).
2. At **T−warn** (e.g. 8 min / 2 min before interrupt): U’s device posts opaque/encrypted `approaching{eventId}` to relay → **push** to paired buddies who opted in (respect quiet hours / max frequency on B).
3. **B** may: ignore | send pre-registered nudge | record live (voice/photo/text/…) | rely on **default nudge** auto-fire if enabled (“Hey — B knows you’re deep in it”).
4. Worker holds ciphertext in **mailbox(U, eventId)** with short TTL.
5. At **T=0**: Unloop overlay; U fetches mailbox for `eventId` (short grace window for late uploads) → show buddy nudge(s); else cascade to AI stub → else local challenge.
6. If U **leaves feed before T=0**: `cancel(eventId)` → purge mailbox; optional push to B “U left the tunnel”.

---

## 4. Architecture (ports)

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│ Session /   │────▶│ NudgeBus     │────▶│ RelayPort       │
│ Policy      │     │ (eventId,    │     │ (CF Worker)     │
└─────────────┘     │  mailbox)    │     └────────┬────────┘
        │           └──────┬───────┘              │
        ▼                  │                      ▼
┌─────────────┐     ┌──────▼───────┐     ┌─────────────────┐
│ Challenge   │     │ NudgeProvider│     │ PushPort        │
│ Engine      │     │  HumanBuddy  │     │  FcmAdapter     │
│ (fallback)  │     │  AiStub      │     │  (APNs later)   │
└─────────────┘     └──────────────┘     └─────────────────┘
```

* **Core** knows providers by capability (`buddy_configured`, `ai_nudge`, …), not FCM/CF.
* **Relay** = postman: TTL mailbox + `mailboxId → pushToken` mapping. No message plaintext, no profiles DB.
* **PushPort** abstracts FCM now; iOS later is another adapter.

---

## 5. Pairing protocol (draft v0)

### 5.1 Invite payload (QR + same deep link)

Encode (versioned, short-lived):

* `v` — protocol version
* `mailboxId` — inviter’s relay mailbox
* `pub` — inviter identity/public key (or key fingerprint + fetch)
* `role` — hint (`seeker` / `buddy`) optional
* `exp` — expiry
* `sig` — signature over fields

**In person:** show QR.  
**Remote:** share the **same** URL/text via system Share sheet (WhatsApp, Telegram, SMS, email). No in-app WA/TG SDK.

**Contacts:** optional picker → Share only. Address book never uploaded.

### 5.2 Deep link shapes

| Kind | Example | Needs custom domain? |
|------|---------|----------------------|
| Custom scheme | `unloop://pair?p=...` | **No** |
| HTTPS App Link | `https://<host>/pair#...` or `?p=` | Host that serves `assetlinks.json` (can be free — §7) |

Phase 3 slice 1 can ship **custom scheme + QR** only; add verified HTTPS links when host is ready.

### 5.3 Handshake

1. A creates invite → displays QR / share link.  
2. B opens/scans → shows A’s key fingerprint → confirms.  
3. B sends `pair_accept{mailboxB, pubB}` (via relay one-shot or embedded in return channel).  
4. Both store locally: buddy record, keys, roles, relay ids.  
5. Each registers `PushPort` token under its mailbox on the Worker.

Revoke = delete local buddy + relay forget token / deny mailbox.

### 5.4 Crypto (intent)

* E2EE nudge payloads for recipient pub key (library TBD: libsodium / WebCrypto-compatible).
* Relay sees ciphertext + routing ids only.
* Exact algorithms → short ADR when implementation starts.

---

## 6. App & system surfaces

### On device (single app, modes)

| Surface | Purpose |
|---------|---------|
| Settings → Buddy | Enable, warn lead time, quiet hours (as B), default nudge, max push frequency, “notify if U left” |
| Buddy list | Paired people, revoke, role |
| Pair flow | Show QR / share invite / scan / paste link |
| B compose | Pre-registered library; live record on `approaching` notification |
| U interrupt UI | Render buddy media/text nudge; fall through to challenges |
| Monitoring path | Emit `approaching` / `cancel` / threshold unchanged |

### Backend

| Piece | Role | Cost target |
|-------|------|-------------|
| Cloudflare Worker | Relay API: pair assist, mailbox put/get/cancel, trigger push | Free tier |
| Workers KV (minimal) | `mailbox → fcmToken`, short-TTL blobs | Free tier limits |
| FCM | Android push transport | Free (no per-message fee) |
| Host for HTTPS pair links | Optional `assetlinks` + landing | GitHub Pages / CF Pages (§7) |

### Deploy

* Worker deploy only with **explicit human approval** (ADR-006 / AGENTS escalation).
* No Analytics / Crashlytics / OneSignal.

---

## 7. Domain & deep links (do we need to pay?)

**Short answer:** No paid domain required for Buddy MVP.

| Approach | Free? | Notes |
|----------|-------|-------|
| `unloop://pair?...` | Yes | Enough for QR + share; no DNS |
| **GitHub Pages** (`unloopyourself.github.io`) | Yes | Can host `/.well-known/assetlinks.json` at **site root** (user/org pages). Project path `/unloop-yourself/` alone is awkward for App Links (file must be on the **host**, not only under a subpath). Privacy already on Pages. |
| **Cloudflare Pages** (`*.pages.dev`) | Yes | Same idea; easy `_headers` for `Content-Type` on `assetlinks.json`; same account as Workers later |
| Paid custom domain | Optional | Only if you want `unloop.app`-style branding / cleaner trust |

So: **Pages can be the HTTPS host** for pairing links + Digital Asset Links. Registering a domain is polish, not a blocker. Freenom-style “free TLD” is unreliable — prefer `github.io` / `pages.dev` or a cheap real domain later.

---

## 8. Suggested implementation slices (ordered)

Update statuses here as work proceeds: `todo` → `doing` → `done` / `blocked`.

| ID | Slice | Status | Notes |
|----|-------|--------|-------|
| P3-00 | ADR: NudgeProvider + PushPort + cascade; pairing v0 sketch | done | ADR-010 |
| P3-01 | Core: `NudgeProvider`, `NudgeBus` types, cascade hook | done | AiStub no-op |
| P3-02 | Local pairing UI + `unloop://` parse + buddy store (no relay yet) | done | QR + paste; system camera opens scheme |
| P3-03 | CF Worker skeleton + KV mailbox TTL | done | `unloop-relay.unloopyourself.workers.dev` |
| P3-04 | `PushPort` + FCM adapter (Android); token register | done | expo-notifications + Worker FCM v1 |
| P3-05 | `approaching` / `cancel` / mailbox put-get; B compose UI | done | Ignore / staged / live / default |
| P3-06 | Interrupt UI renders buddy nudge; fallback challenges | done | Text nudge then challenge |
| P3-07 | Settings: warn lead, quiet hours, default nudge, frequencies | done | Default Buddy off |
| P3-08 | Optional HTTPS pair links on Pages + `assetlinks.json` | done | https://unloop-pair.pages.dev (add Play certs) |
| P3-09 | Privacy policy / Play declarations for Buddy + FCM | done | docs updated; human pastes Console |
| P3-10 | Device acceptance: two Android devices paired | todo | Human |

**Explicitly deferred:** benefactor provider, real AI provider, iOS PushPort, paid domain.

---

## 9. Open questions

* Warn lead default (2 min?) vs configurable only.
* Max buddies per U; max concurrent `eventId` mailbox size.
* ~~Media caps (duration/size) for live voice.~~ → **Phase 3.5** (BACKLOG): voice ≤30s/≤1 MiB; video ≤10s/≤8 MiB (~720p, no 4K raw); photo/GIF ≤2 MiB; sound presets bundled; composed text+pic / text+GIF.
* Whether default nudge lives only on B and fires on push, or may be pre-uploaded.
* Fingerprint UX copy (how non-technical teens confirm “this is Marco”).

---

## 10. Changelog

| Date | Change |
|------|--------|
| 2026-11-25 | Initial living plan from product discussion (cascade, live warn window, pairing, domain options). |
| 2026-11-26 | Phase 3.5 media nudges approved (presets, photo/GIF+text, voice 30s, video 10s compressed). |
