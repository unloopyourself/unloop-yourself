import { describe, expect, it } from "vitest";
import { advanceShakeProgress, shakeChallenge } from "./shakeChallenge.js";

describe("ShakeChallenge", () => {
  it("declares accelerometer capability", () => {
    expect(shakeChallenge.requires.has("accelerometer")).toBe(true);
  });

  it("completes after sustained motion totaling required duration", () => {
    let active = 0;
    for (let i = 0; i < 10; i++) {
      const progress = advanceShakeProgress(active, {
        magnitude: 2,
        deltaMs: 500,
        requiredMs: 5_000,
      });
      active = progress.activeMs;
      if (i < 9) {
        expect(progress.complete).toBe(false);
      } else {
        expect(progress.complete).toBe(true);
      }
    }
  });

  it("does not advance when below magnitude threshold", () => {
    const progress = advanceShakeProgress(1000, {
      magnitude: 0.2,
      deltaMs: 500,
    });
    expect(progress.activeMs).toBe(1000);
    expect(progress.complete).toBe(false);
  });
});
