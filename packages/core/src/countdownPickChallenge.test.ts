import { describe, expect, it } from "vitest";
import {
  COUNTDOWN_MIN_ENTRY_FRAC,
  COUNTDOWN_WINDOW_MS,
  correctChoiceIndex,
  createCountdownPrompt,
  formatCountdownValue,
  highValueInUnit,
  initialCountdownPrompt,
  makeCountdownChoices,
  promptAfterCorrect,
  promptAfterMiss,
} from "./countdownPickChallenge.js";

function cycleRnd(seed = 0.13): () => number {
  let s = seed;
  return () => {
    s = (s * 1.7 + 0.19) % 1;
    return s;
  };
}

describe("countdown pick", () => {
  it("formats integers without decimals", () => {
    expect(formatCountdownValue(5)).toBe("5");
    expect(formatCountdownValue(4.5)).toBe("4.5");
  });

  it("waits five seconds before auto tick-down", () => {
    expect(COUNTDOWN_WINDOW_MS).toBe(5_000);
  });

  it("choices include the target exactly once", () => {
    const choices = makeCountdownChoices(5.7, () => 0.2);
    expect(choices).toHaveLength(3);
    expect(choices.filter((c) => Math.abs(c - 5.7) < 0.001)).toHaveLength(1);
  });

  it("never places correct at avoided index", () => {
    for (let i = 0; i < 80; i += 1) {
      const rnd = cycleRnd(0.01 * i);
      const avoid = i % 3;
      const choices = makeCountdownChoices(5.7, rnd, {
        avoidCorrectAtIndex: avoid,
      });
      expect(Math.abs(choices[avoid]! - 5.7)).toBeGreaterThan(0.001);
      expect(choices.some((c) => Math.abs(c - 5.7) < 0.001)).toBe(true);
    }
  });

  it("correct at unit 0 completes", () => {
    const p = createCountdownPrompt(0.6, () => 0.1);
    expect(promptAfterCorrect(p, () => 0.1)).toBe("done");
  });

  it("miss stays in the same unit and goes lower", () => {
    const p = createCountdownPrompt(5.5, () => 0.3);
    const next = promptAfterMiss(p, () => 0.2);
    expect(next.unit).toBe(5);
    expect(next.value).toBeGreaterThanOrEqual(5);
    expect(next.value).toBeLessThan(5.5);
  });

  it("miss after wrong tap moves correct off that button", () => {
    const p = createCountdownPrompt(5.8, cycleRnd(0.4));
    const wrongIndex = 0;
    // Ensure we are simulating a wrong tap on index 0 even if it was correct.
    const next = promptAfterMiss(p, cycleRnd(0.55), {
      avoidCorrectAtIndex: wrongIndex,
    });
    expect(next.unit).toBe(5);
    expect(correctChoiceIndex(next)).not.toBe(wrongIndex);
  });

  it("mashing the same button after a miss never hits correct", () => {
    const rnd = cycleRnd(0.22);
    let prompt = initialCountdownPrompt(rnd);
    expect(prompt.value).toBeGreaterThanOrEqual(5 + COUNTDOWN_MIN_ENTRY_FRAC);

    // Deliberate miss on whatever index holds a distractor (or force index 1).
    let mashIndex = prompt.choices.findIndex(
      (c) => Math.abs(c - prompt.value) > 0.001,
    );
    if (mashIndex < 0) {
      mashIndex = 1;
    }

    for (let step = 0; step < 40; step += 1) {
      prompt = promptAfterMiss(prompt, rnd, {
        avoidCorrectAtIndex: mashIndex,
      });
      expect(prompt.unit).toBe(5);
      expect(correctChoiceIndex(prompt)).not.toBe(mashIndex);
      // Same-button mash would pick choices[mashIndex], which must be wrong.
      expect(Math.abs(prompt.choices[mashIndex]! - prompt.value)).toBeGreaterThan(
        0.001,
      );
    }
  });

  it("initial prompt is high in the 5.x band", () => {
    const p = initialCountdownPrompt(() => 0.1);
    expect(p.unit).toBe(5);
    expect(p.value).toBeGreaterThanOrEqual(5.55);
    expect(p.value).toBeLessThan(6);
  });

  it("correct enters the next unit high enough for miss headroom", () => {
    const p = createCountdownPrompt(5.7, () => 0.3);
    const next = promptAfterCorrect(p, () => 0.25);
    expect(next).not.toBe("done");
    if (next === "done") {
      return;
    }
    expect(next.unit).toBe(4);
    expect(next.value).toBeGreaterThanOrEqual(4.55);
    expect(next.value).toBeLessThan(5);
  });

  it("highValueInUnit never returns the bare integer", () => {
    expect(highValueInUnit(5, () => 0)).toBe(5.55);
    expect(highValueInUnit(5, () => 0.999)).toBeGreaterThan(5.9);
  });
});
