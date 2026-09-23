# Unloop — Consolidated project overview

English supersession of the former Italian consolidated vision document. Prefer the focused docs for day-to-day work; this file is a single-page map.

## Problem and goal

Enemy is not the phone or any single app—it is **autopilot doomscrolling**. Unloop provides a 5–15 second interrupt so the lucid self (who asked for help) can interrupt the automatic self. UX message: *“I’m interrupting you because you asked me to.”*—not guilt or “time’s up.”

## Challenge philosophy

Challenges must be **incompatible with scrolling**, short (about 5–10s), not punitive. Examples: shake, breath, look away, sip water, light visual/question prompts. Later: Buddy accountability and AI Companion mirror. Autopilot Score (later) tracks autopilot episodes and positive responses—not vanity screen-time alone.

## Technology (accepted ADRs)

* React Native + Expo + TypeScript
* Stateless relay later (Cloudflare Workers) for Buddy—zero personal data store
* Hexagonal Core; Android/iOS usage detection behind adapters
* Minimal Challenge strategy classes in MVP (no plugin marketplace)

## OS constraints

* **iOS:** Screen Time APIs; Shield; paid Apple program for store/TestFlight
* **Android:** UsageStats / services; freer overlays; APK sideload possible

## MVP strategy

**Android-first:** detect short-video threshold → interrupt → local challenge (e.g. Shake) → unlock.

## Ethics and distribution

100% open source, non-profit, privacy-first, no ads. Crowdfunding only for living costs (e.g. Apple fee, domains). Grassroots education kits for speakers and parents later.

See [manifesto.md](manifesto.md), [architecture.md](architecture.md), [roadmap.md](roadmap.md), [decisions.md](decisions.md).
