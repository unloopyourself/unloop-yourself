/**
 * Air write: circle-delimited strokes matched against letter "road" corridors.
 * Metaphor: walk an S-shaped street — most of the walk must stay inside the road.
 * Delimiter: a small air-circle ("circoletto"), not a phone shake.
 * No ML — normalized path vs template polylines with half-width.
 */

export const AIR_WRITE_CHALLENGE_ID = "air_write" as const;

/** Fraction of the normalized path that must lie inside the corridor. */
export const AIR_COVERAGE_THRESHOLD = 0.8;

export type AirWriteLocale = "en" | "it";

export type AirPoint = { readonly x: number; readonly y: number };

/** Thickened centerline in the unit square (x right, y up). */
export type AirCorridor = {
  readonly points: readonly AirPoint[];
  readonly halfWidth: number;
};

/** Ordered strokes for one letter (circle between strokes). */
export type AirLetterTemplate = {
  readonly strokes: readonly AirCorridor[];
};

export type AirWritePhase = "await_start" | "drawing" | "complete";

export type AirWriteTrackerState = {
  readonly targetWord: string;
  readonly letterIndex: number;
  readonly strokeIndex: number;
  readonly phase: AirWritePhase;
  /** Letters accepted so far (prefix of targetWord). */
  readonly recognized: string;
  readonly path: readonly AirPoint[];
  readonly lastCoverage: number;
  /** True after a failed stroke until the next start circle. */
  readonly needsRetry: boolean;
  readonly strokeCountInLetter: number;
  readonly delimCoolMs: number;
  /** Gesture buffer used to detect the start circoletto. */
  readonly delimPath: readonly AirPoint[];
  readonly delimArmed: boolean;
  readonly delimBaseAx: number;
  readonly delimBaseAy: number;
  readonly delimPosX: number;
  readonly delimPosY: number;
  readonly delimSampleAccumMs: number;
  readonly baseAx: number;
  readonly baseAy: number;
  readonly posX: number;
  readonly posY: number;
  readonly sampleAccumMs: number;
  /** Low-pass gravity (unit) for tilt cursor — cuts sensor jitter. */
  readonly filtGx: number;
  readonly filtGy: number;
  readonly filtGz: number;
  /** Ms spent settling baseline before recording the start circle. */
  readonly settleMs: number;
};

const HW = 0.24;

function pt(x: number, y: number): AirPoint {
  return { x, y };
}

function line(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  halfWidth: number = HW,
): AirCorridor {
  return { points: [pt(x1, y1), pt(x2, y2)], halfWidth };
}

function poly(coords: readonly number[], halfWidth: number = HW): AirCorridor {
  const points: AirPoint[] = [];
  for (let i = 0; i + 1 < coords.length; i += 2) {
    points.push(pt(coords[i]!, coords[i + 1]!));
  }
  return { points, halfWidth };
}

/**
 * Letter road templates in the unit square.
 * Multi-stroke letters need an intermediate circoletto (e.g. A crossbar).
 */
export const AIR_LETTER_CORRIDORS: Readonly<Record<string, AirLetterTemplate>> = {
  A: {
    strokes: [
      poly([0.12, 0.1, 0.5, 0.92, 0.88, 0.1]),
      line(0.28, 0.4, 0.72, 0.4),
    ],
  },
  C: {
    strokes: [poly([0.78, 0.78, 0.4, 0.92, 0.18, 0.5, 0.4, 0.08, 0.78, 0.22])],
  },
  E: {
    strokes: [
      line(0.22, 0.9, 0.22, 0.1),
      line(0.22, 0.9, 0.82, 0.9),
      line(0.22, 0.5, 0.7, 0.5),
      line(0.22, 0.1, 0.82, 0.1),
    ],
  },
  G: {
    strokes: [
      poly([0.78, 0.75, 0.4, 0.92, 0.18, 0.5, 0.4, 0.08, 0.78, 0.22, 0.78, 0.45, 0.5, 0.45]),
    ],
  },
  H: {
    strokes: [
      line(0.22, 0.9, 0.22, 0.1),
      line(0.78, 0.9, 0.78, 0.1),
      line(0.22, 0.5, 0.78, 0.5),
    ],
  },
  I: {
    strokes: [line(0.5, 0.9, 0.5, 0.1)],
  },
  K: {
    strokes: [
      line(0.22, 0.9, 0.22, 0.1),
      poly([0.78, 0.9, 0.22, 0.5, 0.78, 0.1]),
    ],
  },
  L: {
    strokes: [poly([0.28, 0.92, 0.28, 0.12, 0.82, 0.12])],
  },
  N: {
    strokes: [poly([0.2, 0.1, 0.2, 0.9, 0.8, 0.1, 0.8, 0.9])],
  },
  O: {
    strokes: [
      poly([0.5, 0.92, 0.18, 0.7, 0.18, 0.3, 0.5, 0.08, 0.82, 0.3, 0.82, 0.7, 0.5, 0.92]),
    ],
  },
  P: {
    strokes: [
      line(0.25, 0.1, 0.25, 0.9),
      poly([0.25, 0.9, 0.72, 0.9, 0.78, 0.7, 0.72, 0.5, 0.25, 0.5]),
    ],
  },
  S: {
    strokes: [
      poly([0.75, 0.82, 0.5, 0.92, 0.25, 0.82, 0.25, 0.62, 0.75, 0.38, 0.75, 0.18, 0.5, 0.08, 0.25, 0.18]),
    ],
  },
  U: {
    strokes: [poly([0.2, 0.9, 0.2, 0.28, 0.5, 0.1, 0.8, 0.28, 0.8, 0.9])],
  },
  V: {
    strokes: [poly([0.15, 0.9, 0.5, 0.1, 0.85, 0.9])],
  },
  Y: {
    strokes: [
      poly([0.15, 0.9, 0.5, 0.5, 0.85, 0.9]),
      line(0.5, 0.5, 0.5, 0.1),
    ],
  },
};

/** Short 2–4 letter words per locale. */
export const AIR_WRITE_WORDS: Record<AirWriteLocale, readonly string[]> = {
  en: ["HI", "OK", "GO", "UP", "YES"],
  it: ["SI", "OK", "SU", "VIA", "CIAO"],
};

export function pickAirWriteWord(
  locale: AirWriteLocale,
  random: () => number = Math.random,
): string {
  const pack = AIR_WRITE_WORDS[locale] ?? AIR_WRITE_WORDS.en;
  const idx = Math.floor(random() * pack.length);
  return pack[idx]!;
}

export function letterTemplate(letter: string): AirLetterTemplate | null {
  const t = AIR_LETTER_CORRIDORS[letter.toUpperCase()];
  return t ?? null;
}

export function currentCorridor(state: AirWriteTrackerState): AirCorridor | null {
  const letter = state.targetWord[state.letterIndex];
  if (!letter) {
    return null;
  }
  const tmpl = letterTemplate(letter);
  if (!tmpl) {
    return null;
  }
  return tmpl.strokes[state.strokeIndex] ?? null;
}

export function distPointToSegment(p: AirPoint, a: AirPoint, b: AirPoint): number {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const len2 = abx * abx + aby * aby;
  if (len2 < 1e-12) {
    return Math.hypot(p.x - a.x, p.y - a.y);
  }
  let t = ((p.x - a.x) * abx + (p.y - a.y) * aby) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + t * abx), p.y - (a.y + t * aby));
}

export function pointInCorridor(p: AirPoint, corridor: AirCorridor): boolean {
  const pts = corridor.points;
  if (pts.length === 0) {
    return false;
  }
  if (pts.length === 1) {
    return Math.hypot(p.x - pts[0]!.x, p.y - pts[0]!.y) <= corridor.halfWidth;
  }
  for (let i = 0; i < pts.length - 1; i++) {
    if (distPointToSegment(p, pts[i]!, pts[i + 1]!) <= corridor.halfWidth) {
      return true;
    }
  }
  return false;
}

/** Bounding box side used for unit-square normalization (aspect preserved). */
export function pathExtentSide(path: readonly AirPoint[]): number {
  if (path.length === 0) {
    return 1;
  }
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of path) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  }
  const w = Math.max(maxX - minX, 1e-6);
  const h = Math.max(maxY - minY, 1e-6);
  return Math.max(w, h);
}

/** Map path into the unit square, preserving aspect ratio and centering. */
export function normalizePath(path: readonly AirPoint[]): AirPoint[] {
  if (path.length === 0) {
    return [];
  }
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of path) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  }
  const side = pathExtentSide(path);
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  return path.map((p) => ({
    x: 0.5 + (p.x - cx) / side,
    y: 0.5 + (p.y - cy) / side,
  }));
}

/**
 * Share of path samples that lie inside the corridor ("in the road").
 * Path and corridor are each normalized to the unit square so absolute
 * placement / scale (accel units vs template) do not matter — only shape.
 */
export function strokeCoverage(
  path: readonly AirPoint[],
  corridor: AirCorridor,
): number {
  const normPath = normalizePath(path);
  if (normPath.length < 4) {
    return 0;
  }
  const corridorSide = pathExtentSide(corridor.points);
  const normCorridor: AirCorridor = {
    points: normalizePath(corridor.points),
    halfWidth: corridor.halfWidth / corridorSide,
  };
  let inside = 0;
  for (const p of normPath) {
    if (pointInCorridor(p, normCorridor)) {
      inside += 1;
    }
  }
  return inside / normPath.length;
}

export function sampleCorridorCenterline(
  corridor: AirCorridor,
  samplesPerSegment: number = 12,
): AirPoint[] {
  const out: AirPoint[] = [];
  const pts = corridor.points;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i]!;
    const b = pts[i + 1]!;
    for (let s = 0; s < samplesPerSegment; s++) {
      const t = s / samplesPerSegment;
      out.push({
        x: a.x + (b.x - a.x) * t,
        y: a.y + (b.y - a.y) * t,
      });
    }
  }
  if (pts.length > 0) {
    out.push(pts[pts.length - 1]!);
  }
  return out;
}

/** Build a closed circular polyline (for tests / delimiter injection). */
export function makeCirclePath(
  cx: number,
  cy: number,
  radius: number,
  samples: number = 16,
): AirPoint[] {
  const out: AirPoint[] = [];
  for (let i = 0; i <= samples; i++) {
    const a = (2 * Math.PI * i) / samples;
    out.push({ x: cx + radius * Math.cos(a), y: cy + radius * Math.sin(a) });
  }
  return out;
}

/** Tunable circoletto tolerances (kept loose — air motion is noisy). */
export const AIR_CIRCLE = {
  minPoints: 6,
  /** Max radius std/mean — ovals still count. */
  maxRadiusCv: 0.85,
  /** Start–end gap as a fraction of mean radius. */
  maxClosureGap: 1.05,
  /** Minimum |winding| in radians (~¾ turn is enough to start). */
  minTurn: Math.PI * 0.75,
  /** Path length vs 2πr. */
  minLenFactor: 0.25,
  maxLenFactor: 2.8,
  /**
   * Trailing delimiter must be smaller than the letter stroke so far
   * (avoids letter O self-closing). Still fairly tolerant.
   */
  maxTrailVsStroke: 0.72,
} as const;

/** EMA blend toward new gravity each sample (higher = snappier, noisier). */
export const AIR_TILT_SMOOTH = 0.22;
/** Hold still this long after arming so baseline is stable. */
export const AIR_SETTLE_MS = 400;

/**
 * True when path looks like a small closed loop (circoletto).
 * Uses radius consistency, closure, winding, and arc length ≈ circumference.
 */
export function detectSmallCircle(path: readonly AirPoint[]): boolean {
  return circleProgress(path) >= 1;
}

/** Absolute signed winding (radians) of a polyline. */
export function pathWinding(path: readonly AirPoint[]): number {
  if (path.length < 3) {
    return 0;
  }
  let turn = 0;
  let prev = Math.atan2(path[1]!.y - path[0]!.y, path[1]!.x - path[0]!.x);
  for (let i = 2; i < path.length; i++) {
    const h = Math.atan2(
      path[i]!.y - path[i - 1]!.y,
      path[i]!.x - path[i - 1]!.x,
    );
    let d = h - prev;
    while (d > Math.PI) {
      d -= 2 * Math.PI;
    }
    while (d < -Math.PI) {
      d += 2 * Math.PI;
    }
    turn += d;
    prev = h;
  }
  return turn;
}

/**
 * 0–1 progress toward accepting a start/end circoletto (for UI feedback).
 * 1 means detectSmallCircle would accept.
 */
export function circleProgress(path: readonly AirPoint[]): number {
  if (path.length < AIR_CIRCLE.minPoints) {
    return Math.min(0.35, path.length / (AIR_CIRCLE.minPoints * 2));
  }
  let cx = 0;
  let cy = 0;
  for (const p of path) {
    cx += p.x;
    cy += p.y;
  }
  cx /= path.length;
  cy /= path.length;

  const radii: number[] = [];
  let meanR = 0;
  for (const p of path) {
    const r = Math.hypot(p.x - cx, p.y - cy);
    radii.push(r);
    meanR += r;
  }
  meanR /= radii.length;
  if (meanR < 1e-4) {
    return 0.1;
  }

  let varSum = 0;
  for (const r of radii) {
    varSum += (r - meanR) * (r - meanR);
  }
  const std = Math.sqrt(varSum / radii.length);
  const cv = std / meanR;
  if (cv > AIR_CIRCLE.maxRadiusCv * 1.35) {
    return 0.15;
  }

  const start = path[0]!;
  const end = path[path.length - 1]!;
  const gap = Math.hypot(end.x - start.x, end.y - start.y) / meanR;

  const turn = Math.abs(pathWinding(path));
  const turnScore = Math.min(1, turn / AIR_CIRCLE.minTurn);

  let len = 0;
  for (let i = 1; i < path.length; i++) {
    len += Math.hypot(path[i]!.x - path[i - 1]!.x, path[i]!.y - path[i - 1]!.y);
  }
  const expected = 2 * Math.PI * meanR;
  const lenOk =
    len >= expected * AIR_CIRCLE.minLenFactor &&
    len <= expected * AIR_CIRCLE.maxLenFactor;
  const cvOk = cv <= AIR_CIRCLE.maxRadiusCv;
  const gapOk = gap <= AIR_CIRCLE.maxClosureGap;

  if (turnScore >= 1 && cvOk && gapOk && lenOk) {
    return 1;
  }

  const shape =
    (cvOk ? 0.25 : Math.max(0, 0.25 * (1 - cv / (AIR_CIRCLE.maxRadiusCv * 1.35)))) +
    (gapOk ? 0.2 : Math.max(0, 0.2 * (1 - gap / (AIR_CIRCLE.maxClosureGap * 1.5)))) +
    (lenOk ? 0.15 : 0.05);
  return Math.min(0.99, turnScore * 0.55 + shape);
}

/**
 * Index where a trailing delimiter circoletto begins, or -1.
 * Requires the loop to be smaller than the letter stroke so far
 * (so letter O does not self-trigger).
 */
export function findTrailingCircleStart(path: readonly AirPoint[]): number {
  if (path.length < 14) {
    return -1;
  }
  const fullSide = pathExtentSide(path);
  for (let len = 8; len <= Math.min(48, path.length - 4); len++) {
    const start = path.length - len;
    const trailing = path.slice(start);
    if (!detectSmallCircle(trailing)) {
      continue;
    }
    const trailSide = pathExtentSide(trailing);
    if (trailSide > fullSide * AIR_CIRCLE.maxTrailVsStroke) {
      continue;
    }
    return start;
  }
  return -1;
}

export function createAirWriteTracker(targetWord: string): AirWriteTrackerState {
  const word = targetWord.toUpperCase();
  const first = letterTemplate(word[0] ?? "");
  return {
    targetWord: word,
    letterIndex: 0,
    strokeIndex: 0,
    phase: "await_start",
    recognized: "",
    path: [],
    lastCoverage: 0,
    needsRetry: false,
    strokeCountInLetter: first?.strokes.length ?? 1,
    delimCoolMs: 0,
    delimPath: [],
    delimArmed: false,
    delimBaseAx: 0,
    delimBaseAy: 0,
    delimPosX: 0,
    delimPosY: 0,
    delimSampleAccumMs: 0,
    baseAx: 0,
    baseAy: 0,
    posX: 0,
    posY: 0,
    sampleAccumMs: 0,
    filtGx: 0,
    filtGy: 0,
    filtGz: 1,
    settleMs: 0,
  };
}

function clearDelim(state: AirWriteTrackerState): AirWriteTrackerState {
  return {
    ...state,
    delimPath: [],
    delimArmed: false,
    delimPosX: 0,
    delimPosY: 0,
    delimSampleAccumMs: 0,
    settleMs: 0,
  };
}

/** Gain from unit-gravity tilt delta → plane units (≈1 ≈ full letter extent). */
export const AIR_TILT_GAIN = 1.8;
/** Ignore sub-pixel jitter when appending samples. */
export const AIR_MIN_STEP = 0.01;

export function normalizeGravity(
  ax: number,
  ay: number,
  az: number,
): { gx: number; gy: number; gz: number } {
  const mag = Math.hypot(ax, ay, az);
  if (mag < 1e-6) {
    return { gx: 0, gy: 0, gz: 1 };
  }
  return { gx: ax / mag, gy: ay / mag, gz: az / mag };
}

export function smoothGravity(
  prev: { gx: number; gy: number; gz: number },
  next: { gx: number; gy: number; gz: number },
  alpha: number = AIR_TILT_SMOOTH,
): { gx: number; gy: number; gz: number } {
  const a = Math.min(1, Math.max(0, alpha));
  return {
    gx: prev.gx + (next.gx - prev.gx) * a,
    gy: prev.gy + (next.gy - prev.gy) * a,
    gz: prev.gz + (next.gz - prev.gz) * a,
  };
}

/**
 * Map device tilt (gravity direction) relative to a baseline pose into a 2D
 * drawing plane. No integration — avoids the classic left/right drift ramp.
 */
export function tiltDeltaToPlane(
  gx: number,
  gy: number,
  baseGx: number,
  baseGy: number,
  gain: number = AIR_TILT_GAIN,
): AirPoint {
  return {
    x: (gx - baseGx) * gain,
    y: (gy - baseGy) * gain,
  };
}

function beginDrawing(
  state: AirWriteTrackerState,
  gx: number,
  gy: number,
  gz: number,
  coolMs: number,
): AirWriteTrackerState {
  // Letter ink starts empty — delimPath discarded. Re-baseline tilt to current pose.
  return {
    ...clearDelim(state),
    phase: "drawing",
    path: [],
    needsRetry: false,
    delimCoolMs: coolMs,
    baseAx: gx,
    baseAy: gy,
    posX: 0,
    posY: 0,
    sampleAccumMs: 0,
    filtGx: gx,
    filtGy: gy,
    filtGz: gz,
    settleMs: 0,
  };
}

function advanceAfterAcceptedStroke(
  state: AirWriteTrackerState,
  coverage: number,
  coolMs: number,
): AirWriteTrackerState {
  const letter = state.targetWord[state.letterIndex]!;
  const tmpl = letterTemplate(letter)!;
  const nextStroke = state.strokeIndex + 1;

  if (nextStroke < tmpl.strokes.length) {
    return {
      ...clearDelim(state),
      phase: "await_start",
      strokeIndex: nextStroke,
      path: [],
      lastCoverage: coverage,
      needsRetry: false,
      delimCoolMs: coolMs,
      posX: 0,
      posY: 0,
      sampleAccumMs: 0,
    };
  }

  const recognized = state.recognized + letter;
  const nextLetter = state.letterIndex + 1;
  if (nextLetter >= state.targetWord.length) {
    return {
      ...clearDelim(state),
      phase: "complete",
      letterIndex: nextLetter,
      strokeIndex: 0,
      recognized,
      path: [],
      lastCoverage: coverage,
      needsRetry: false,
      strokeCountInLetter: 0,
      delimCoolMs: 0,
    };
  }

  const nextTmpl = letterTemplate(state.targetWord[nextLetter]!)!;
  return {
    ...clearDelim(state),
    phase: "await_start",
    letterIndex: nextLetter,
    strokeIndex: 0,
    recognized,
    path: [],
    lastCoverage: coverage,
    needsRetry: false,
    strokeCountInLetter: nextTmpl.strokes.length,
    delimCoolMs: coolMs,
    posX: 0,
    posY: 0,
    sampleAccumMs: 0,
  };
}

function finishStrokeAttempt(
  state: AirWriteTrackerState,
  strokePath: readonly AirPoint[],
  coverageThreshold: number,
  coolMs: number,
): AirWriteTrackerState {
  if (strokePath.length < 4) {
    return {
      ...clearDelim(state),
      phase: "await_start",
      path: [],
      needsRetry: true,
      lastCoverage: 0,
      delimCoolMs: coolMs,
      posX: 0,
      posY: 0,
      sampleAccumMs: 0,
    };
  }

  const corridor = currentCorridor(state);
  if (!corridor) {
    return { ...state, phase: "complete" };
  }

  const coverage = strokeCoverage(strokePath, corridor);
  if (coverage >= coverageThreshold) {
    return advanceAfterAcceptedStroke(
      { ...state, path: strokePath, lastCoverage: coverage },
      coverage,
      coolMs,
    );
  }

  return {
    ...clearDelim(state),
    phase: "await_start",
    path: [],
    lastCoverage: coverage,
    needsRetry: true,
    delimCoolMs: coolMs,
    posX: 0,
    posY: 0,
    sampleAccumMs: 0,
  };
}

/**
 * Advance air-write from accelerometer samples.
 *
 * Motion model: **smoothed tilt cursor**, not double-integration of linear accel.
 * Gravity is EMA-filtered, then mapped relative to the pose at arm/start.
 * A short settle window re-baselines before the start circle is recorded.
 *
 * Pass `plane` to inject coordinates directly (tests / scripted L0).
 */
export function advanceAirWriteTracker(
  state: AirWriteTrackerState,
  tick: {
    ax: number;
    ay: number;
    az: number;
    deltaMs: number;
    /** Bypass tilt mapping — absolute plane sample (tests). */
    plane?: AirPoint;
    coverageThreshold?: number;
    sampleEveryMs?: number;
    minPathPoints?: number;
    delimCoolMs?: number;
    maxDelimPoints?: number;
    tiltGain?: number;
    tiltSmooth?: number;
    settleMs?: number;
  },
): AirWriteTrackerState {
  if (state.phase === "complete") {
    return state;
  }

  const coverageThreshold = tick.coverageThreshold ?? AIR_COVERAGE_THRESHOLD;
  const sampleEveryMs = tick.sampleEveryMs ?? 40;
  const minPathPoints = tick.minPathPoints ?? 6;
  const coolAfter = tick.delimCoolMs ?? 450;
  const maxDelimPoints = tick.maxDelimPoints ?? 64;
  const gain = tick.tiltGain ?? AIR_TILT_GAIN;
  const smooth = tick.tiltSmooth ?? AIR_TILT_SMOOTH;
  const settleNeed = tick.settleMs ?? AIR_SETTLE_MS;

  const cooling = state.delimCoolMs > 0;
  let next: AirWriteTrackerState = {
    ...state,
    delimCoolMs: cooling
      ? Math.max(0, state.delimCoolMs - tick.deltaMs)
      : 0,
  };

  const rawG = normalizeGravity(tick.ax, tick.ay, tick.az);
  const filt = tick.plane
    ? { gx: next.filtGx, gy: next.filtGy, gz: next.filtGz }
    : smoothGravity(
        { gx: next.filtGx, gy: next.filtGy, gz: next.filtGz },
        rawG,
        next.delimArmed || next.phase === "drawing" ? smooth : 1,
      );
  next = {
    ...next,
    filtGx: filt.gx,
    filtGy: filt.gy,
    filtGz: filt.gz,
  };

  const samplePlane = (baseGx: number, baseGy: number): AirPoint => {
    if (tick.plane) {
      return tick.plane;
    }
    return tiltDeltaToPlane(filt.gx, filt.gy, baseGx, baseGy, gain);
  };

  if (next.phase === "await_start") {
    if (cooling) {
      return next;
    }
    if (!next.delimArmed) {
      return {
        ...next,
        delimArmed: true,
        delimBaseAx: filt.gx,
        delimBaseAy: filt.gy,
        delimPosX: 0,
        delimPosY: 0,
        delimPath: [],
        delimSampleAccumMs: 0,
        settleMs: 0,
        filtGx: rawG.gx,
        filtGy: rawG.gy,
        filtGz: rawG.gz,
      };
    }

    // Settle: keep updating baseline while the user holds still.
    if (next.settleMs < settleNeed && !tick.plane) {
      return {
        ...next,
        settleMs: next.settleMs + tick.deltaMs,
        delimBaseAx: filt.gx,
        delimBaseAy: filt.gy,
        delimPosX: 0,
        delimPosY: 0,
        delimPath: [],
        delimSampleAccumMs: 0,
      };
    }

    const p = samplePlane(next.delimBaseAx, next.delimBaseAy);
    let path = next.delimPath;
    let sampleAccumMs = next.delimSampleAccumMs + tick.deltaMs;

    if (sampleAccumMs >= sampleEveryMs) {
      sampleAccumMs = 0;
      const last = path[path.length - 1];
      if (!last || Math.hypot(p.x - last.x, p.y - last.y) > AIR_MIN_STEP) {
        path = [...path, p];
        if (path.length > maxDelimPoints) {
          path = path.slice(path.length - maxDelimPoints);
        }
      }
    }

    next = {
      ...next,
      delimPath: path,
      delimPosX: p.x,
      delimPosY: p.y,
      delimSampleAccumMs: sampleAccumMs,
    };

    if (detectSmallCircle(path)) {
      return beginDrawing(next, filt.gx, filt.gy, filt.gz, coolAfter);
    }
    return next;
  }

  // drawing — cool without recording letter ink; re-baseline tilt each tick
  if (cooling) {
    return {
      ...next,
      path: [],
      posX: 0,
      posY: 0,
      sampleAccumMs: 0,
      baseAx: filt.gx,
      baseAy: filt.gy,
    };
  }

  const p = samplePlane(next.baseAx, next.baseAy);
  let path = next.path;
  let sampleAccumMs = next.sampleAccumMs + tick.deltaMs;

  if (sampleAccumMs >= sampleEveryMs) {
    sampleAccumMs = 0;
    const last = path[path.length - 1];
    if (!last || Math.hypot(p.x - last.x, p.y - last.y) > AIR_MIN_STEP) {
      path = [...path, p];
    }
  }

  next = {
    ...next,
    path,
    posX: p.x,
    posY: p.y,
    sampleAccumMs,
  };

  const circleStart = findTrailingCircleStart(path);
  if (circleStart < 0) {
    return next;
  }

  const strokePath = path.slice(0, circleStart);
  if (strokePath.length < minPathPoints) {
    return {
      ...clearDelim(next),
      phase: "await_start",
      path: [],
      needsRetry: true,
      lastCoverage: 0,
      delimCoolMs: coolAfter,
      posX: 0,
      posY: 0,
      sampleAccumMs: 0,
    };
  }

  return finishStrokeAttempt(next, strokePath, coverageThreshold, coolAfter);
}

/**
 * Deterministic L0 “E2E” for the air-write protocol: inject circoletto +
 * centerline strokes as plane samples (same path space the tilt cursor uses).
 */
export function scriptCompleteAirWriteWord(word: string): AirWriteTrackerState {
  let s = createAirWriteTracker(word);

  const drainCool = () => {
    while (s.delimCoolMs > 0) {
      s = advanceAirWriteTracker(s, {
        ax: 0,
        ay: 0,
        az: 1,
        deltaMs: 100,
      });
    }
  };

  const feedPlane = (points: readonly AirPoint[]) => {
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
  };

  const injectCircle = (radius = 0.35) => {
    drainCool();
    s = advanceAirWriteTracker(s, { ax: 0, ay: 0, az: 1, deltaMs: 20 });
    feedPlane(makeCirclePath(0, 0, radius, 16));
  };

  const drawAndClose = (stroke: AirCorridor) => {
    drainCool();
    const path = sampleCorridorCenterline(stroke, 16);
    feedPlane(path);
    const tip = s.path[s.path.length - 1] ?? path[path.length - 1]!;
    feedPlane(makeCirclePath(tip.x + 0.1, tip.y, 0.08, 20));
  };

  while (s.phase !== "complete") {
    const letter = s.targetWord[s.letterIndex];
    if (!letter) {
      break;
    }
    const tmpl = letterTemplate(letter);
    if (!tmpl) {
      break;
    }
    const stroke = tmpl.strokes[s.strokeIndex];
    if (!stroke) {
      break;
    }
    injectCircle();
    if (s.phase !== "drawing") {
      break;
    }
    drawAndClose(stroke);
  }

  return s;
}

