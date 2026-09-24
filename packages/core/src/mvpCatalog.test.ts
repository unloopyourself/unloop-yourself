import { describe, expect, it } from "vitest";
import { SessionEngine } from "./sessionEngine.js";
import {
  CAPABILITY_PROFILES,
  MVP_CHALLENGES,
  MVP_DEFAULT_ENABLED_IDS,
  compatibilityMatrix,
  pickEligibleChallengeId,
  selectEligibleChallenges,
} from "./mvpCatalog.js";
import { selectChallenge } from "./policy.js";

describe("capability profiles × MVP catalog", () => {
  it("matrix matches requires ⊆ available for each shipping challenge", () => {
    const matrix = compatibilityMatrix();
    expect(matrix.shake).toEqual({
      low_end: false,
      no_gyro: true,
      full: true,
    });
    expect(matrix.breath_tap).toEqual({
      low_end: true,
      no_gyro: true,
      full: true,
    });
    expect(matrix.unlock_phrase).toEqual({
      low_end: true,
      no_gyro: true,
      full: true,
    });
    expect(matrix.nearest_multiple).toEqual({
      low_end: true,
      no_gyro: true,
      full: true,
    });
    expect(matrix.face_down_flip).toEqual({
      low_end: false,
      no_gyro: true,
      full: true,
    });
    expect(matrix.coin_spin).toEqual({
      low_end: false,
      no_gyro: false,
      full: true,
    });
    expect(matrix.air_write).toEqual({
      low_end: false,
      no_gyro: true,
      full: true,
    });
  });

  it("available capability → challenge is eligible", () => {
    const eligible = selectEligibleChallenges(
      MVP_CHALLENGES,
      ["shake", "breath_tap"],
      CAPABILITY_PROFILES.no_gyro,
    );
    expect(eligible.map((c) => c.id).sort()).toEqual(["breath_tap", "shake"]);
  });

  it("missing capability → challenge is not eligible (not an error)", () => {
    const eligible = selectEligibleChallenges(
      MVP_CHALLENGES,
      ["shake", "breath_tap"],
      CAPABILITY_PROFILES.low_end,
    );
    expect(eligible.map((c) => c.id)).toEqual(["breath_tap"]);
    expect(eligible.some((c) => c.id === "shake")).toBe(false);
  });

  it("Challenge Engine never selects an impossible challenge", () => {
    const chosen = selectChallenge({
      challenges: MVP_CHALLENGES.filter((c) =>
        MVP_DEFAULT_ENABLED_IDS.includes(c.id),
      ),
      deviceContext: { availableCapabilities: CAPABILITY_PROFILES.low_end },
    });
    expect(chosen).not.toBeNull();
    expect(chosen!.requires.size).toBe(0);
    expect(chosen!.id).not.toBe("shake");
  });

  it("picker falls back when only sensor challenges are enabled but sensors missing", () => {
    const id = pickEligibleChallengeId(
      MVP_CHALLENGES,
      ["shake", "face_down_flip"],
      CAPABILITY_PROFILES.low_end,
    );
    // soft catalog fallback — interruption path still exists
    expect(id).toBeTruthy();
    const challenge = MVP_CHALLENGES.find((c) => c.id === id);
    expect(challenge?.requires.size).toBe(0);
  });

  it("REGRESSION: avoids immediate repeat when ≥2 eligible", () => {
    const enabled = ["shake", "breath_tap", "unlock_phrase"];
    const available = CAPABILITY_PROFILES.no_gyro;
    const first = pickEligibleChallengeId(MVP_CHALLENGES, enabled, available, {
      random: () => 0, // always first after filter
    });
    expect(first).toBe("shake");
    const second = pickEligibleChallengeId(MVP_CHALLENGES, enabled, available, {
      excludeId: first,
      random: () => 0,
    });
    expect(second).not.toBe(first);
    expect(["breath_tap", "unlock_phrase"]).toContain(second);
  });

  it("allows repeat when only one eligible option", () => {
    const id = pickEligibleChallengeId(
      MVP_CHALLENGES,
      ["breath_tap"],
      CAPABILITY_PROFILES.low_end,
      { excludeId: "breath_tap", random: () => 0 },
    );
    expect(id).toBe("breath_tap");
  });

  it("SessionEngine excludes last interrupt challenge on the next threshold", () => {
    const clock = { nowMs: 1_000, now: () => clock.nowMs };
    const picks: string[] = [];
    const engine = new SessionEngine(
      clock,
      { cooldownMs: 1_000, challengeTimeoutMs: 45_000 },
      (enabled, available, excludeId) => {
        const id =
          pickEligibleChallengeId(MVP_CHALLENGES, enabled, available, {
            excludeId,
            random: () => 0,
          }) ?? "breath_tap";
        picks.push(id);
        return id;
      },
    );
    engine.setChallengeOptions(
      ["shake", "breath_tap"],
      CAPABILITY_PROFILES.no_gyro,
    );
    engine.startMonitoring();
    const first = engine.onThresholdReached("feed.app", 10_000);
    expect(first[0]?.type).toBe("enter_challenge");
    if (first[0]?.type === "enter_challenge") {
      expect(first[0].challengeId).toBe("shake");
    }
    engine.onChallengeCompleted();
    clock.nowMs += 2_000;
    engine.tick();
    const second = engine.onThresholdReached("feed.app", 10_000);
    expect(second[0]?.type).toBe("enter_challenge");
    if (second[0]?.type === "enter_challenge") {
      expect(second[0].challengeId).toBe("breath_tap");
    }
    expect(picks).toEqual(["shake", "breath_tap"]);
  });

  it("REGRESSION: honors a single non-shake enabled challenge", () => {
    const clock = { nowMs: 1_000, now: () => clock.nowMs };
    const engine = new SessionEngine(
      clock,
      { cooldownMs: 1_000, challengeTimeoutMs: 45_000 },
      (enabled, available, excludeId) =>
        pickEligibleChallengeId(MVP_CHALLENGES, enabled, available, {
          excludeId,
          random: () => 0,
        }) ?? "breath_tap",
    );
    engine.setChallengeOptions(
      ["breath_tap"],
      CAPABILITY_PROFILES.no_gyro,
    );
    engine.startMonitoring();
    const effects = engine.onThresholdReached("feed.app", 10_000);
    expect(effects[0]?.type).toBe("enter_challenge");
    if (effects[0]?.type === "enter_challenge") {
      expect(effects[0].challengeId).toBe("breath_tap");
      expect(effects[0].challengeId).not.toBe("shake");
    }
  });

  it("low_end profile always has a valid interruption path with defaults", () => {
    const eligible = selectEligibleChallenges(
      MVP_CHALLENGES,
      MVP_DEFAULT_ENABLED_IDS,
      CAPABILITY_PROFILES.low_end,
    );
    expect(eligible.length).toBeGreaterThan(0);
    expect(eligible.every((c) => c.requires.size === 0)).toBe(true);
  });

  it("optional hardware absence does not break SessionEngine interrupt flow", () => {
    const clock = { nowMs: 1_000, now: () => clock.nowMs };
    const engine = new SessionEngine(
      clock,
      { cooldownMs: 60_000, challengeTimeoutMs: 45_000 },
      (enabled, available) =>
        pickEligibleChallengeId(MVP_CHALLENGES, enabled, available) ??
        "breath_tap",
    );
    engine.setChallengeOptions(
      [...MVP_DEFAULT_ENABLED_IDS],
      CAPABILITY_PROFILES.low_end,
    );
    engine.startMonitoring();
    const effects = engine.onThresholdReached("feed.app", 12_000);
    expect(effects[0]?.type).toBe("enter_challenge");
    if (effects[0]?.type === "enter_challenge") {
      expect(["breath_tap", "unlock_phrase", "nearest_multiple"]).toContain(
        effects[0].challengeId,
      );
      expect(effects[0].challengeId).not.toBe("shake");
    }
    const done = engine.onChallengeCompleted();
    expect(done.some((e) => e.type === "cooldown_started")).toBe(true);
  });
});
