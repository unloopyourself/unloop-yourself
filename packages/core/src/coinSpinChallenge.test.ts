import { describe, expect, it } from "vitest";
import { advanceCoinSpinProgress } from "./coinSpinChallenge.js";

describe("CoinSpinChallenge progress", () => {
  it("completes after ~5 turns of sustained yaw", () => {
    let rad = 0;
    let complete = false;
    // 5 turns ≈ 31.4 rad at 2 rad/s → ~15.7s
    for (let i = 0; i < 200 && !complete; i++) {
      const p = advanceCoinSpinProgress(rad, {
        yawRateRadPerSec: 2,
        deltaMs: 100,
        requiredTurns: 5,
      });
      rad = p.accumulatedRad;
      complete = p.complete;
    }
    expect(complete).toBe(true);
    expect(rad / (Math.PI * 2)).toBeGreaterThanOrEqual(5);
  });

  it("ignores noise below min rate", () => {
    const p = advanceCoinSpinProgress(1, {
      yawRateRadPerSec: 0.1,
      deltaMs: 500,
    });
    expect(p.accumulatedRad).toBe(1);
    expect(p.complete).toBe(false);
  });
});
