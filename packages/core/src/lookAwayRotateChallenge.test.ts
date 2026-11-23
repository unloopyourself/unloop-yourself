import { describe, expect, it } from "vitest";
import {
  LOOK_AWAY_MIN_RAD,
  advanceLookAwayRotateProgress,
} from "./lookAwayRotateChallenge.js";

describe("look-away yaw", () => {
  it("completes after coherent signed turn ~120°", () => {
    let rad = 0;
    // 0.8 rad/s for 3s ≈ 2.4 rad > 120° (≈2.09)
    for (let i = 0; i < 60; i += 1) {
      const p = advanceLookAwayRotateProgress(rad, {
        yawRateRadPerSec: 0.8,
        deltaMs: 50,
      });
      rad = p.accumulatedRad;
      if (p.complete) {
        expect(Math.abs(rad)).toBeCloseTo(LOOK_AWAY_MIN_RAD, 5);
        return;
      }
    }
    expect.fail("should complete");
  });

  it("oscillation cancels — wobble does not complete", () => {
    let rad = 0;
    for (let i = 0; i < 40; i += 1) {
      const sign = i % 2 === 0 ? 1 : -1;
      const p = advanceLookAwayRotateProgress(rad, {
        yawRateRadPerSec: sign * 1.2,
        deltaMs: 50,
      });
      rad = p.accumulatedRad;
    }
    expect(Math.abs(rad)).toBeLessThan(0.2);
    expect(Math.abs(rad)).toBeLessThan(LOOK_AWAY_MIN_RAD);
  });

  it("ignores tiny rates", () => {
    const p = advanceLookAwayRotateProgress(0.5, {
      yawRateRadPerSec: 0.1,
      deltaMs: 100,
    });
    expect(p.accumulatedRad).toBe(0.5);
  });
});
