# Unloop — Platform × capability compatibility

Heuristic for keeping Unloop usable on **old and cheap Android devices** without treating “Android version list” as the product model.

Canonical selection rule (Core): [`capabilities.md`](capabilities.md), ADR-003 / ADR-008.

## Two separate axes

| Axis | Meaning | Who owns it |
|------|---------|-------------|
| **Platform compatibility** | API level, permission/lifecycle/UsageStats/overlay/sensor **behavioral** boundaries | Android adapter + this doc |
| **Device capabilities** | What sensors/features are **actually available** now | Adapter probes → `DeviceContext.availableCapabilities` |
| **Challenge requirements** | `requires ⊆ availableCapabilities` | Core Challenge Engine |

Examples of combinations (all valid):

* old API + rich sensors  
* old API + poor sensors  
* new API + poor sensors  
* new API + rich sensors  

Do **not** model the matrix as Android 11 × 12 × 13 × … alone.

## Android API heuristic (not every release)

Initial version anchors (evidence-driven; update when behavior changes):

| Anchor | Role | Notes (2026) |
|--------|------|----------------|
| Minimum supported | Floor for installs | Expo app `minSdk` (project currently API 24 via Expo defaults); UsageStats + overlay used by Unloop exist at that floor |
| **Audience peak** | Most relevant mid-range for our users | Prefer testing here when picking a second API for behavioral checks |
| **Penultimate release** | Recent behavior without chasing day-0 bugs | Add when a documented behavior change lands |
| **Latest release** | Catch targetSdk / permission regressions | Smoke, not full re-matrix |

**Rule of thumb:** if an API Unloop calls exists since the minimum and has **no relevant behavioral change**, the minimum is enough coverage for that API. Add another row only for a concrete reason (permission change, background/lifecycle, UsageStats, overlay/window, sensors, targetSdk, OEM bug turned into a regression).

This is a **heuristic**, not a dogma.

## Capability profiles (test / docs — not runtime classes)

| Profile | Available capabilities | Typical device |
|---------|------------------------|----------------|
| `low_end` | ∅ | No usable accelerometer (or harness override empty) |
| `no_gyro` | `{accelerometer}` | Current AVD + most phones; no gyro-required challenges yet |
| `full` | `{accelerometer}` today | Grows when new Caps ship (e.g. gyroscope for a future rotate challenge) |

Defined in Core as `CAPABILITY_PROFILES` / `compatibilityMatrix()` — Vitest asserts the matrix.

## Shipping challenge matrix

| Challenge | Required | low_end | no_gyro | full |
|-----------|----------|---------|---------|------|
| shake | accelerometer | — | ✓ | ✓ |
| breath_tap | ∅ | ✓ | ✓ | ✓ |
| unlock_phrase | ∅ | ✓ | ✓ | ✓ |
| nearest_multiple | ∅ | ✓ | ✓ | ✓ |
| face_down_flip | accelerometer | — | ✓ | ✓ |

Missing hardware ⇒ challenge **ineligible**, not “Unloop broken.” Soft challenges (`requires = ∅`) keep an interruption path on poor devices.

## Core vs Android detection

* **Core:** `Challenge`, `Capability`, `DeviceContext`, `pickEligibleChallengeId`, profiles, matrix tests. No RN/Expo/Android imports.
* **Android adapter:** probes sensors (`ExpoSensorPort`); optional debug override via `DEBUG_START_MONITOR --es capabilities "…"`.

## AVD (L3) mapping

| Profile | How on AVD |
|---------|------------|
| `no_gyro` / `full` (today) | Default probe; accel inject via `adb emu sensor` (shake **complete** still PARTIAL — see `l3_spike_results.md`) |
| `low_end` | `--es capabilities ""` on debug start → JS sets empty `DeviceContext`; soft challenges only |

L4 (physical): OEM sensor bias, One UI quirks, human shake feel — grow the matrix from **evidence**, not from collecting every model.

## Growth rule

Add a platform row or capability column when risk is real (failed acceptance, documented OS change, new Cap on a challenge). Do not pre-expand for completeness theater.
