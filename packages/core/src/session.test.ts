import { describe, expect, it } from "vitest";
import {
  IllegalSessionTransitionError,
  SessionFsm,
  transition,
} from "./session.js";

describe("Session FSM", () => {
  it("follows the MVP happy path", () => {
    const fsm = new SessionFsm();
    expect(fsm.state).toBe("PAUSED");
    expect(fsm.dispatch({ type: "START_MONITORING" })).toBe("MONITORING");
    expect(fsm.dispatch({ type: "THRESHOLD_REACHED" })).toBe("CHALLENGE");
    expect(fsm.dispatch({ type: "CHALLENGE_COMPLETED" })).toBe("COOLDOWN");
    expect(fsm.dispatch({ type: "COOLDOWN_ELAPSED" })).toBe("MONITORING");
  });

  it("treats threshold as an event, not a state", () => {
    expect(transition("MONITORING", { type: "THRESHOLD_REACHED" })).toBe("CHALLENGE");
  });

  it("rejects illegal transitions", () => {
    expect(() => transition("PAUSED", { type: "THRESHOLD_REACHED" })).toThrow(
      IllegalSessionTransitionError,
    );
    expect(() => transition("COOLDOWN", { type: "THRESHOLD_REACHED" })).toThrow(
      IllegalSessionTransitionError,
    );
  });

  it("allows STOP from active states back to PAUSED", () => {
    expect(transition("MONITORING", { type: "STOP" })).toBe("PAUSED");
    expect(transition("CHALLENGE", { type: "STOP" })).toBe("PAUSED");
    expect(transition("COOLDOWN", { type: "STOP" })).toBe("PAUSED");
  });
});
