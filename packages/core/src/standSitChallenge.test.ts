import { describe, expect, it } from "vitest";
import {
  advanceStandSitFromSample,
  advanceStandSitProgress,
  createStandSitState,
} from "./standSitChallenge.js";

describe("stand/sit bursts", () => {
  it("counts a burst after sustained motion then calm", () => {
    let state = createStandSitState();
    for (let i = 0; i < 6; i += 1) {
      const p = advanceStandSitProgress(state, {
        motion: 0.4,
        deltaMs: 50,
      });
      state = {
        bursts: p.bursts,
        movingMs: p.movingMs,
        calmMs: p.calmMs,
        gravity: p.gravity,
        lastVerticalSign: p.lastVerticalSign,
      };
    }
    expect(state.bursts).toBe(0);
    const afterCalm = advanceStandSitProgress(state, {
      motion: 0.01,
      deltaMs: 50,
    });
    expect(afterCalm.bursts).toBe(1);
  });

  it("ignores brief jitter without enough calm between bursts", () => {
    const base = createStandSitState();
    const state = {
      ...base,
      bursts: 1,
      movingMs: 0,
      calmMs: 100,
    };
    const p = advanceStandSitProgress(state, {
      motion: 0.5,
      deltaMs: 50,
      minCalmMs: 280,
    });
    expect(p.movingMs).toBe(0);
    expect(p.calmMs).toBe(0);
  });

  it("vertical path counts a stand-like burst from world-up accel", () => {
    let state = createStandSitState();
    // Prime gravity as +Z (phone face-up at rest).
    for (let i = 0; i < 8; i += 1) {
      const p = advanceStandSitFromSample(state, {
        ax: 0,
        ay: 0,
        az: 1,
        deltaMs: 50,
        useVertical: true,
      });
      state = {
        bursts: p.bursts,
        movingMs: p.movingMs,
        calmMs: p.calmMs,
        gravity: p.gravity,
        lastVerticalSign: p.lastVerticalSign,
      };
    }
    // Short upward surge (before gravity low-pass fully catches the step).
    for (let i = 0; i < 5; i += 1) {
      const p = advanceStandSitFromSample(state, {
        ax: 0,
        ay: 0,
        az: 2.0,
        deltaMs: 50,
        useVertical: true,
      });
      state = {
        bursts: p.bursts,
        movingMs: p.movingMs,
        calmMs: p.calmMs,
        gravity: p.gravity,
        lastVerticalSign: p.lastVerticalSign,
      };
    }
    expect(state.movingMs).toBeGreaterThanOrEqual(180);
    // Settle with explicit zero motion (gravity may still be catching up).
    const afterCalm = advanceStandSitProgress(state, {
      motion: 0,
      deltaMs: 50,
      mode: "vertical",
      minBurstMs: 180,
    });
    expect(afterCalm.bursts).toBeGreaterThanOrEqual(1);
  });

  it("gyro assist ignores spin-only motion without vertical accel", () => {
    let state = createStandSitState();
    for (let i = 0; i < 6; i += 1) {
      const p = advanceStandSitFromSample(state, {
        ax: 0,
        ay: 0,
        az: 1,
        deltaMs: 50,
        useVertical: true,
        useGyroAssist: true,
        gyroRate: 0,
      });
      state = {
        bursts: p.bursts,
        movingMs: p.movingMs,
        calmMs: p.calmMs,
        gravity: p.gravity,
        lastVerticalSign: p.lastVerticalSign,
      };
    }
    for (let i = 0; i < 10; i += 1) {
      const p = advanceStandSitFromSample(state, {
        ax: 0,
        ay: 0,
        az: 1.02,
        deltaMs: 50,
        useVertical: true,
        useGyroAssist: true,
        gyroRate: 3.5,
      });
      state = {
        bursts: p.bursts,
        movingMs: p.movingMs,
        calmMs: p.calmMs,
        gravity: p.gravity,
        lastVerticalSign: p.lastVerticalSign,
      };
    }
    expect(state.bursts).toBe(0);
    expect(state.movingMs).toBe(0);
  });
});
