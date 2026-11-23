import { describe, expect, it } from "vitest";
import {
  ROTATE_AWAY_RAD,
  advanceRotateYawProgress,
  createRotateYawState,
} from "./rotatePhoneChallenge.js";

describe("rotate phone yaw", () => {
  it("counts away then back as one cycle", () => {
    let state = createRotateYawState();
    // Turn away ~90° at 1 rad/s
    for (let i = 0; i < 40; i += 1) {
      const p = advanceRotateYawProgress(state, {
        yawRateRadPerSec: 1,
        deltaMs: 50,
        requiredCycles: 3,
      });
      state = {
        step: p.step,
        netYawRad: p.netYawRad,
        cyclesDone: p.cyclesDone,
      };
    }
    expect(state.step).toBe("back");
    expect(Math.abs(state.netYawRad)).toBeGreaterThanOrEqual(ROTATE_AWAY_RAD);

    // Turn back toward start
    for (let i = 0; i < 50; i += 1) {
      const p = advanceRotateYawProgress(state, {
        yawRateRadPerSec: -1,
        deltaMs: 50,
        requiredCycles: 3,
      });
      state = {
        step: p.step,
        netYawRad: p.netYawRad,
        cyclesDone: p.cyclesDone,
      };
      if (p.cyclesDone >= 1) {
        break;
      }
    }
    expect(state.cyclesDone).toBe(1);
    expect(state.step).toBe("away");
  });

  it("wobble without a real turn does not complete a cycle", () => {
    let state = createRotateYawState();
    for (let i = 0; i < 60; i += 1) {
      const p = advanceRotateYawProgress(state, {
        yawRateRadPerSec: i % 2 === 0 ? 0.8 : -0.8,
        deltaMs: 50,
        requiredCycles: 2,
      });
      state = {
        step: p.step,
        netYawRad: p.netYawRad,
        cyclesDone: p.cyclesDone,
      };
    }
    expect(state.cyclesDone).toBe(0);
  });
});
