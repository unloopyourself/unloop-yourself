/** Session lifecycle states (architecture: Session FSM). */
export type SessionState = "PAUSED" | "MONITORING" | "CHALLENGE" | "COOLDOWN";

/** Domain events that drive transitions (thresholds are events, not states). */
export type SessionEvent =
  | { type: "START_MONITORING" }
  | { type: "STOP" }
  | { type: "THRESHOLD_REACHED" }
  | { type: "CHALLENGE_COMPLETED" }
  | { type: "CHALLENGE_FAILED" }
  | { type: "COOLDOWN_ELAPSED" };

export class IllegalSessionTransitionError extends Error {
  constructor(
    readonly from: SessionState,
    readonly event: SessionEvent["type"],
  ) {
    super(`Illegal session transition: ${from} + ${event}`);
    this.name = "IllegalSessionTransitionError";
  }
}

const TABLE: Record<SessionState, Partial<Record<SessionEvent["type"], SessionState>>> = {
  PAUSED: {
    START_MONITORING: "MONITORING",
  },
  MONITORING: {
    STOP: "PAUSED",
    THRESHOLD_REACHED: "CHALLENGE",
  },
  CHALLENGE: {
    CHALLENGE_COMPLETED: "COOLDOWN",
    CHALLENGE_FAILED: "COOLDOWN",
    STOP: "PAUSED",
  },
  COOLDOWN: {
    COOLDOWN_ELAPSED: "MONITORING",
    STOP: "PAUSED",
  },
};

export function transition(state: SessionState, event: SessionEvent): SessionState {
  const next = TABLE[state][event.type];
  if (!next) {
    throw new IllegalSessionTransitionError(state, event.type);
  }
  return next;
}

export class SessionFsm {
  #state: SessionState;

  constructor(initial: SessionState = "PAUSED") {
    this.#state = initial;
  }

  get state(): SessionState {
    return this.#state;
  }

  dispatch(event: SessionEvent): SessionState {
    this.#state = transition(this.#state, event);
    return this.#state;
  }

  /**
   * Force state after process/Activity death when native monitor is still alive.
   * Not a domain transition — hydration only.
   */
  hydrate(state: SessionState): SessionState {
    this.#state = state;
    return this.#state;
  }
}
