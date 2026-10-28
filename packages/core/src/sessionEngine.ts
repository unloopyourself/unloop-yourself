/**
 * Testable interrupt loop: Session FSM + policy + soft unlock + cooldown.
 * No React Native — drive with events and an injectable clock for E2E-like unit tests.
 */

import type { Capability } from "./challenge.js";
import { evaluatePolicy } from "./policy.js";
import { SessionFsm, type SessionState } from "./session.js";
import { MVP_DEFAULT_ENABLED_IDS } from "./mvpCatalog.js";

export type EngineClock = {
  now(): number;
};

export type EngineTimings = {
  readonly cooldownMs: number;
  readonly challengeTimeoutMs: number;
};

export type ChallengePicker = (
  enabledIds: readonly string[],
  available: ReadonlySet<Capability>,
  excludeId?: string | null,
) => string;

export type EngineSnapshot = {
  readonly state: SessionState;
  readonly activeChallengeId: string | null;
  /** Wall time when soft unlock fires if still in CHALLENGE; null otherwise. */
  readonly softUnlockAtMs: number | null;
  /** Wall time when cooldown ends; null if not cooling. */
  readonly cooldownUntilMs: number | null;
  readonly lastAppId: string | null;
  readonly lastDeltaU: number | null;
};

export type CooldownReason = "completed" | "soft_fail" | "restored";

export type EngineEffect =
  | { type: "enter_challenge"; challengeId: string; appId: string; deltaU: number }
  | { type: "cooldown_started"; reason: CooldownReason; untilMs: number }
  | { type: "cooldown_elapsed" }
  | { type: "monitoring_started" }
  | { type: "paused" };

const DEFAULT_PICKER: ChallengePicker = (enabled) =>
  enabled[0] ?? MVP_DEFAULT_ENABLED_IDS[0] ?? "breath_tap";

export class SessionEngine {
  readonly fsm: SessionFsm;
  private softUnlockAtMs: number | null = null;
  private cooldownUntilMs: number | null = null;
  /** Last known cooldown cause — used when hydrating so UI does not invent soft_fail. */
  private lastCooldownReason: CooldownReason | null = null;
  private activeChallengeId: string | null = null;
  /** Last interrupt challenge — excluded from next pick when ≥2 eligible. */
  private lastInterruptChallengeId: string | null = null;
  private lastAppId: string | null = null;
  private lastDeltaU: number | null = null;
  private enabledChallengeIds: string[];
  private availableCapabilities: ReadonlySet<Capability>;

  constructor(
    private readonly clock: EngineClock,
    private timings: EngineTimings,
    private readonly pickChallenge: ChallengePicker = DEFAULT_PICKER,
    initialState: SessionState = "PAUSED",
  ) {
    this.fsm = new SessionFsm(initialState);
    this.enabledChallengeIds = [...MVP_DEFAULT_ENABLED_IDS];
    this.availableCapabilities = new Set<Capability>(["accelerometer"]);
  }

  get state(): SessionState {
    return this.fsm.state;
  }

  snapshot(): EngineSnapshot {
    return {
      state: this.fsm.state,
      activeChallengeId: this.activeChallengeId,
      softUnlockAtMs: this.softUnlockAtMs,
      cooldownUntilMs: this.cooldownUntilMs,
      lastAppId: this.lastAppId,
      lastDeltaU: this.lastDeltaU,
    };
  }

  setTimings(timings: EngineTimings): void {
    this.timings = timings;
  }

  setChallengeOptions(
    enabledIds: readonly string[],
    available: ReadonlySet<Capability>,
  ): void {
    this.enabledChallengeIds = [...enabledIds];
    this.availableCapabilities = available;
  }

  startMonitoring(): EngineEffect[] {
    if (this.fsm.state === "PAUSED") {
      this.fsm.dispatch({ type: "START_MONITORING" });
    }
    this.clearChallengeTimers();
    return [{ type: "monitoring_started" }];
  }

  stop(): EngineEffect[] {
    if (this.fsm.state !== "PAUSED") {
      this.fsm.dispatch({ type: "STOP" });
    }
    this.clearChallengeTimers();
    this.cooldownUntilMs = null;
    this.activeChallengeId = null;
    return [{ type: "paused" }];
  }

  /**
   * Threshold from the usage adapter. Ignored in cooldown / wrong state.
   */
  onThresholdReached(appId: string, deltaU: number): EngineEffect[] {
    const decision = evaluatePolicy({
      inCooldown: this.fsm.state === "COOLDOWN",
      thresholdReached: true,
    });
    if (decision.action !== "interrupt") {
      return [];
    }
    if (this.fsm.state !== "MONITORING") {
      return [];
    }
    this.lastAppId = appId;
    this.lastDeltaU = deltaU;
    this.fsm.dispatch({ type: "THRESHOLD_REACHED" });
    const challengeId = this.pickChallenge(
      this.enabledChallengeIds,
      this.availableCapabilities,
      this.lastInterruptChallengeId,
    );
    this.activeChallengeId = challengeId;
    this.lastInterruptChallengeId = challengeId;
    this.softUnlockAtMs = this.clock.now() + this.timings.challengeTimeoutMs;
    this.cooldownUntilMs = null;
    return [
      {
        type: "enter_challenge",
        challengeId,
        appId,
        deltaU,
      },
    ];
  }

  onChallengeCompleted(): EngineEffect[] {
    if (this.fsm.state !== "CHALLENGE") {
      return [];
    }
    this.fsm.dispatch({ type: "CHALLENGE_COMPLETED" });
    return this.beginCooldown("completed");
  }

  /** Skip button or explicit soft fail. */
  onChallengeSoftFail(): EngineEffect[] {
    if (this.fsm.state !== "CHALLENGE") {
      return [];
    }
    this.fsm.dispatch({ type: "CHALLENGE_FAILED" });
    return this.beginCooldown("soft_fail");
  }

  /**
   * Restart the soft-unlock window when the user finally opens the challenge
   * (overlay may have been up for a while after THRESHOLD).
   */
  refreshChallengeDeadline(): void {
    if (this.fsm.state !== "CHALLENGE") {
      return;
    }
    this.softUnlockAtMs = this.clock.now() + this.timings.challengeTimeoutMs;
  }

  /**
   * Advance timers. Call from UI interval or tests after `clock` advances.
   */
  tick(): EngineEffect[] {
    const effects: EngineEffect[] = [];
    const now = this.clock.now();

    if (
      this.fsm.state === "CHALLENGE" &&
      this.softUnlockAtMs != null &&
      now >= this.softUnlockAtMs
    ) {
      this.fsm.dispatch({ type: "CHALLENGE_FAILED" });
      effects.push(...this.beginCooldown("soft_fail"));
    }

    if (
      this.fsm.state === "COOLDOWN" &&
      this.cooldownUntilMs != null &&
      now >= this.cooldownUntilMs
    ) {
      this.fsm.dispatch({ type: "COOLDOWN_ELAPSED" });
      this.cooldownUntilMs = null;
      effects.push({ type: "cooldown_elapsed" });
    }

    return effects;
  }

  /**
   * Restore after Activity death using native monitor truth.
   */
  hydrate(input: {
    monitoring: boolean;
    challengeOutstanding: boolean;
    inCooldown: boolean;
    cooldownUntilMs?: number;
  }): EngineEffect[] {
    if (!input.monitoring) {
      this.fsm.hydrate("PAUSED");
      this.clearChallengeTimers();
      this.cooldownUntilMs = null;
      this.activeChallengeId = null;
      return [{ type: "paused" }];
    }
    if (input.challengeOutstanding && !input.inCooldown) {
      // Already mid-challenge (e.g. Open tapped twice / AppState sync) — do not
      // re-pick or re-emit enter_challenge (that remounts UI and resets progress).
      if (this.fsm.state === "CHALLENGE" && this.activeChallengeId != null) {
        return [];
      }
      this.fsm.hydrate("CHALLENGE");
      const challengeId = this.pickChallenge(
        this.enabledChallengeIds,
        this.availableCapabilities,
        this.lastInterruptChallengeId,
      );
      this.activeChallengeId = challengeId;
      this.lastInterruptChallengeId = challengeId;
      this.softUnlockAtMs = this.clock.now() + this.timings.challengeTimeoutMs;
      this.cooldownUntilMs = null;
      return [
        {
          type: "enter_challenge",
          challengeId,
          appId: this.lastAppId ?? "unknown",
          deltaU: this.lastDeltaU ?? 0,
        },
      ];
    }
    if (input.inCooldown) {
      this.clearChallengeTimers();
      this.cooldownUntilMs =
        input.cooldownUntilMs ?? this.clock.now() + this.timings.cooldownMs;
      // Already cooling (e.g. AppState resume after success) — keep timers,
      // do not re-emit cooldown_started (that was wrongly hard-coded soft_fail).
      if (this.fsm.state === "COOLDOWN") {
        return [];
      }
      this.fsm.hydrate("COOLDOWN");
      const reason: CooldownReason = this.lastCooldownReason ?? "restored";
      return [
        {
          type: "cooldown_started",
          reason,
          untilMs: this.cooldownUntilMs,
        },
      ];
    }
    this.fsm.hydrate("MONITORING");
    this.clearChallengeTimers();
    this.cooldownUntilMs = null;
    this.activeChallengeId = null;
    return [{ type: "monitoring_started" }];
  }

  private beginCooldown(reason: "completed" | "soft_fail"): EngineEffect[] {
    this.clearChallengeTimers();
    this.activeChallengeId = null;
    this.lastCooldownReason = reason;
    const untilMs = this.clock.now() + this.timings.cooldownMs;
    this.cooldownUntilMs = untilMs;
    return [{ type: "cooldown_started", reason, untilMs }];
  }

  private clearChallengeTimers(): void {
    this.softUnlockAtMs = null;
  }
}

/** Display helper — never show 100% until done (regression: rounded false complete). */
export function challengeProgressDisplayPct(
  activeMs: number,
  requiredMs: number,
  done: boolean,
): number {
  if (done || activeMs >= requiredMs) {
    return 100;
  }
  return Math.min(99, Math.floor((activeMs / requiredMs) * 100));
}
