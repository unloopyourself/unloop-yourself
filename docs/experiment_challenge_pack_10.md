# Experiment: exit-oriented challenge pack ×10

Branch: `experiment/challenge-pack-10`

**Design rule:** every challenge must pull attention *out of the scroll loop* (body, breath, intention, look-away, deliberate friction). Mini-games that reward staying on-screen (Simon, rhythm, odd-one-out, Stroop, beep-counting) are **out of scope** for this pack.

Opt-in in Settings. Defaults unchanged.

`audio_silence_tap` plays a short tone via a **thin Android adapter** (`ToneGenerator` in `unloop-usage`) — not `expo-av` (that crashed with JSI `UnsatisfiedLinkError`). Visual bar stays as fallback if tone start fails.

Reviewer notes: product rule (exit-the-loop) overruled gamey picks from engagement review.

## Shipping set (this branch)

| Id | Kind | Exit mechanism |
|----|------|----------------|
| `hold_still` | body / sensors | ~5s real stillness (accelerometer) |
| `countdown_type` | attention | Match chips; enter unit high (.55–.95); miss/wait stays in-unit; wrong tap moves correct off that button |
| `long_press` | body + sensors | Hold + ~3 in-place turns (gyro) |
| `intention_type` | deliberation | Free-text “what will you do instead” (not copy-phrase) |
| `look_away` | body + gyro | Point phone behind you (≥120° yaw) |
| `rotate_phone` | body | Reorient away+back a random 3–7 times |
| `stand_up` | body / accel only | Stand↔sit motion ×3 (accelerometer |g| deltas; no gyro) |
| `sip_water` | body + notice | Sip, then temp / gas / taste chips |
| `feeling_check` | deliberation | Name feeling + soft tip if heavy |
| `audio_silence_tap` | presence (+ tone) | Longer ToneGenerator beep, then tap in quiet |

Removed from earlier draft as too “in-the-loop”: `odd_color`, `rhythm_tap`, `memory_seq`, `stroop_tap`, `word_unscramble`, `audio_beep_count`.

## Success cases & inspiration (web + our research.md)

### Strong evidence / products

| Source | What works | Relation to Unloop | IP / reuse |
|--------|------------|--------------------|------------|
| **[one sec](https://one-sec.app/)** + [PNAS 2023](https://www.pnas.org/doi/10.1073/pnas.2213114120) | Pre-open friction: breath, short wait, deliberation, **easy dismiss**; ~57% fewer target-app opens over 6 weeks | Closest product cousin; Unloop is **mid-scroll** interrupt, not only pre-open | **Commercial product.** Do **not** copy branding, artwork, or trademarked interruption names. Mechanisms (breath, friction, intention, dismiss) are general behavioral design — OK to reinvent in our own UX. Contact if we ever want parity with a *named* one sec interruption (e.g. their “Follow the Dot”, mirror). |
| **ScreenZen** | Growing wait, open limits, reflection | Same category (pause > jail) | Product UX — inspire categories, don’t clone screens. |
| **Opal / AppBlock / Freedom** | Hard blocks & schedules | Effective for some; Unloop manifesto rejects jailer default | N/A as challenge templates. |
| **InteractOut** (UMich news / research) | Progressive touch delay / scroll friction after a limit | Mid-session friction idea | Academic research app — do not lift implementation; cite idea only. |
| Unloop `docs/research.md` | Shake, breath, look away, sip water | Already aligned | Ours. |

### Patterns that repeatedly show up (safe to use as *patterns*, not clones)

1. **Breath / stillness** — break motor trance.  
2. **Short friction delay** — time to re-enter prefrontal control.  
3. **Intention / feeling check** — one conscious choice.  
4. **Physical reorientation** — shake, flip, rotate, stand.  
5. **Eyes off glass** — look away / look out.  
6. **Explicit leave vs continue** — easy exit (one sec’s strongest lever).

### If we want closer parity later

Ask permission / partner for anything that is clearly product-specific:

- one sec branded breathing visuals or named mini-tasks  
- ScreenZen’s exact progressive-wait curves / lock UX  
- Any third-party art, copy decks, or trademarked names  

Contact for Unloop: `unloopyourself.dev@gmail.com`.
