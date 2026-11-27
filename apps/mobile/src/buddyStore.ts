import AsyncStorage from "@react-native-async-storage/async-storage";
import type { BuddyRecord, PairInviteV0, PairRole } from "@unloop/core";
import {
  createPairInviteV0,
  encodePairDeepLink,
  isPairInviteFresh,
  parsePairInvite,
} from "@unloop/core";

const IDENTITY_KEY = "unloop.buddy.identity.v1";
const BUDDIES_KEY = "unloop.buddy.list.v1";

export type LocalBuddyIdentity = {
  mailboxId: string;
  pub: string;
};

function randomHex(byteLen: number): string {
  const bytes = new Uint8Array(byteLen);
  // expo / RN provide getRandomValues via global crypto in modern runtimes
  const c = globalThis.crypto;
  if (c?.getRandomValues) {
    c.getRandomValues(bytes);
  } else {
    for (let i = 0; i < byteLen; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function loadOrCreateIdentity(): Promise<LocalBuddyIdentity> {
  try {
    const raw = await AsyncStorage.getItem(IDENTITY_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<LocalBuddyIdentity>;
      if (
        typeof parsed.mailboxId === "string" &&
        parsed.mailboxId.length >= 16 &&
        typeof parsed.pub === "string" &&
        parsed.pub.length >= 16
      ) {
        return { mailboxId: parsed.mailboxId, pub: parsed.pub };
      }
    }
  } catch {
    // fall through
  }
  const identity: LocalBuddyIdentity = {
    mailboxId: `mb_${randomHex(16)}`,
    pub: `pub_${randomHex(16)}`,
  };
  await AsyncStorage.setItem(IDENTITY_KEY, JSON.stringify(identity));
  return identity;
}

export async function buildMyInvite(
  role: PairRole = "seeker",
  nowMs: number = Date.now(),
): Promise<{ invite: PairInviteV0; link: string }> {
  const identity = await loadOrCreateIdentity();
  const invite = createPairInviteV0({
    mailboxId: identity.mailboxId,
    pub: identity.pub,
    role,
    nowMs,
  });
  return { invite, link: encodePairDeepLink(invite) };
}

export async function loadBuddies(): Promise<BuddyRecord[]> {
  try {
    const raw = await AsyncStorage.getItem(BUDDIES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isBuddyRecord).map(normalizeBuddyRecord);
  } catch {
    return [];
  }
}

function isBuddyRecord(value: unknown): value is BuddyRecord {
  if (!value || typeof value !== "object") return false;
  const o = value as Record<string, unknown>;
  return (
    typeof o.buddyId === "string" &&
    typeof o.mailboxId === "string" &&
    typeof o.pub === "string" &&
    (o.role === "seeker" || o.role === "buddy") &&
    typeof o.pairedAtMs === "number"
  );
}

/** Normalize optional per-buddy seeker prefs (backward-compatible). */
export function normalizeBuddyRecord(raw: BuddyRecord): BuddyRecord {
  return {
    ...raw,
    notifyApproaching: raw.notifyApproaching === true,
    acceptNudges: raw.acceptNudges !== false,
  };
}

async function saveBuddies(list: BuddyRecord[]): Promise<void> {
  await AsyncStorage.setItem(BUDDIES_KEY, JSON.stringify(list));
}

export type AcceptInviteResult =
  | { ok: true; buddy: BuddyRecord; alreadyPaired: boolean }
  | { ok: false; reason: "invalid" | "expired" | "self" };

/** Accept a deep link / pasted invite into the local buddy list (no relay yet). */
export async function acceptInviteLink(
  input: string,
  nowMs: number = Date.now(),
): Promise<AcceptInviteResult> {
  const invite = parsePairInvite(input);
  if (!invite) return { ok: false, reason: "invalid" };
  if (!isPairInviteFresh(invite, nowMs)) return { ok: false, reason: "expired" };

  const me = await loadOrCreateIdentity();
  if (invite.mailboxId === me.mailboxId || invite.pub === me.pub) {
    return { ok: false, reason: "self" };
  }

  const existing = await loadBuddies();
  const found = existing.find(
    (b) => b.mailboxId === invite.mailboxId || b.pub === invite.pub,
  );
  if (found) return { ok: true, buddy: found, alreadyPaired: true };

  const buddy: BuddyRecord = normalizeBuddyRecord({
    buddyId: `b_${randomHex(8)}`,
    mailboxId: invite.mailboxId,
    pub: invite.pub,
    role: invite.role === "buddy" ? "buddy" : "seeker",
    pairedAtMs: nowMs,
    // Nickname is chosen in UI after accept (not the pub fingerprint).
    // Privacy default: no live approaching push until the seeker opts in.
    notifyApproaching: false,
    acceptNudges: true,
  });
  await saveBuddies([...existing, buddy]);
  return { ok: true, buddy, alreadyPaired: false };
}

export async function revokeBuddy(buddyId: string): Promise<BuddyRecord[]> {
  const next = (await loadBuddies()).filter((b) => b.buddyId !== buddyId);
  await saveBuddies(next);
  return next;
}

export type BuddyPrefsPatch = {
  readonly notifyApproaching?: boolean;
  readonly acceptNudges?: boolean;
  readonly displayLabel?: string;
};

/** Update seeker-side prefs for one paired buddy (no revoke). */
export async function updateBuddyPrefs(
  buddyId: string,
  patch: BuddyPrefsPatch,
): Promise<BuddyRecord[]> {
  const list = await loadBuddies();
  const next = list.map((b) => {
    if (b.buddyId !== buddyId) return b;
    return normalizeBuddyRecord({
      ...b,
      ...(patch.notifyApproaching !== undefined
        ? { notifyApproaching: patch.notifyApproaching }
        : {}),
      ...(patch.acceptNudges !== undefined
        ? { acceptNudges: patch.acceptNudges }
        : {}),
      ...(patch.displayLabel !== undefined
        ? {
            displayLabel: patch.displayLabel.trim().slice(0, 40) || undefined,
          }
        : {}),
    });
  });
  await saveBuddies(next);
  return next;
}

/** True when at least one buddy may contribute a mailbox nudge. */
export function anyBuddyAcceptsNudges(buddies: readonly BuddyRecord[]): boolean {
  return buddies.some((b) => b.acceptNudges !== false);
}

export function shortFingerprint(pub: string): string {
  const cleaned = pub.replace(/^pub_/, "");
  return cleaned.slice(0, 8).toUpperCase();
}

/** Prefer human nickname; fall back to short pub fingerprint. */
export function buddyDisplayName(buddy: BuddyRecord): string {
  const nick = buddy.displayLabel?.trim();
  if (nick) return nick.slice(0, 40);
  return shortFingerprint(buddy.pub);
}
