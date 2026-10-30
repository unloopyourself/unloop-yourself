# Regression use cases (repeatable)

Catalog of bugs fixed on/around **2026-09-24** and how to re-verify them. Prefer L0 when possible; L3 on AVD; L4 only for motor/OEM feel.

Run L0 always: `npm test`  
Run L3 soft (no sensors): `SOFT_ONLY=1 ./scripts/avd/run-l3-scenarios.sh`  
Run L3 full: `./scripts/avd/run-l3-scenarios.sh` (AVD already running)

## Matrix

| ID | Bug (symptom) | Fix | Layer | How to repeat |
|----|---------------|-----|-------|---------------|
| R-01 | Shake progress jumps back every ~1s | Stable `onComplete` refs in shake UI (no effect remount) | **L4** | Device: open shake, hold steady shake 5s — progress must climb monotonically |
| R-02 | Shake shows 100% then stalls | `challengeProgressDisplayPct` caps at 99 until done | **L0** | `REGRESSION: stays at most 99…` in `sessionEngine.test.ts` |
| R-03 | Always get shake despite other challenge enabled | Clear sticky `forceChallenge` on Start watching; Settings pick honored | **L0 + L3** | L0: `REGRESSION: honors a single non-shake…`; L3: `regression_sticky_force_cleared` (CLEAR → force `breath_tap`) |
| R-04 | Text strings crash (“raw text outside Text”) in Menu/About | Fix whitespace/`>` nesting; Ionicons for menu | **L3** | `regression_menu_about` — Menu → About → title/email visible |
| R-05 | Same challenge back-to-back | `excludeId` / last-interrupt variety | **L0** | `REGRESSION: avoids immediate repeat…` + SessionEngine exclude test |
| R-06 | Soft unlock feels like a ban | Soft-fail → cooldown → re-arm | **L0 + L3** | L0 soft-unlock tests; L3 `soft_fail_skip_e2e` |
| R-07 | Challenge lost after Open kills Activity | Hydrate outstanding → CHALLENGE | **L0** | `REGRESSION hydrate outstanding…` |
| R-08 | Breath / phrase / math not completable on AVD | Harness force + UI automation; math auto-complete on correct answer | **L3** | `breath_complete_e2e`, `unlock_phrase_complete_e2e`, `nearest_multiple_complete_e2e` |
| R-09 | coin_spin / air_write never selected | Opt-in in Settings; capability gate | **L0 + L4** | L0 catalog/eligibility; L4: enable in Settings, interrupt feel |
| R-10 | Sensor challenges never entered on AVD | `forceChallenge` enter asserts | **L3 (PARTIAL)** | `enter_shake` / `enter_coin_spin` / `enter_air_write` / `enter_face_down_flip` — complete stays L4 |

## L3 step names (harness)

Soft path (`SOFT_ONLY=1` skips sensor enters):

* `soft_fail_skip_e2e`
* `breath_complete_e2e`
* `unlock_phrase_complete_e2e`
* `nearest_multiple_complete_e2e`
* `regression_sticky_force_cleared`
* `regression_menu_about`

Full path also:

* `enter_{shake,coin_spin,air_write,face_down_flip}` (PARTIAL complete)
* `sensor_accel_inject`

Debug clear (sticky prefs):

```bash
adb shell am broadcast -p io.github.unloopyourself.unloop \
  -a io.github.unloopyourself.DEBUG_CLEAR_HARNESS
```

## L4 Samsung smoke (human, after L0–L3 green)

1. **R-01** Shake progress monotonic.  
2. **R-03** Enable only Unlock phrase → Start watching → interrupt is phrase (not shake).  
3. **R-09** Enable coin_spin + air_write → get variety / no immediate repeat.  
4. **R-10** Feel of shake / face-down / coin / air-write once each.

## Soft-fail abort guard

`open_challenge` aborts early only when **Grace period** is visible. Do **not** treat `Stop watching` as failure — that is normal monitoring home.

## Rule

Bug found → add a row here + a `REGRESSION` L0 test and/or harness step. Never delete REGRESSION coverage when fixing.
