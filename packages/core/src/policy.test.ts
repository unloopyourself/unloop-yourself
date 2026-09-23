import { describe, expect, it } from "vitest";
import type { Challenge, Capability } from "./challenge.js";
import { evaluatePolicy, selectChallenge } from "./policy.js";

function caps(...values: Capability[]): ReadonlySet<Capability> {
  return new Set(values);
}

describe("Policy Engine (MVP)", () => {
  it("interrupts when threshold is reached outside cooldown", () => {
    expect(
      evaluatePolicy({ inCooldown: false, thresholdReached: true }),
    ).toEqual({ action: "interrupt", reason: "threshold" });
  });

  it("ignores thresholds during cooldown", () => {
    expect(
      evaluatePolicy({ inCooldown: true, thresholdReached: true }),
    ).toEqual({ action: "cooldown_active" });
  });

  it("ignores when no threshold", () => {
    expect(
      evaluatePolicy({ inCooldown: false, thresholdReached: false }),
    ).toEqual({ action: "ignore" });
  });
});

describe("Challenge Engine (MVP)", () => {
  const shake: Challenge = { id: "shake", requires: caps("accelerometer") };
  const reflection: Challenge = { id: "reflection", requires: caps() };

  it("selects the first compatible challenge", () => {
    const chosen = selectChallenge({
      challenges: [shake, reflection],
      deviceContext: { availableCapabilities: caps() },
    });
    expect(chosen?.id).toBe("reflection");
  });

  it("returns null when nothing is compatible", () => {
    const chosen = selectChallenge({
      challenges: [shake],
      deviceContext: { availableCapabilities: caps() },
    });
    expect(chosen).toBeNull();
  });
});
