/**
 * Buddy pairing invite v0 (ADR-010).
 * Same payload for QR and deep link; no network required to encode/parse.
 */

export type PairRole = "seeker" | "buddy";

export interface PairInviteV0 {
  readonly v: 0;
  readonly mailboxId: string;
  readonly pub: string;
  readonly exp: number;
  readonly sig: string;
  readonly role?: PairRole;
}

export const PAIR_SCHEME = "unloop" as const;
export const PAIR_HOST = "pair" as const;

const TEXT_ENCODER = new TextEncoder();
const TEXT_DECODER = new TextDecoder();

function bytesToBase64Url(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
  const b64 =
    typeof btoa === "function"
      ? btoa(bin)
      : Buffer.from(bytes).toString("base64");
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlToBytes(input: string): Uint8Array | null {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/");
  const padLen = (4 - (padded.length % 4)) % 4;
  const b64 = padded + "=".repeat(padLen);
  try {
    const bin =
      typeof atob === "function"
        ? atob(b64)
        : Buffer.from(b64, "base64").toString("binary");
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

function isPairRole(value: unknown): value is PairRole {
  return value === "seeker" || value === "buddy";
}

/** Validate and normalize a parsed invite object. */
export function normalizePairInvite(raw: unknown): PairInviteV0 | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (o.v !== 0) return null;
  if (typeof o.mailboxId !== "string" || o.mailboxId.length < 8) return null;
  if (typeof o.pub !== "string" || o.pub.length < 8) return null;
  if (typeof o.exp !== "number" || !Number.isFinite(o.exp)) return null;
  if (typeof o.sig !== "string" || o.sig.length < 4) return null;
  if (o.role !== undefined && !isPairRole(o.role)) return null;
  const invite: PairInviteV0 = {
    v: 0,
    mailboxId: o.mailboxId,
    pub: o.pub,
    exp: o.exp,
    sig: o.sig,
  };
  if (o.role !== undefined) {
    return { ...invite, role: o.role };
  }
  return invite;
}

/** True if invite expiry is still in the future. */
export function isPairInviteFresh(invite: PairInviteV0, nowMs: number): boolean {
  return invite.exp > nowMs;
}

/** Encode invite as `unloop://pair?p=<base64url(json)>`. */
export function encodePairDeepLink(invite: PairInviteV0): string {
  const json = JSON.stringify(invite);
  const p = bytesToBase64Url(TEXT_ENCODER.encode(json));
  return `${PAIR_SCHEME}://${PAIR_HOST}?p=${p}`;
}

/**
 * Parse invite from deep link, raw `p=` payload, or JSON string.
 * Returns null if malformed (does not verify `sig` — crypto ADR later).
 */
export function parsePairInvite(input: string): PairInviteV0 | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  let payload = trimmed;
  if (trimmed.includes("://") || trimmed.startsWith("unloop:")) {
    try {
      const url = new URL(trimmed);
      if (url.protocol !== `${PAIR_SCHEME}:` && url.protocol !== "unloop:") {
        // Allow https pair hosts later: still accept ?p= or #p=
      }
      const fromQuery = url.searchParams.get("p");
      const hash = url.hash.startsWith("#") ? url.hash.slice(1) : url.hash;
      const hashParams = new URLSearchParams(hash.includes("=") ? hash : `p=${hash}`);
      payload = fromQuery ?? hashParams.get("p") ?? "";
      if (!payload) return null;
    } catch {
      return null;
    }
  } else if (trimmed.startsWith("{")) {
    try {
      return normalizePairInvite(JSON.parse(trimmed));
    } catch {
      return null;
    }
  }

  const bytes = base64UrlToBytes(payload);
  if (!bytes) return null;
  try {
    const json = TEXT_DECODER.decode(bytes);
    return normalizePairInvite(JSON.parse(json));
  } catch {
    return null;
  }
}

/** Local buddy record after successful handshake (store on device only). */
export interface BuddyRecord {
  readonly buddyId: string;
  readonly mailboxId: string;
  readonly pub: string;
  readonly role: PairRole;
  readonly pairedAtMs: number;
  readonly displayLabel?: string;
  /**
   * Seeker (scrolldoomer) opt-in: send approaching push to this buddy.
   * Default **false** — live push is not imposed (privacy / no “tracking”).
   * When false, this buddy will not get a live approaching ping; they can
   * still have been paired, and the seeker may still accept mailbox nudges
   * if {@link acceptNudges} is on (e.g. content already in the mailbox).
   */
  readonly notifyApproaching?: boolean;
  /**
   * Seeker: show mailbox nudges from the Buddy path for this pairing.
   * Default **true**. Set false to suspend without revoking the pair.
   */
  readonly acceptNudges?: boolean;
}

/** Build a v0 invite (sig is placeholder until crypto ADR). */
export function createPairInviteV0(input: {
  mailboxId: string;
  pub: string;
  role?: PairRole;
  /** Absolute expiry epoch ms. Default: now + 24h. */
  exp?: number;
  nowMs?: number;
  sig?: string;
}): PairInviteV0 {
  const nowMs = input.nowMs ?? Date.now();
  const invite: PairInviteV0 = {
    v: 0,
    mailboxId: input.mailboxId,
    pub: input.pub,
    exp: input.exp ?? nowMs + 24 * 60 * 60 * 1000,
    sig: input.sig ?? "local-v0-unsigned",
  };
  if (input.role) return { ...invite, role: input.role };
  return invite;
}
