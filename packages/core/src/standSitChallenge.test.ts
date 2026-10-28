import { describe, expect, it } from "vitest";
import {
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
    let state = {
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
});
