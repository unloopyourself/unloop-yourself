import { describe, expect, it } from "vitest";
import {
  SessionEngine,
  challengeProgressDisplayPct,
  type EngineClock,
  type EngineEffect,
} from "./sessionEngine.js";

class FakeClock implements EngineClock {
  constructor(public ms: number) {}
  now(): number {
    return this.ms;
  }
  advance(delta: number): void {
    this.ms += delta;
  }
}

function effectsOfType<T extends EngineEffect["type"]>(
  effects: EngineEffect[],
  type: T,
): Extract<EngineEffect, { type: T }>[] {
  return effects.filter((e): e is Extract<EngineEffect, { type: T }> => e.type === type);
}

const timings = { cooldownMs: 120_000, challengeTimeoutMs: 45_000 };

describe("SessionEngine scenarios (E2E-like)", () => {
  it("REGRESSION happy path: interrupt → complete → cooldown → second interrupt", () => {
    const clock = new FakeClock(1_000_000);
    const picks = ["shake", "breath_tap"];
    let i = 0;
    const engine = new SessionEngine(clock, timings, () => picks[i++] ?? "shake");
    engine.setChallengeOptions(["shake", "breath_tap"], new Set(["accelerometer"]));

    expect(engine.startMonitoring()[0]?.type).toBe("monitoring_started");
    expect(engine.state).toBe("MONITORING");

    const first = engine.onThresholdReached("com.google.android.youtube", 60_000);
    expect(effectsOfType(first, "enter_challenge")[0]?.challengeId).toBe("shake");
    expect(engine.state).toBe("CHALLENGE");

    const done = engine.onChallengeCompleted();
    expect(effectsOfType(done, "cooldown_started")[0]?.reason).toBe("completed");
    expect(engine.state).toBe("COOLDOWN");

    // Threshold during cooldown must not open another challenge.
    expect(engine.onThresholdReached("com.google.android.youtube", 60_000)).toEqual([]);
    expect(engine.state).toBe("COOLDOWN");

    clock.advance(120_000);
    expect(effectsOfType(engine.tick(), "cooldown_elapsed")).toHaveLength(1);
    expect(engine.state).toBe("MONITORING");

    const second = engine.onThresholdReached("com.openai.chatgpt", 60_000);
    expect(effectsOfType(second, "enter_challenge")[0]?.challengeId).toBe("breath_tap");
    expect(engine.state).toBe("CHALLENGE");
  });

  it("REGRESSION soft unlock: timeout releases without success (not a ban)", () => {
    const clock = new FakeClock(0);
    const engine = new SessionEngine(clock, timings);
    engine.startMonitoring();
    engine.onThresholdReached("yt", 60_000);
    expect(engine.state).toBe("CHALLENGE");

    clock.advance(44_999);
    expect(engine.tick()).toEqual([]);
    expect(engine.state).toBe("CHALLENGE");

    clock.advance(1);
    const soft = engine.tick();
    expect(effectsOfType(soft, "cooldown_started")[0]?.reason).toBe("soft_fail");
    expect(engine.state).toBe("COOLDOWN");
    expect(engine.snapshot().activeChallengeId).toBeNull();
  });

  it("REGRESSION soft unlock: Skip has same outcome as timeout", () => {
    const clock = new FakeClock(0);
    const engine = new SessionEngine(clock, timings);
    engine.startMonitoring();
    engine.onThresholdReached("yt", 60_000);
    const soft = engine.onChallengeSoftFail();
    expect(effectsOfType(soft, "cooldown_started")[0]?.reason).toBe("soft_fail");
    expect(engine.state).toBe("COOLDOWN");
  });

  it("REGRESSION Open challenge refreshes soft-unlock deadline", () => {
    const clock = new FakeClock(0);
    const engine = new SessionEngine(clock, timings);
    engine.startMonitoring();
    engine.onThresholdReached("yt", 60_000);
    clock.advance(40_000);
    engine.refreshChallengeDeadline();
    clock.advance(44_999);
    expect(engine.tick()).toEqual([]);
    expect(engine.state).toBe("CHALLENGE");
    clock.advance(1);
    const soft = engine.tick();
    expect(effectsOfType(soft, "cooldown_started")[0]?.reason).toBe("soft_fail");
  });

  it("REGRESSION hydrate outstanding after Activity death → CHALLENGE again", () => {
    const clock = new FakeClock(5_000);
    const engine = new SessionEngine(clock, timings, () => "nearest_multiple");
    engine.setChallengeOptions(["nearest_multiple"], new Set());
    // Fresh JS after kill — engine starts PAUSED but native still monitoring+outstanding.
    const effects = engine.hydrate({
      monitoring: true,
      challengeOutstanding: true,
      inCooldown: false,
    });
    expect(engine.state).toBe("CHALLENGE");
    expect(effectsOfType(effects, "enter_challenge")[0]?.challengeId).toBe(
      "nearest_multiple",
    );
  });

  it("REGRESSION hydrate while already in CHALLENGE does not re-enter", () => {
    const clock = new FakeClock(5_000);
    const engine = new SessionEngine(clock, timings, () => "breath_tap");
    engine.setChallengeOptions(["breath_tap"], new Set());
    engine.startMonitoring();
    engine.onThresholdReached("yt", 10_000);
    expect(engine.state).toBe("CHALLENGE");
    const again = engine.hydrate({
      monitoring: true,
      challengeOutstanding: true,
      inCooldown: false,
    });
    expect(again).toEqual([]);
    expect(engine.state).toBe("CHALLENGE");
  });

  it("REGRESSION hydrate cooldown keeps soft unlock out of CHALLENGE", () => {
    const clock = new FakeClock(10_000);
    const engine = new SessionEngine(clock, timings);
    engine.hydrate({
      monitoring: true,
      challengeOutstanding: false,
      inCooldown: true,
      cooldownUntilMs: 50_000,
    });
    expect(engine.state).toBe("COOLDOWN");
    expect(engine.onThresholdReached("yt", 1)).toEqual([]);
  });

  it("REGRESSION hydrate during cooldown after success does not re-emit soft_fail", () => {
    const clock = new FakeClock(0);
    const engine = new SessionEngine(clock, timings, () => "breath_tap");
    engine.setChallengeOptions(["breath_tap"], new Set());
    engine.startMonitoring();
    engine.onThresholdReached("yt", 1);
    const done = engine.onChallengeCompleted();
    expect(done[0]).toMatchObject({
      type: "cooldown_started",
      reason: "completed",
    });
    const again = engine.hydrate({
      monitoring: true,
      challengeOutstanding: false,
      inCooldown: true,
      cooldownUntilMs: engine.snapshot().cooldownUntilMs ?? 120_000,
    });
    expect(again).toEqual([]);
    expect(engine.state).toBe("COOLDOWN");
  });

  it("REGRESSION cold hydrate into cooldown uses restored, not soft_fail", () => {
    const clock = new FakeClock(10_000);
    const engine = new SessionEngine(clock, timings);
    const effects = engine.hydrate({
      monitoring: true,
      challengeOutstanding: false,
      inCooldown: true,
      cooldownUntilMs: 50_000,
    });
    expect(effects).toEqual([
      {
        type: "cooldown_started",
        reason: "restored",
        untilMs: 50_000,
      },
    ]);
  });

  it("stop clears challenge and returns to PAUSED", () => {
    const clock = new FakeClock(0);
    const engine = new SessionEngine(clock, timings);
    engine.startMonitoring();
    engine.onThresholdReached("yt", 1);
    engine.stop();
    expect(engine.state).toBe("PAUSED");
    expect(engine.snapshot().softUnlockAtMs).toBeNull();
  });
});

describe("challengeProgressDisplayPct (false 100% regression)", () => {
  it("REGRESSION: stays at most 99 until shake duration is actually done", () => {
    expect(challengeProgressDisplayPct(4_975, 5_000, false)).toBe(99);
    expect(challengeProgressDisplayPct(4_999, 5_000, false)).toBe(99);
    expect(challengeProgressDisplayPct(5_000, 5_000, false)).toBe(100);
    expect(challengeProgressDisplayPct(4_000, 5_000, true)).toBe(100);
  });
});
