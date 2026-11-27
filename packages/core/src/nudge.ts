import type { Capability } from "./challenge.js";

/**
 * Interrupt cascade providers (ADR-010).
 * Ordered preference is fixed; Settings gate which providers run.
 */
export type NudgeProviderId = "human_buddy" | "ai_companion" | "embedded_challenges";

export type NudgeKind =
  | "text"
  | "voice"
  | "photo"
  | "gif"
  | "video"
  | "sound_preset"
  | "opaque";

/** Opaque or stub nudge shown instead of (or before) a local challenge. */
export interface NudgePayload {
  readonly providerId: NudgeProviderId;
  readonly eventId: string;
  readonly kind: NudgeKind;
  /** Ciphertext or local stub text — Core never decrypts relay blobs. */
  readonly body: string;
  readonly createdAtMs: number;
}

export interface NudgeFetchContext {
  readonly eventId: string;
  readonly availableCapabilities: ReadonlySet<Capability>;
  readonly nowMs: number;
}

/** Swappable nudge source. Missing data ⇒ null (fall through). */
export interface NudgeProvider {
  readonly id: NudgeProviderId;
  /** Device capabilities required for this provider to be asked. */
  readonly requires: ReadonlySet<Capability>;
  fetchForEvent(ctx: NudgeFetchContext): Promise<NudgePayload | null>;
}

export type CascadeOutcome =
  | { readonly kind: "nudge"; readonly payload: NudgePayload }
  | { readonly kind: "challenges" };

export interface CascadeInput {
  readonly eventId: string;
  readonly availableCapabilities: ReadonlySet<Capability>;
  readonly nowMs: number;
  /**
   * Providers in preference order excluding embedded challenges.
   * Default order: human buddy → AI stub.
   */
  readonly providers: readonly NudgeProvider[];
  /** When false, skip all providers and use challenges. */
  readonly cascadeEnabled?: boolean;
}

function providerEligible(
  provider: NudgeProvider,
  available: ReadonlySet<Capability>,
): boolean {
  for (const cap of provider.requires) {
    if (!available.has(cap)) return false;
  }
  return true;
}

/**
 * Resolve interrupt content: first eligible provider with a payload wins;
 * otherwise fall through to embedded challenges.
 */
export async function resolveInterruptCascade(
  input: CascadeInput,
): Promise<CascadeOutcome> {
  if (input.cascadeEnabled === false) {
    return { kind: "challenges" };
  }
  for (const provider of input.providers) {
    if (!providerEligible(provider, input.availableCapabilities)) continue;
    const payload = await provider.fetchForEvent({
      eventId: input.eventId,
      availableCapabilities: input.availableCapabilities,
      nowMs: input.nowMs,
    });
    if (payload) return { kind: "nudge", payload };
  }
  return { kind: "challenges" };
}

/** Phase 3 AI Companion — always no-op (real behaviour is Phase 4). */
export class AiCompanionProvider implements NudgeProvider {
  readonly id = "ai_companion" as const;
  readonly requires: ReadonlySet<Capability> = new Set();

  async fetchForEvent(_ctx: NudgeFetchContext): Promise<NudgePayload | null> {
    return null;
  }
}

/** Human Buddy provider that reads an opaque mailbox blob for the event. */
export class HumanBuddyProvider implements NudgeProvider {
  readonly id = "human_buddy" as const;
  readonly requires: ReadonlySet<Capability> = new Set(["buddy"]);

  constructor(
    private readonly fetchBlob: (
      eventId: string,
    ) => Promise<{ body: string; kind?: NudgeKind; createdAtMs?: number } | null>,
  ) {}

  async fetchForEvent(ctx: NudgeFetchContext): Promise<NudgePayload | null> {
    const blob = await this.fetchBlob(ctx.eventId);
    if (!blob) return null;
    return {
      providerId: "human_buddy",
      eventId: ctx.eventId,
      kind: blob.kind ?? "opaque",
      body: blob.body,
      createdAtMs: blob.createdAtMs ?? ctx.nowMs,
    };
  }
}

/** NudgeBus lifecycle intents (adapters emit / relay forwards). */
export type NudgeBusIntent =
  | {
      readonly type: "approaching";
      readonly eventId: string;
      readonly mailboxId: string;
      readonly warnAtMs: number;
      /** Estimated wall-clock interrupt for Buddy lockout (~T−lockoutLead). */
      readonly interruptAtMs: number;
    }
  | {
      readonly type: "cancel";
      readonly eventId: string;
      readonly mailboxId: string;
    }
  | {
      readonly type: "interrupt_fetch";
      readonly eventId: string;
      readonly mailboxId: string;
    };

/** Stateless relay postman (ADR-006 / ADR-010). Opaque blobs only. */
export interface RelayPort {
  putMailbox(
    mailboxId: string,
    eventId: string,
    ciphertext: string,
    ttlSec: number,
  ): Promise<void>;
  getMailbox(mailboxId: string, eventId: string): Promise<string | null>;
  cancelMailbox(mailboxId: string, eventId: string): Promise<void>;
  registerPushToken(mailboxId: string, token: string): Promise<void>;
  forgetPushToken(mailboxId: string): Promise<void>;
}

/** Push transport abstraction; FCM is the first Android adapter. */
export interface PushPort {
  /** Obtain a device push token for relay registration. */
  getToken(): Promise<string | null>;
}

export interface InMemoryMailboxEntry {
  readonly ciphertext: string;
  readonly expiresAtMs: number;
}

/** In-memory RelayPort for Core tests (TTL enforced via injected now). */
export class InMemoryRelayPort implements RelayPort {
  private readonly mailboxes = new Map<string, InMemoryMailboxEntry>();
  private readonly tokens = new Map<string, string>();
  private nowMs: () => number;

  constructor(nowMs: () => number = () => Date.now()) {
    this.nowMs = nowMs;
  }

  setClock(nowMs: () => number): void {
    this.nowMs = nowMs;
  }

  private key(mailboxId: string, eventId: string): string {
    return `${mailboxId}::${eventId}`;
  }

  async putMailbox(
    mailboxId: string,
    eventId: string,
    ciphertext: string,
    ttlSec: number,
  ): Promise<void> {
    this.mailboxes.set(this.key(mailboxId, eventId), {
      ciphertext,
      expiresAtMs: this.nowMs() + ttlSec * 1000,
    });
  }

  async getMailbox(mailboxId: string, eventId: string): Promise<string | null> {
    const entry = this.mailboxes.get(this.key(mailboxId, eventId));
    if (!entry) return null;
    if (entry.expiresAtMs <= this.nowMs()) {
      this.mailboxes.delete(this.key(mailboxId, eventId));
      return null;
    }
    return entry.ciphertext;
  }

  async cancelMailbox(mailboxId: string, eventId: string): Promise<void> {
    this.mailboxes.delete(this.key(mailboxId, eventId));
  }

  async registerPushToken(mailboxId: string, token: string): Promise<void> {
    this.tokens.set(mailboxId, token);
  }

  async forgetPushToken(mailboxId: string): Promise<void> {
    this.tokens.delete(mailboxId);
  }

  /** Test helper — not part of RelayPort. */
  peekToken(mailboxId: string): string | undefined {
    return this.tokens.get(mailboxId);
  }
}

export class NullPushPort implements PushPort {
  async getToken(): Promise<string | null> {
    return null;
  }
}
