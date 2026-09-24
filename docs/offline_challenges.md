# Offline challenge candidates (post–Shake)

> Design note — not scheduled as a single backlog item yet. Evolves with product feedback.

**Constraints:** ~5–15s; incompatible with continuous thumb-scroll; irony over shame; `requires ⊆ availableCapabilities`; **local-first** (no network unless the user explicitly opted into an online pack); all user-visible strings **localizable** (see below).

**Shipping today:** Shake, breath/phrase/math, face-down flip; **coin spin** (gyro, opt-in); **air write** (accel, opt-in).

**Settings (required when the pack ships):** a **Challenges** section listing each challenge with an on/off control. The Challenge Engine only selects from **enabled ∩ compatible**. At least one enabled challenge must remain (or fall back to Shake if sensors allow). Defaults: Shake on; others opt-in or a small curated default set.

---

## Selection principles

1. Different motor/cognitive channel than scrolling.
2. Fail soft — retry in place; never guilt copy.
3. Capability-honest exclusion.
4. Rotate among enabled+compatible to reduce habituation.
5. **Do not invent a second dopamine loop** — see [Habituation risk](#habituation-risk).
6. **Soft unlock** — timeout (or skip) always releases the feed; see architecture “Soft unlock”. Never require success to use other apps again.

---

## Shortlist (revised)

### 1. Face-down flip (`face_down_flip`)
* **Beat:**
  1. Place the phone **face down**.
  2. Hold ~**3s** (stable face-down).
  3. Flip face-up; the flip must complete inside a **±0.5s** timing window after the hold (tight enough to demand attention, loose enough for real hands).
* **Why it breaks scroll:** Removes the feed, then a timed motor act.
* **Requires:** `accelerometer` (gravity / orientation)
* **Build cost:** Medium (state machine + timing tolerance).
* **Copy cue:** “Face down… hold… flip now.”

### 2. Coin spin (`coin_spin`)
* **English name:** **Coin spin** (“moneta” → *coin*).
* **Beat:** Rest the phone on a **coin** (or similar pivot). With two fingers near the center of mass, rotate the phone **5 full turns**.
* **Why it breaks scroll:** Whole-device manipulation; absurd enough to break trance.
* **Requires:** `accelerometer` + `gyroscope` (yaw integration); declare `gyroscope` as a new Capability when implemented.
* **Build cost:** Medium–high (drift, false turns, “no coin” soft fail messaging).
* **Risk:** Needs a physical coin; explain in copy. Emulator-hostile.

### 3. Air write (`air_write`)
* **English name:** **Air write** (working title; alt: *Sky scribble*).
* **Beat:** “Write” a **short** challenge word in the air by moving the phone (e.g. `HI` / locale-equivalent greeting). Recognize a coarse stroke sequence, not calligraphy.
* **Why it breaks scroll:** Large motor pattern ≠ thumb fling.
* **Requires:** `accelerometer` (+ optional `gyroscope`)
* **Build cost:** High (gesture ML or simplified stroke templates). Start with **2–4 letter** templates only.
* **Risk:** Recognition frustration — generous matching; show the target word clearly.

### 4. Synonyms (`synonyms`)
* **Beat:** Given a prompt word, type **3 synonyms** (or near-synonyms).
* **Why it breaks scroll:** Light language cognition.
* **Requires:** ∅ for UI; **data:** prefer an **on-device vocabulary pack** per locale. A network dictionary API is **opt-in only** and conflicts with default local-first — park online mode unless privacy ADR allows it.
* **Build cost:** Medium (pack + fuzzy accept list).
* **Risk:** Native speakers vs learners; keep prompts easy; accept morphological variants.

### 5. Nearest multiple (`nearest_multiple`)
* **Beat:** One prompt in the spirit of: *“What is the multiple of 7 nearest to 45?”* → **42** (or similar: nearest square, nearest even, etc.). Pool of templates, not one fixed riddle.
* **Why it breaks scroll:** Brief working-memory interrupt without exam stress.
* **Requires:** ∅
* **Build cost:** Low
* **Difficulty bar:** Solvable in a few seconds by most adults; no multi-step algebra; show numeric keypad.

---

## Still useful from earlier draft

| Id | Role |
|----|------|
| `shake` | Default physical interrupt (shipping) |
| `breath_tap` | Soft, no sensors — good default opt-in |
| `unlock_phrase` | Keyboard interrupt — good default opt-in |
| `stillness` | Inverse shake — optional |

---

## Habituation risk

**Yes — challenges can themselves become a mini-game habit** if we add streaks, scores, social proof, or “fun enough to open Unloop for the challenge.”

Mitigations aligned with the manifesto:

* No leaderboards, XP, or public streaks for challenges.
* Keep duration short; success = unlock + disappear, not celebration spam.
* User **disables** challenges they start to enjoy-for-their-own-sake (Settings → Challenges).
* Lightweight **local** feedback (👍/👎 or heart) adjusts selection weights only on-device — see parking lot — never a feed of ratings.
* Prefer variety + cooldown over “one addictive perfect challenge.”

The interrupt should stay a **speed bump**, not a destination.

---

## Localization (product requirement)

**Everything user-visible must be localizable** — shield copy, challenge prompts, settings labels, notifications, errors. This was underspecified in early MVP docs; treat it as standing policy:

* English source strings in code/docs; locale packs (e.g. `en`, `it`) for UI.
* Challenge **content** (synonym prompts, air-write words, math templates) ships per locale, not translated naïvely from English idioms where wrong.
* System language as default; optional override in Settings later.
* No hardcoded Italian/English in native overlays without going through the same string table.

Implementation vehicle (when scheduled): i18n library + string catalogs in `apps/mobile`; native overlay strings fed from JS or mirrored catalogs.

---

## Suggested build order (when scheduled)

1. Settings → Challenges enable-list + Engine filter — **done**
2. `nearest_multiple` + `unlock_phrase` / `breath_tap` (no sensors) — **done**
3. `face_down_flip` — **done**
4. i18n pass for all UI + challenge packs — **done**
5. Selection variety (random among eligible, **no immediate repeat** when ≥2) — backlog **P1.5-10**
6. `coin_spin` — **done** (P1.5-11)
7. `air_write` — **done** (P1.5-12)
8. `synonyms` (local pack) — deferred / low priority

---

## Out of scope here

* Buddy / always-on network  
* Challenge marketplace  
* Server-side synonym APIs as default  
* **Audio / mic / camera challenges** as defaults — only with **explicit user opt-in** (listening is not always socially/contextually OK)  


See also: [`ideas_parking_lot.md`](ideas_parking_lot.md), [`capabilities.md`](capabilities.md).
