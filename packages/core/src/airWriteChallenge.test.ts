import { describe, expect, it } from "vitest";
import {
  AIR_COVERAGE_THRESHOLD,
  AIR_LETTER_CORRIDORS,
  AIR_WRITE_WORDS,
  advanceAirWriteTracker,
  createAirWriteTracker,
  detectSmallCircle,
  findTrailingCircleStart,
  letterTemplate,
  makeCirclePath,
  normalizePath,
  pickAirWriteWord,
  pointInCorridor,
  sampleCorridorCenterline,
  scriptCompleteAirWriteWord,
  strokeCoverage,
  tiltDeltaToPlane,
  circleProgress,
  AIR_SETTLE_MS,
  type AirPoint,
  type AirWriteTrackerState,
} from "./airWriteChallenge.js";

function drainCool(state: AirWriteTrackerState) {
  let s = state;
  while (s.delimCoolMs > 0) {
    s = advanceAirWriteTracker(s, {
      ax: 0,
      ay: 0,
      az: 1,
      deltaMs: 100,
    });
  }
  return s;
}

function feedPlane(state: AirWriteTrackerState, points: readonly AirPoint[]) {
  let s = state;
  for (const p of points) {
    s = advanceAirWriteTracker(s, {
      ax: 0,
      ay: 0,
      az: 1,
      deltaMs: 50,
      sampleEveryMs: 1,
      plane: p,
    });
  }
  return s;
}

/** Inject a circoletto as plane samples (tilt cursor space). */
function circleBurst(state: AirWriteTrackerState, radius = 0.35) {
  let s = drainCool(state);
  s = advanceAirWriteTracker(s, { ax: 0, ay: 0, az: 1, deltaMs: 20 });
  return feedPlane(s, makeCirclePath(0, 0, radius, 16));
}

function drawAlong(state: AirWriteTrackerState, path: readonly AirPoint[]) {
  expect(state.phase).toBe("drawing");
  return feedPlane(
    { ...state, delimCoolMs: 0, path: [], sampleAccumMs: 0 },
    path,
  );
}

describe("air write corridor geometry", () => {
  it("keeps centerline samples inside their corridor", () => {
    for (const [letter, tmpl] of Object.entries(AIR_LETTER_CORRIDORS)) {
      for (const [i, stroke] of tmpl.strokes.entries()) {
        const samples = sampleCorridorCenterline(stroke);
        const coverage = strokeCoverage(samples, stroke);
        expect(coverage, `${letter} stroke ${i}`).toBeGreaterThanOrEqual(
          AIR_COVERAGE_THRESHOLD,
        );
      }
    }
  });

  it("rejects a path far from the corridor", () => {
    const i = letterTemplate("I")!.strokes[0]!;
    const horizontal: AirPoint[] = [];
    for (let t = 0; t <= 20; t++) {
      horizontal.push({ x: 0.1 + (0.8 * t) / 20, y: 0.5 });
    }
    expect(strokeCoverage(horizontal, i)).toBeLessThan(AIR_COVERAGE_THRESHOLD);
  });

  it("pointInCorridor respects halfWidth", () => {
    const c = letterTemplate("I")!.strokes[0]!;
    expect(pointInCorridor({ x: 0.5, y: 0.5 }, c)).toBe(true);
    expect(pointInCorridor({ x: 0.95, y: 0.5 }, c)).toBe(false);
  });

  it("normalizePath centers and preserves shape", () => {
    const n = normalizePath([
      { x: 10, y: 0 },
      { x: 20, y: 0 },
      { x: 20, y: 10 },
    ]);
    expect(n.length).toBe(3);
    expect(n[0]!.x).toBeLessThan(n[1]!.x);
  });

  it("defines templates for every letter used in word packs", () => {
    const letters = new Set<string>();
    for (const pack of Object.values(AIR_WRITE_WORDS)) {
      for (const w of pack) {
        for (const ch of w) {
          letters.add(ch);
        }
      }
    }
    for (const ch of letters) {
      expect(letterTemplate(ch), `missing corridor for ${ch}`).not.toBeNull();
    }
  });
});

describe("tilt cursor (sensor model)", () => {
  it("maps relative gravity tilt without integration drift", () => {
    const origin = tiltDeltaToPlane(0, 0, 0, 0);
    expect(origin.x).toBeCloseTo(0, 5);
    expect(origin.y).toBeCloseTo(0, 5);
    const right = tiltDeltaToPlane(0.4, 0, 0, 0);
    expect(right.x).toBeGreaterThan(0.5);
    expect(Math.abs(right.y)).toBeLessThan(0.15);
  });

  it("REGRESSION constant accel bias does not paint a left-right ramp", () => {
    let s = createAirWriteTracker("I");
    // Arm + settle already at a fixed lateral tilt
    for (let i = 0; i < 14; i++) {
      s = advanceAirWriteTracker(s, {
        ax: 0.15,
        ay: 0,
        az: Math.sqrt(1 - 0.15 * 0.15),
        deltaMs: 50,
      });
    }
    expect(s.settleMs).toBeGreaterThanOrEqual(AIR_SETTLE_MS);
    const before = s.delimPath.length;
    for (let i = 0; i < 40; i++) {
      s = advanceAirWriteTracker(s, {
        ax: 0.15,
        ay: 0,
        az: Math.sqrt(1 - 0.15 * 0.15),
        deltaMs: 50,
        sampleEveryMs: 40,
      });
    }
    expect(s.phase).toBe("await_start");
    // Holding still must not keep painting (integrator used to ramp forever).
    expect(s.delimPath.length - before).toBeLessThanOrEqual(2);
  });

  it("reports circle progress toward 100%", () => {
    expect(circleProgress([])).toBeLessThan(0.2);
    expect(circleProgress(makeCirclePath(0, 0, 0.4, 20))).toBe(1);
  });
});

describe("circoletto detection", () => {
  it("accepts a clean circle", () => {
    expect(detectSmallCircle(makeCirclePath(0, 0, 1, 20))).toBe(true);
  });

  it("accepts a sloppy oval (tolerant thresholds)", () => {
    const oval: AirPoint[] = [];
    for (let i = 0; i <= 18; i++) {
      const a = (2 * Math.PI * i) / 18;
      oval.push({ x: 1.35 * Math.cos(a), y: 0.75 * Math.sin(a) });
    }
    expect(detectSmallCircle(oval)).toBe(true);
  });

  it("rejects a straight line", () => {
    const line: AirPoint[] = [];
    for (let t = 0; t <= 20; t++) {
      line.push({ x: t * 0.1, y: 0 });
    }
    expect(detectSmallCircle(line)).toBe(false);
  });

  it("finds a small trailing circle after a long stroke", () => {
    const stem: AirPoint[] = [];
    for (let t = 0; t <= 20; t++) {
      stem.push({ x: 0, y: t * 0.2 });
    }
    const last = stem[stem.length - 1]!;
    const circle = makeCirclePath(last.x + 0.15, last.y, 0.12, 16);
    const path = [...stem, ...circle];
    const start = findTrailingCircleStart(path);
    expect(start).toBeGreaterThan(0);
    expect(start).toBeLessThan(path.length);
  });
});

describe("air write words", () => {
  it("picks locale words", () => {
    expect(["HI", "OK", "GO", "UP", "YES"]).toContain(
      pickAirWriteWord("en", () => 0),
    );
    expect(["SI", "OK", "SU", "VIA", "CIAO"]).toContain(
      pickAirWriteWord("it", () => 0),
    );
  });
});

describe("air write tracker protocol", () => {
  it("starts in await_start and enters drawing after circoletto", () => {
    let s = createAirWriteTracker("I");
    expect(s.phase).toBe("await_start");
    s = circleBurst(s);
    expect(s.phase).toBe("drawing");
    expect(s.path).toEqual([]);
    expect(s.delimPath).toEqual([]);
  });

  it("accepts a perfect I stroke and completes the word", () => {
    let s = createAirWriteTracker("I");
    s = circleBurst(s);
    expect(s.phase).toBe("drawing");

    const corridor = letterTemplate("I")!.strokes[0]!;
    const perfect = sampleCorridorCenterline(corridor, 16);
    s = drawAlong(s, perfect);
    expect(s.path.length).toBeGreaterThanOrEqual(6);

    const tip = s.path[s.path.length - 1]!;
    s = feedPlane(s, makeCirclePath(tip.x + 0.08, tip.y, 0.08, 20));
    expect(s.phase).toBe("complete");
    expect(s.recognized).toBe("I");
    expect(s.lastCoverage).toBeGreaterThanOrEqual(AIR_COVERAGE_THRESHOLD);
  });

  it("retries when coverage is too low", () => {
    let s = createAirWriteTracker("I");
    s = circleBurst(s);
    const bad: AirPoint[] = [];
    for (let t = 0; t <= 16; t++) {
      bad.push({ x: t * 0.2, y: 0 });
    }
    s = drawAlong(s, bad);
    const tip = s.path[s.path.length - 1]!;
    s = feedPlane(s, makeCirclePath(tip.x, tip.y + 0.1, 0.08, 20));
    expect(s.phase).toBe("await_start");
    expect(s.needsRetry).toBe(true);
    expect(s.recognized).toBe("");
  });

  it("requires intermediate circoletto for A crossbar", () => {
    let s = createAirWriteTracker("A");
    expect(s.strokeCountInLetter).toBe(2);

    s = circleBurst(s);
    const outline = sampleCorridorCenterline(
      letterTemplate("A")!.strokes[0]!,
      14,
    );
    s = drawAlong(s, outline);
    let tip = s.path[s.path.length - 1]!;
    s = feedPlane(s, makeCirclePath(tip.x + 0.1, tip.y, 0.08, 20));
    expect(s.phase).toBe("await_start");
    expect(s.strokeIndex).toBe(1);
    expect(s.recognized).toBe("");

    s = circleBurst(s);
    const bar = sampleCorridorCenterline(letterTemplate("A")!.strokes[1]!, 12);
    s = drawAlong(s, bar);
    tip = s.path[s.path.length - 1]!;
    s = feedPlane(s, makeCirclePath(tip.x, tip.y + 0.1, 0.08, 20));
    expect(s.phase).toBe("complete");
    expect(s.recognized).toBe("A");
  });

  it("REGRESSION scripted motion completes multi-letter words (L0 E2E)", () => {
    for (const word of ["I", "OK", "HI", "SI", "VIA"] as const) {
      const s = scriptCompleteAirWriteWord(word);
      expect(s.phase, word).toBe("complete");
      expect(s.recognized, word).toBe(word);
    }
  });
});
