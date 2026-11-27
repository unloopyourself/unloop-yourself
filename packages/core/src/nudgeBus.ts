import type { NudgeBusIntent, RelayPort } from "./nudge.js";

/** Opaque monitoring event id for mailbox + push correlation. */
export function createNudgeEventId(nowMs: number, random = Math.random): string {
  const rand = Math.floor(random() * 1e9)
    .toString(36)
    .padStart(6, "0");
  return `ev_${nowMs.toString(36)}_${rand}`;
}

export type NudgeLiveSession = {
  readonly eventId: string;
  readonly mailboxId: string;
  /** Wall-clock hint only (legacy); approaching is usage-driven. */
  readonly warnAtMs: number;
  /** Updated when approaching fires from remaining usage (Buddy lockout). */
  interruptAtMs: number;
  cancelled: boolean;
  approachingSent: boolean;
  interruptFetchSent: boolean;
};

export type NudgeBusClock = { now: () => number };

/**
 * Coordinates approaching → mailbox → cancel for one local monitoring stretch.
 * Network I/O stays on RelayPort (adapters).
 *
 * Approaching is driven by usage accumulation ({@link observeUsage}), not wall
 * clock — otherwise a long pause outside the feed would warn too early/late.
 */
export class NudgeBus {
  private session: NudgeLiveSession | null = null;

  constructor(
    private readonly relay: RelayPort,
    private readonly clock: NudgeBusClock = { now: () => Date.now() },
    private readonly mailboxTtlSec = 120,
  ) {}

  get active(): NudgeLiveSession | null {
    return this.session;
  }

  /**
   * Start a live window. `warnLeadMs` is stored for {@link observeUsage}.
   * `interruptAtMs` remains a soft wall-clock fallback for interrupt_fetch.
   */
  begin(input: {
    mailboxId: string;
    interruptAtMs: number;
    warnLeadMs: number;
    eventId?: string;
  }): NudgeLiveSession {
    const eventId = input.eventId ?? createNudgeEventId(this.clock.now());
    const warnAtMs = Math.max(
      this.clock.now(),
      input.interruptAtMs - Math.max(0, input.warnLeadMs),
    );
    this.session = {
      eventId,
      mailboxId: input.mailboxId,
      warnAtMs,
      interruptAtMs: input.interruptAtMs,
      cancelled: false,
      approachingSent: false,
      interruptFetchSent: false,
    };
    return this.session;
  }

  /**
   * Usage-driven intents. Call from the app tick with native accumulator state.
   * Emits `approaching` once when in a target feed and remaining time to
   * threshold is ≤ warnLeadMs (including warnLead ≥ threshold → as soon as
   * the feed is active).
   */
  observeUsage(input: {
    accumulatedMs: number;
    thresholdMs: number;
    warnLeadMs: number;
    inTargetFeed: boolean;
  }): NudgeBusIntent[] {
    const s = this.session;
    if (!s || s.cancelled) return [];
    if (!input.inTargetFeed) return [];
    const threshold = Math.max(0, input.thresholdMs);
    const warnLead = Math.max(0, input.warnLeadMs);
    const warnAfter = Math.max(0, threshold - warnLead);
    const out: NudgeBusIntent[] = [];
    if (!s.approachingSent && input.accumulatedMs >= warnAfter) {
      s.approachingSent = true;
      const now = this.clock.now();
      // Re-estimate interrupt wall-clock from remaining usage (Buddy lockout).
      s.interruptAtMs =
        now + Math.max(0, threshold - Math.max(0, input.accumulatedMs));
      out.push({
        type: "approaching",
        eventId: s.eventId,
        mailboxId: s.mailboxId,
        warnAtMs: now,
        interruptAtMs: s.interruptAtMs,
      });
    }
    if (
      !s.interruptFetchSent &&
      threshold > 0 &&
      input.accumulatedMs >= threshold
    ) {
      s.interruptFetchSent = true;
      out.push({
        type: "interrupt_fetch",
        eventId: s.eventId,
        mailboxId: s.mailboxId,
      });
    }
    return out;
  }

  /**
   * Wall-clock fallback tick (interrupt_fetch only). Prefer {@link observeUsage}.
   */
  tick(): NudgeBusIntent[] {
    const s = this.session;
    if (!s || s.cancelled) return [];
    const now = this.clock.now();
    const out: NudgeBusIntent[] = [];
    if (!s.interruptFetchSent && now >= s.interruptAtMs) {
      s.interruptFetchSent = true;
      out.push({
        type: "interrupt_fetch",
        eventId: s.eventId,
        mailboxId: s.mailboxId,
      });
    }
    return out;
  }

  async putNudge(ciphertext: string, ttlSec?: number): Promise<void> {
    const s = this.session;
    if (!s || s.cancelled) return;
    await this.relay.putMailbox(
      s.mailboxId,
      s.eventId,
      ciphertext,
      ttlSec ?? this.mailboxTtlSec,
    );
  }

  async fetchNudge(): Promise<string | null> {
    const s = this.session;
    if (!s || s.cancelled) return null;
    return this.relay.getMailbox(s.mailboxId, s.eventId);
  }

  async cancel(): Promise<NudgeBusIntent | null> {
    const s = this.session;
    if (!s || s.cancelled) return null;
    s.cancelled = true;
    await this.relay.cancelMailbox(s.mailboxId, s.eventId);
    return {
      type: "cancel",
      eventId: s.eventId,
      mailboxId: s.mailboxId,
    };
  }

  clear(): void {
    this.session = null;
  }
}
