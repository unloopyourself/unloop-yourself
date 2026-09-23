# Unloop — Research and benchmarking notebook

> *"What we learned about the brain, OS APIs, and prior attempts."*

---

## 1. Neuroscience of doomscrolling and short video

### 1.1 Variable-interval reinforcement
Short-video feeds (Reels, TikTok, Shorts) use the same psychological principle as slot machines:

* **Anticipation and dopamine:** Dopamine is more about *seeking* than pleasure. Uncertainty about the next clip sustains anticipatory spikes.
* **No stopping cues:** Unlike books or long videos, short feeds remove pauses, chapters, and credits.

### 1.2 Prefrontal fatigue and motor trance
* Rapid audiovisual context switches overload the prefrontal cortex.
* Control shifts toward limbic / basal-ganglia automatic behavior.
* Compulsive scrolling often serves as emotional anesthesia (boredom, anxiety, fatigue).

---

## 2. Competitor comparison

### 2.1 One Sec
* **Approach:** Force a deep breath before opening a target app.
* **Strength:** Evidence that friction cuts impulsive opens.
* **Limit:** Acts at **app open**, not once the user is already inside a scroll trance.

### 2.2 Opal
* **Approach:** Aggressive hard locks / timers.
* **Strength:** Effective for users wanting drastic measures.
* **Limit:** Jailer effect—frustration, permission disable, uninstall.

### 2.3 ScreenZen
* **Approach:** Flexible timed unlocks and reflection pauses.
* **Strength:** Gentler customization.
* **Limit:** Complex UI; little physical or social-accountability interrupt.

---

## 3. Field insight: pattern interrupt

### 3.1 Golden rule: incompatible with scrolling
Unlock challenges must not be punitive or complex.

* **Fails:** Hard math quizzes or tedious chores (users cancel in anger).
* **Works:** 5–10 second physical or light cognitive actions **incompatible with staring still at a screen**.

### 3.2 Effective interrupt examples
* **Physical:** Shake phone (`ShakeChallenge`), look away, deep breath, sip of water.
* **Social:** Buddy signal (Hawthorne-like accountability).
* **Light cognitive:** AI Companion as a neutral mirror (later phase).

---

## 4. Mobile OS technical notes

### 4.1 Apple iOS (Screen Time APIs)
* Frameworks: `FamilyControls`, `DeviceActivity`, `ManagedSettings`.
* Mechanism: system **callbacks/events**, not free background polling.
* Cumulative daily time in target apps.
* No free system overlay; interruption via native Shield / extensions.
* Store/TestFlight needs Apple Developer program and entitlements.

### 4.2 Google Android (UsageStats and services)
* `UsageStatsManager` plus persistent services (e.g. foreground service).
* Polling or window-change monitoring.
* Custom overlays possible with explicit user permission.
* Requires Usage Access (and related) grants.

---

## 5. Discarded ideas and lessons

* **Hard unblockable lock** — high uninstall within ~48h in trials.
* **Continuous iOS background polling** — blocked by battery/privacy architecture.
* **Freemium on ethical features** — conflicts with manifesto.
* **Complex dynamic plugin framework in MVP** — over-engineering; replaced by typed `Challenge`.
