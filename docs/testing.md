# Testing strategy — agent autonomy first

Unloop prioritizes **deterministic, local verification** the coding agent can run without a human and without SaaS. The physical Samsung is an **acceptance/batch gate (L4)**, not the daily lab.

Empirical AVD spike (2026-09-24, AVD `unloop_api34` API 34 playstore): see [`l3_spike_results.md`](l3_spike_results.md) and `factory/l3-reports/`.

## Layers

| Layer | What | Who | When |
|-------|------|-----|------|
| **L0 — Core scenarios** | Vitest `SessionEngine` (+ shake math, policy, FSM). Clock-injected interrupt loop. | Agent always | Every Core / interrupt change |
| **L1 — Boundaries** | `scripts/check-boundaries.sh` | Agent | Deps / privacy / Core isolation |
| **L2 — Mobile typecheck** | `apps/mobile` `tsc` | Agent | UI / settings / challenges |
| **L3 — AVD Android scenarios** | Real APKs on emulator: Dummy Feed + Unloop, `adb` permissions, UsageStats→threshold→overlay, Open challenge, sensor inject, debug harness | Agent (emulator must be **already running**) | After Android/native/interrupt changes |
| **L4 — Physical device** | OEM battery, real YouTube/TikTok, human shake/face-down feel, Play Protect quirks | Human batch | When L0–L3 green and STATUS asks |

## What L3 empirically can do (verified)

| Use case | AVD result | How |
|----------|------------|-----|
| Install / launch APKs | **PASS** | `adb install` |
| Grant Usage Access | **PASS** | `appops set … GET_USAGE_STATS allow` |
| Grant overlay | **PASS** | `appops set … SYSTEM_ALERT_WINDOW allow` |
| Controlled target app | **PASS** | `apps/dummy-target` (`dev.unloopyourself.dummytarget`) |
| UsageStats sees dummy FG | **PASS** | `dumpsys usagestats` |
| Start monitor without UI | **PASS** | `DebugHarnessReceiver` broadcast `DEBUG_START_MONITOR` (**`-p` package required**) |
| Threshold → native interrupt overlay | **PASS** | logcat `THRESHOLD reached` + `interrupt overlay shown` |
| Open challenge → Unloop Activity | **PASS** | `uiautomator` tap “Open challenge” |
| Accel get/set | **PASS** | `adb emu sensor set/get acceleration` |
| Force-stop / relaunch Activity | **PASS** | `am force-stop` + `am start` |
| Soft-fail Skip E2E | **PASS** | `harness: cooldown_soft_fail` after Skip (`forceChallenge` + embedded JS) |
| Challenge complete E2E | **PASS** | `breath_tap` 3× tap → `harness: cooldown_completed` |
| Shake complete via emu sensor | **PARTIAL** | UI + `adb emu sensor` OK; expo-sensors on AVD does not finish — L0 + L4 |
| FGS survives `force-stop` | **N/A (by OS)** | `force-stop` kills FGS — expected; re-arm via harness |
| L3 without Metro | **PASS** | Debug APK embeds JS (`debuggableVariants = []`) |

## What stays L4 (irreducibly physical / OEM)

* Real short-video apps (YouTube PiP, OEM audio focus quirks) as day-to-day targets  
* Human motor validation of shake / face-down flip “feel” and OEM sensor bias  
* Battery / background kill policies that differ from the emulator  
* Play Protect / store install path  

Do **not** assume UsageStats, overlay, or sensors are weak on AVD — the spike showed they work. Remaining L3 gap is **shake complete via injected accel** (sensor→expo bridge), not the interrupt path itself.

## SessionEngine (L0)

`packages/core` `SessionEngine`: start → threshold → challenge → complete **or** soft-fail → cooldown → re-arm; hydrate after death; injectable clock. Regression tests named `REGRESSION …`.

```bash
npm test
```

## L3 harness

```bash
# Human or agent: start AVD once (agent headless start was flaky on this Mac)
$ANDROID_HOME/emulator/emulator -avd unloop_api34 -gpu auto

# Then agent:
./scripts/avd/run-l3-scenarios.sh
```

Debug intents (package-targeted):

```bash
adb -s emulator-5554 shell am broadcast -p dev.unloopyourself.app \
  -a dev.unloopyourself.DEBUG_START_MONITOR \
  --es packages "dev.unloopyourself.dummytarget" --el thresholdMs 10000 \
  --es forceChallenge "breath_tap"
```

## Growing the regression basket

1. Bug found → preferably a failing **L0** `REGRESSION` test.  
2. If Android-specific → add/extend `scripts/avd/run-l3-scenarios.sh` step + keep report under `factory/l3-reports/`.  
3. Never delete REGRESSION coverage when fixing.

## Philosophy

Automate everything the machine can realistically verify; keep only irreducibly physical checks for the human. When L0+L1+L2+L3 are green, **stop and ask** for an L4 Samsung batch — do not use the phone as the daily laboratory.
