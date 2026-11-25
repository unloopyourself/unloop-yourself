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
  readonly warnAtMs: number;
  readonly interruptAtMs: number;
  cancelled: boolean;
  approachingSent: boolean;
};

export type NudgeBusClock = { now: () => number };

/**
 * Coordinates approaching → mailbox → cancel for one local monitoring stretch.
 * Network I/O stays on RelayPort (adapters).
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
   * Start a live window. `warnLeadMs` before interrupt emits approaching intent
   * (caller/adapter turns that into push).
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
    };
    return this.session;
  }

  /** Tick: returns intents the adapter should act on (at most once each). */
  tick(): NudgeBusIntent[] {
    const s = this.session;
    if (!s || s.cancelled) return [];
    const now = this.clock.now();
    const out: NudgeBusIntent[] = [];
    if (!s.approachingSent && now >= s.warnAtMs) {
      s.approachingSent = true;
      out.push({
        type: "approaching",
        eventId: s.eventId,
        mailboxId: s.mailboxId,
        warnAtMs: s.warnAtMs,
      });
    }
    if (now >= s.interruptAtMs) {
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
