import { describe, expect, it } from "vitest";
import { advanceHoldStillProgress } from "./holdStillChallenge.js";

describe("hold still", () => {
  it("completes after sustained stillness", () => {
    let held = 0;
    for (let i = 0; i < 60; i++) {
      const p = advanceHoldStillProgress(held, {
        deviation: 0.02,
        jerk: 0.01,
        deltaMs: 100,
        requiredMs: 5_000,
      });
      held = p.heldMs;
      if (p.complete) {
        expect(i).toBeGreaterThanOrEqual(49);
        return;
      }
    }
    expect.fail("should complete");
  });

  it("resets on motion", () => {
    const mid = advanceHoldStillProgress(1200, {
      deviation: 0.02,
      jerk: 0.01,
      deltaMs: 100,
    });
    expect(mid.heldMs).toBeGreaterThan(1200);
    const reset = advanceHoldStillProgress(mid.heldMs, {
      deviation: 0.5,
      jerk: 0.4,
      deltaMs: 100,
    });
    expect(reset.heldMs).toBe(0);
    expect(reset.complete).toBe(false);
  });

  it("gyro assist resets on micro-rotation even when accel looks still", () => {
    const mid = advanceHoldStillProgress(2000, {
      deviation: 0.02,
      jerk: 0.01,
      deltaMs: 100,
      gyroRate: 0.05,
    });
    expect(mid.heldMs).toBeGreaterThan(2000);
    const spun = advanceHoldStillProgress(mid.heldMs, {
      deviation: 0.02,
      jerk: 0.01,
      deltaMs: 100,
      gyroRate: 1.2,
    });
    expect(spun.heldMs).toBe(0);
  });
});
