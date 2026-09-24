/**
 * Air write: coarse stroke-direction sequences vs short word templates.
 * Generous matching (edit distance) — recognition, not calligraphy.
 */

export const AIR_WRITE_CHALLENGE_ID = "air_write" as const;

/** Cardinal stroke directions in the writing plane. */
export type AirDir = "U" | "D" | "L" | "R";

export type AirWriteLocale = "en" | "it";

/** One or more acceptable stroke sequences per letter. */
export const AIR_LETTER_TEMPLATES: Record<string, readonly (readonly AirDir[])[]> = {
  A: [
    ["U", "R", "D", "L"],
    ["U", "D", "R"],
  ],
  C: [
    ["R", "D", "L"],
    ["R", "D", "L", "U"],
  ],
  E: [
    ["R", "D", "R", "D", "R"],
    ["D", "R", "D", "R"],
    ["R", "D", "R"],
  ],
  G: [
    ["R", "D", "L", "U", "R"],
    ["R", "D", "L", "R"],
  ],
  H: [
    ["U", "D", "R", "U", "D"],
    ["D", "U", "R", "D", "U"],
    ["U", "U", "R"],
    ["D", "D", "R"],
  ],
  I: [["U"], ["D"]],
  K: [
    ["U", "D", "R", "U"],
    ["D", "U", "R", "D"],
    ["U", "R", "D"],
  ],
  L: [
    ["D", "R"],
    ["U", "R"],
  ],
  N: [
    ["U", "D", "R", "U"],
    ["D", "U", "R", "D"],
    ["U", "R", "U"],
  ],
  O: [
    ["R", "D", "L", "U"],
    ["R", "D", "L", "U", "R"],
    ["L", "D", "R", "U"],
  ],
  P: [
    ["U", "R", "D", "L"],
    ["U", "R", "D"],
  ],
  S: [
    ["R", "D", "L", "D", "R"],
    ["L", "D", "R", "D", "L"],
    ["R", "D", "L", "R"],
  ],
  U: [
    ["D", "R", "U"],
    ["D", "L", "U"],
  ],
  V: [
    ["D", "R", "U"],
    ["D", "L", "U"],
  ],
  Y: [
    ["D", "R", "D"],
    ["D", "L", "D"],
    ["U", "D", "R"],
  ],
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

export function directionFromDelta(dx: number, dy: number): AirDir | null {
  const mag = Math.hypot(dx, dy);
  if (mag < 1e-6) {
    return null;
  }
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  if (ax >= ay) {
    return dx >= 0 ? "R" : "L";
  }
  return dy >= 0 ? "U" : "D";
}

export function levenshteinDirs(
  a: readonly AirDir[],
  b: readonly AirDir[],
): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) {
    return n;
  }
  if (n === 0) {
    return m;
  }
  const prev = new Array<number>(n + 1);
  const cur = new Array<number>(n + 1);
  for (let j = 0; j <= n; j++) {
    prev[j] = j;
  }
  for (let i = 1; i <= m; i++) {
    cur[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(
        prev[j]! + 1,
        cur[j - 1]! + 1,
        prev[j - 1]! + cost,
      );
    }
    for (let j = 0; j <= n; j++) {
      prev[j] = cur[j]!;
    }
  }
  return prev[n]!;
}

/** Expand a word into all concatenations of per-letter template variants. */
export function expandWordTemplates(word: string): AirDir[][] {
  const letters = word.toUpperCase().split("");
  let sequences: AirDir[][] = [[]];
  for (const letter of letters) {
    const variants = AIR_LETTER_TEMPLATES[letter];
    if (!variants || variants.length === 0) {
      return [];
    }
    const next: AirDir[][] = [];
    for (const prefix of sequences) {
      for (const variant of variants) {
        next.push([...prefix, ...variant]);
      }
    }
    sequences = next;
    // Cap combinatorial explosion for longer words
    if (sequences.length > 64) {
      sequences = sequences.slice(0, 64);
    }
  }
  return sequences;
}

export function matchAirWriteStrokes(
  observed: readonly AirDir[],
  targetWord: string,
): { complete: boolean; bestDistance: number; threshold: number } {
  const templates = expandWordTemplates(targetWord);
  if (templates.length === 0 || observed.length === 0) {
    return { complete: false, bestDistance: Infinity, threshold: 0 };
  }
  let best = Infinity;
  for (const t of templates) {
    best = Math.min(best, levenshteinDirs(observed, t));
  }
  // Generous: allow ~1 edit per 3 strokes, minimum 1, max 3
  const maxLen = Math.max(...templates.map((t) => t.length), observed.length);
  const threshold = Math.min(3, Math.max(1, Math.floor(maxLen / 3)));
  return {
    complete: best <= threshold,
    bestDistance: best,
    threshold,
  };
}

export type AirWriteTrackerState = {
  readonly inStroke: boolean;
  readonly idleMs: number;
  readonly sumX: number;
  readonly sumY: number;
  readonly strokes: readonly AirDir[];
  readonly targetWord: string;
  readonly complete: boolean;
};

export function createAirWriteTracker(targetWord: string): AirWriteTrackerState {
  return {
    inStroke: false,
    idleMs: 0,
    sumX: 0,
    sumY: 0,
    strokes: [],
    targetWord: targetWord.toUpperCase(),
    complete: false,
  };
}

/**
 * Advance air-write from accelerometer samples.
 * Uses device X/Y as the writing plane (portrait, facing user).
 */
export function advanceAirWriteTracker(
  state: AirWriteTrackerState,
  tick: {
    ax: number;
    ay: number;
    az: number;
    deltaMs: number;
    motionThreshold?: number;
    idleEndMs?: number;
    minStrokeImpulse?: number;
  },
): AirWriteTrackerState {
  if (state.complete) {
    return state;
  }
  const motionThreshold = tick.motionThreshold ?? 0.45;
  const idleEndMs = tick.idleEndMs ?? 320;
  const minStrokeImpulse = tick.minStrokeImpulse ?? 0.55;
  const mag = Math.hypot(tick.ax, tick.ay, tick.az);
  const motion = Math.abs(mag - 1);
  const dt = Math.max(1, tick.deltaMs) / 1000;

  if (motion >= motionThreshold) {
    return {
      ...state,
      inStroke: true,
      idleMs: 0,
      sumX: state.sumX + tick.ax * dt,
      sumY: state.sumY + tick.ay * dt,
    };
  }

  if (!state.inStroke) {
    return { ...state, idleMs: 0 };
  }

  const idleMs = state.idleMs + tick.deltaMs;
  if (idleMs < idleEndMs) {
    return { ...state, idleMs };
  }

  // End stroke
  const impulse = Math.hypot(state.sumX, state.sumY);
  let strokes = state.strokes;
  if (impulse >= minStrokeImpulse) {
    const dir = directionFromDelta(state.sumX, state.sumY);
    if (dir) {
      strokes = [...state.strokes, dir];
    }
  }
  const match = matchAirWriteStrokes(strokes, state.targetWord);
  return {
    inStroke: false,
    idleMs: 0,
    sumX: 0,
    sumY: 0,
    strokes,
    targetWord: state.targetWord,
    complete: match.complete,
  };
}
