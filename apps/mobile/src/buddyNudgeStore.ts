import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  decodeNudgeEnvelope,
  encodeNudgeEnvelope,
  textNudgeEnvelope,
} from "@unloop/core";

const STAGED_KEY = "unloop.buddy.staged.v1";
const PENDING_KEY = "unloop.buddy.pendingApproach.v1";

export type StagedNudge = {
  readonly id: string;
  readonly body: string;
  readonly createdAtMs: number;
};

/** Approaching event B should answer (from push / local). */
export type PendingApproach = {
  readonly eventId: string;
  /** Seeker's mailbox — where B uploads the nudge ciphertext/text. */
  readonly mailboxId: string;
  readonly receivedAtMs: number;
};

export async function loadStagedNudges(): Promise<StagedNudge[]> {
  try {
    const raw = await AsyncStorage.getItem(STAGED_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (x): x is StagedNudge =>
        !!x &&
        typeof x === "object" &&
        typeof (x as StagedNudge).id === "string" &&
        typeof (x as StagedNudge).body === "string",
    );
  } catch {
    return [];
  }
}

export async function saveStagedNudges(list: StagedNudge[]): Promise<void> {
  await AsyncStorage.setItem(STAGED_KEY, JSON.stringify(list.slice(0, 20)));
}

export async function addStagedNudge(body: string): Promise<StagedNudge[]> {
  const trimmed = body.trim().slice(0, 280);
  if (!trimmed) return loadStagedNudges();
  const list = await loadStagedNudges();
  const next: StagedNudge = {
    id: `sn_${Date.now().toString(36)}`,
    body: trimmed,
    createdAtMs: Date.now(),
  };
  const out = [next, ...list].slice(0, 20);
  await saveStagedNudges(out);
  return out;
}

export async function removeStagedNudge(id: string): Promise<StagedNudge[]> {
  const out = (await loadStagedNudges()).filter((n) => n.id !== id);
  await saveStagedNudges(out);
  return out;
}

export async function setPendingApproach(
  pending: PendingApproach | null,
): Promise<void> {
  if (!pending) {
    await AsyncStorage.removeItem(PENDING_KEY);
    return;
  }
  await AsyncStorage.setItem(PENDING_KEY, JSON.stringify(pending));
}

export async function loadPendingApproach(): Promise<PendingApproach | null> {
  try {
    const raw = await AsyncStorage.getItem(PENDING_KEY);
    if (!raw) return null;
    const o = JSON.parse(raw) as Partial<PendingApproach>;
    if (
      typeof o.eventId !== "string" ||
      typeof o.mailboxId !== "string" ||
      typeof o.receivedAtMs !== "number"
    ) {
      return null;
    }
    return {
      eventId: o.eventId,
      mailboxId: o.mailboxId,
      receivedAtMs: o.receivedAtMs,
    };
  } catch {
    return null;
  }
}

/** Mailbox payload via Core envelope v1 (legacy v0 text still decodes). */
export function encodeNudgeBlob(text: string): string {
  return encodeNudgeEnvelope(textNudgeEnvelope(text));
}

export function decodeNudgeBlob(raw: string): {
  kind: string;
  body: string;
  presetId?: string;
  media?: { mime: string; data: string };
} | null {
  const parsed = decodeNudgeEnvelope(raw);
  if (!parsed.ok) return null;
  const e = parsed.envelope;
  const body = (e.text ?? "").trim();
  // Text-only path requires body; media/preset may rely on kind (+ optional caption).
  if (e.kind === "text" && !body) return null;
  return {
    kind: e.kind,
    body: body || e.presetId || e.kind,
    ...(e.presetId ? { presetId: e.presetId } : {}),
    ...(e.media
      ? { media: { mime: e.media.mime, data: e.media.data } }
      : {}),
  };
}

const PUSH_LOG_KEY = "unloop.buddy.pushLog.v1";

/** Returns true if under the hourly cap (and records this attempt). */
export async function allowApproachingPush(
  maxPerHour: number,
  nowMs: number = Date.now(),
): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(PUSH_LOG_KEY);
    const prev: number[] = raw ? (JSON.parse(raw) as number[]) : [];
    const windowStart = nowMs - 60 * 60 * 1000;
    const recent = prev.filter((t) => t >= windowStart);
    if (recent.length >= maxPerHour) return false;
    recent.push(nowMs);
    await AsyncStorage.setItem(PUSH_LOG_KEY, JSON.stringify(recent.slice(-40)));
    return true;
  } catch {
    return true;
  }
}
