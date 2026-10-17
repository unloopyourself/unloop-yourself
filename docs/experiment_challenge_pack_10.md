# Experiment: exit-oriented challenge pack ×10

Branch: `experiment/challenge-pack-10`

**Design rule:** every challenge must pull attention *out of the scroll loop* (body, breath, intention, look-away, deliberate friction). Mini-games that reward staying on-screen (Simon, rhythm, odd-one-out, Stroop, beep-counting) are **out of scope** for this pack.

Opt-in in Settings. Defaults unchanged. Audio challenges ask consent **when enabled in Settings** (not mid-interrupt); enabling = permission to play short on-device sounds.

Reviewer notes: [Reviewer A](8a0e04bf-6fe7-4ca5-bbfd-374221c8ea88) preferred soft mini-games + Settings audio opt-in; [Reviewer B](7964cbf6-113c-4c64-ad4a-0ed668c7c309) kept several gamey interrupts. Product rule (exit-the-loop) overruled gamey picks; A’s Settings-time audio consent was adopted.

## Shipping set (this branch)

| Id | Kind | Exit mechanism |
|----|------|----------------|
| `hold_still` | body / sensors | Anti-twitch stillness |
| `countdown_type` | thumbs off feed | Short intentional typing |
| `long_press` | friction | Deliberate hold, not a swipe |
| `intention_type` | deliberation | Type why you are here / choosing pause |
| `look_away` | eyes off glass | Forced wait, then tap when back |
| `rotate_phone` | body | Reorient device (incompatible with scroll) |
| `stand_up` | body (honor) | Stand, then confirm |
| `sip_water` | body (honor) | Sip, then confirm |
| `feeling_check` | deliberation | Name the feeling, then leave |
| `audio_silence_tap` | audio + presence | Wait for silence (consent); not a score game |

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
