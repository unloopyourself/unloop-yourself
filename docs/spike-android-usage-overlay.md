# Spike: Android UsageStats + overlay via Expo Modules (P1-01)

**Date:** 2026-09-23  
**Status:** Feasible (with constraints). No paid infra required for local debug APK.  
**Device demo:** Deferred to P1-02/P1-04 once `apps/mobile` exists; this note freezes the intended path.

## Goal

Prove a path where Unloop can:

1. Observe cumulative (or incremental) usage of a target short-video app.
2. Surface an interrupt UI above that app (or equivalent shield).
3. Feed a threshold event into Core’s `UsageDetectorPort` → Session FSM.

Without leaking domain logic into native code beyond a thin adapter.

## Recommended path

### Expo Modules (custom native module)

Use a **local Expo Module** (config plugin + Kotlin) rather than `Platform.OS` branches in Core.

| Concern | Android API | Notes |
|--------|-------------|--------|
| Usage | `UsageStatsManager` + `PACKAGE_USAGE_STATS` (Usage Access) | User must grant in system settings; app cannot silently enable it. |
| Background continuity | Foreground Service (FGS) with appropriate type (e.g. `specialUse` / monitoring—verify current Play policy when store-bound) | OEM battery savers may still kill; MVP acceptance: “survives app switch” on a test device. |
| Overlay | `SYSTEM_ALERT_WINDOW` (“Display over other apps”) + `WindowManager` overlay, **or** full-screen activity brought to front | Overlay is freer than iOS; some OEMs restrict overlays. Fallback: launch Unloop interrupt Activity with high priority. |
| Sensors (shake) | `SensorManager` accelerometer via Expo Sensors **or** same module | Prefer existing Expo Sensors for ShakeChallenge if permission model is simpler; keep behind `SensorPort`. |

TypeScript side implements `UsageDetectorPort` by calling the module; Core stays pure.

### Why not Accessibility-only?

Accessibility can detect window changes but is heavier ethically/UX-wise and easier to misuse. Prefer Usage Access for time thresholds; reserve Accessibility only if UsageStats proves insufficient later (would be an ADR).

## Permission UX (product-safe)

Onboarding must explain, in manifesto tone:

* Usage Access: “so I can notice when the apps you chose go into autopilot—not to upload what you watch.”
* Overlay (if used): “so I can interrupt on top of the feed for a few seconds—you asked for this.”

No analytics. No network for these signals.

## Feasibility verdict

| Item | Verdict |
|------|---------|
| Local free development | **OK** — Android SDK + Expo; sideload APK |
| Expo Module for UsageStats + FGS | **Feasible** — standard Kotlin Expo Module |
| Overlay interrupt | **Feasible** with user grant; have Activity fallback |
| Exact OEM reliability | **Risk** — document per-device in P1-08 |
| Play Store FGS policy | **Later** — sideload MVP first (ADR Android-first) |

**Blockers found:** none that stop P1-02. Escalate only if Expo Module cannot access `UsageStatsManager` under the chosen Expo SDK (unlikely) or if we decide overlay is unacceptable UX (product call).

## Implementation sequence (next backlog items)

1. **P1-02** — Scaffold `apps/mobile` (Expo TS) depending on `@unloop/core`.
2. **P1-03** — Wire `StoragePort` + ΔU baselines.
3. **P1-04** — Implement `AndroidUsageDetector` Expo Module → emit threshold into FSM.
4. **P1-05/06** — Shake + shield UI.
5. **P1-08** — Human acceptance on physical Android.

## References

* Android: [`UsageStatsManager`](https://developer.android.com/reference/android/app/usage/UsageStatsManager)
* Expo: [Expo Modules API](https://docs.expo.dev/modules/overview/)
* Project ports: `packages/core/src/ports.ts`
