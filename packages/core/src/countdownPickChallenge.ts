/** Countdown pick: match the shown number among 3 choices; slow tick-down on wait/miss. */

export const COUNTDOWN_PICK_CHALLENGE_ID = "countdown_type" as const;

/** Wait this long with no correct tap before nudging the value down. */
export const COUNTDOWN_WINDOW_MS = 5_000;

/** Enter each unit at least this far above the integer so misses can go lower. */
export const COUNTDOWN_MIN_ENTRY_FRAC = 0.55;

export type CountdownPrompt = {
  readonly display: string;
  readonly value: number;
  readonly unit: number;
  readonly choices: readonly number[];
};

export type CountdownPromptOptions = {
  /** After a wrong tap: do not put the correct value on this button index. */
  readonly avoidCorrectAtIndex?: number;
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function sameNumber(a: number, b: number): boolean {
  return Math.abs(a - b) < 0.001;
}

/** Prefer clean display: 5, 4.5, 3.37 */
export function formatCountdownValue(n: number): string {
  const r = round2(n);
  if (Math.abs(r - Math.round(r)) < 0.001) {
    return String(Math.round(r));
  }
  return String(r);
}

function buildDistractors(value: number, rnd: () => number): number[] {
  const unit = Math.floor(value);
  const distractors = new Set<number>();
  let guard = 0;
  while (distractors.size < 2 && guard < 40) {
    guard += 1;
    let d: number;
    if (rnd() < 0.45 && unit > 0) {
      d = round2(unit + rnd() * 0.95);
    } else {
      const delta = 0.05 + rnd() * 0.4;
      d = round2(value + (rnd() < 0.5 ? delta : -delta));
      if (d < 0) {
        d = round2(Math.abs(d));
      }
    }
    if (sameNumber(d, value)) {
      continue;
    }
    distractors.add(d);
  }
  while (distractors.size < 2) {
    distractors.add(round2(value + 0.11 * (distractors.size + 1)));
  }
  return [...distractors];
}

/**
 * Place `value` among two distractors. If `avoidCorrectAtIndex` is set, the
 * correct chip is never at that index (stops “mash the same button” wins).
 */
export function makeCountdownChoices(
  value: number,
  rnd: () => number = Math.random,
  options?: CountdownPromptOptions,
): number[] {
  const distractors = buildDistractors(value, rnd);
  const avoid = options?.avoidCorrectAtIndex;
  const allowed =
    avoid === undefined
      ? [0, 1, 2]
      : [0, 1, 2].filter((i) => i !== avoid);
  const slots = allowed.length > 0 ? allowed : [0, 1, 2];
  const correctIndex = slots[Math.floor(rnd() * slots.length)]!;

  const out: number[] = [0, 0, 0];
  out[correctIndex] = value;
  let di = 0;
  for (let i = 0; i < 3; i += 1) {
    if (i === correctIndex) {
      continue;
    }
    out[i] = distractors[di]!;
    di += 1;
  }
  return out;
}

export function createCountdownPrompt(
  value: number,
  rnd: () => number = Math.random,
  options?: CountdownPromptOptions,
): CountdownPrompt {
  const v = round2(Math.max(0, value));
  return {
    display: formatCountdownValue(v),
    value: v,
    unit: Math.floor(v),
    choices: makeCountdownChoices(v, rnd, options),
  };
}

/**
 * Enter a unit high enough that a miss can still pick a lower value in-band.
 * Range: unit.55 … unit.95 (never the bare integer).
 */
export function highValueInUnit(unit: number, rnd: () => number = Math.random): number {
  const u = Math.max(0, Math.floor(unit));
  return round2(u + COUNTDOWN_MIN_ENTRY_FRAC + rnd() * 0.4);
}

/** First prompt: start in the 5.x band, high enough for miss headroom. */
export function initialCountdownPrompt(rnd: () => number = Math.random): CountdownPrompt {
  return createCountdownPrompt(highValueInUnit(5, rnd), rnd);
}

/**
 * After a correct pick: step down one unit, again entering high in that band.
 * Correct on 0.x finishes.
 */
export function promptAfterCorrect(
  current: CountdownPrompt,
  rnd: () => number = Math.random,
): CountdownPrompt | "done" {
  if (current.unit <= 0) {
    return "done";
  }
  return createCountdownPrompt(highValueInUnit(current.unit - 1, rnd), rnd);
}

/**
 * After miss or 5s timeout: stay in the same unit with a lower (or equal) value.
 * When `avoidCorrectAtIndex` is set (wrong tap), the new correct chip is not
 * on that button.
 */
export function promptAfterMiss(
  current: CountdownPrompt,
  rnd: () => number = Math.random,
  options?: CountdownPromptOptions,
): CountdownPrompt {
  const unit = current.unit;
  const headroom = current.value - unit;
  if (headroom <= 0.02) {
    return createCountdownPrompt(unit, rnd, options);
  }
  const maxDrop = Math.max(0.05, headroom - 0.02);
  const drop = round2(0.08 + rnd() * Math.min(0.4, maxDrop));
  let next = round2(current.value - drop);
  if (next < unit) {
    next = unit;
  }
  if (next >= current.value) {
    next = round2(Math.max(unit, current.value - 0.05));
  }
  return createCountdownPrompt(next, rnd, options);
}

/** Index of the correct choice, or -1. */
export function correctChoiceIndex(prompt: CountdownPrompt): number {
  return prompt.choices.findIndex((c) => sameNumber(c, prompt.value));
}
