# Unloop — Challenges and capabilities (appendix)

English supersession of the former Italian appendix on Challenge/Capability abstraction.

## Capability declaration

Every Challenge explicitly declares required capabilities, for example:

* `ShakeChallenge` → accelerometer
* `WalkChallenge` → pedometer
* Buddy media challenges → Buddy available, notifications, media support
* `ReflectionChallenge` → may require none

## DeviceContext vs platform

Each host exposes a DeviceContext with **actually available** capabilities. Platform presence ≠ availability:

* Android has an accelerometer, but permission may be denied.
* Microphone challenges must not run without permission.
* Buddy challenges must not run if no Buddy is configured.

## Selection rule

The Challenge Engine must not know platform details. Compatibility:

```text
challenge.requires ⊆ deviceContext.availableCapabilities
```

Incompatible challenges are excluded before execution.

## Extensibility

New challenges declare requirements + logic only. New hosts implement DeviceContext. Core reasons in domain terms: Challenge, Capability, DeviceContext, Policy, Session, Buddy—not Expo or OS brand names. Adapters own framework and OS details.

Canonical architecture overview: [architecture.md](architecture.md).
