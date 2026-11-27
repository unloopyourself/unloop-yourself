import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";
import {
  decodeNudgeEnvelope,
  encodeNudgeEnvelope,
  nextRoundRobinIndex,
  NUDGE_CAPS,
  textNudgeEnvelope,
  type NudgeMediaInline,
  type SoundPresetId,
} from "@unloop/core";
import { isSoundPresetId } from "./buddySoundPresets";

const STAGED_KEY_V1 = "unloop.buddy.staged.v1";
const STAGED_KEY = "unloop.buddy.staged.v2";
const PENDING_KEY = "unloop.buddy.pendingApproach.v1";
const STAGED_RR_KEY = "unloop.buddy.stagedRr.v1";
const AUTO_SENT_KEY = "unloop.buddy.autoSentEvents.v1";
const MAX_STAGED = 12;
const MAX_MEDIA_STAGED = 5;

export type StagedNudgeKind =
  | "text"
  | "photo"
  | "gif"
  | "voice"
  | "video"
  | "sound_preset";

export type StagedNudge = {
  readonly id: string;
  readonly kind: StagedNudgeKind;
  readonly createdAtMs: number;
  /** Text body or optional caption for media/preset. */
  readonly body?: string;
  readonly presetId?: SoundPresetId;
  /** On-device file with base64 payload (not uploaded until send). */
  readonly mediaPath?: string;
  readonly mime?: string;
  readonly byteLength?: number;
  readonly durationMs?: number;
};

/** Approaching event B should answer (from push / local). */
export type PendingApproach = {
  readonly eventId: string;
  /** Seeker's mailbox — where B uploads the nudge ciphertext/text. */
  readonly mailboxId: string;
  readonly receivedAtMs: number;
  /** Estimated U interrupt (wall-clock) for lockout; optional on legacy pushes. */
  readonly interruptAtMs?: number;
};

function isStagedKind(v: unknown): v is StagedNudgeKind {
  return (
    v === "text" ||
    v === "photo" ||
    v === "gif" ||
    v === "voice" ||
    v === "video" ||
    v === "sound_preset"
  );
}

function parseStaged(x: unknown): StagedNudge | null {
  if (!x || typeof x !== "object") return null;
  const o = x as Record<string, unknown>;
  if (typeof o.id !== "string" || typeof o.createdAtMs !== "number") return null;

  // v1 text-only rows: { id, body, createdAtMs }
  if (!("kind" in o) && typeof o.body === "string") {
    return {
      id: o.id,
      kind: "text",
      body: o.body,
      createdAtMs: o.createdAtMs,
    };
  }

  if (!isStagedKind(o.kind)) return null;
  const body = typeof o.body === "string" ? o.body : undefined;
  const presetId =
    typeof o.presetId === "string" && isSoundPresetId(o.presetId)
      ? o.presetId
      : undefined;
  const mediaPath = typeof o.mediaPath === "string" ? o.mediaPath : undefined;
  const mime = typeof o.mime === "string" ? o.mime : undefined;
  const byteLength =
    typeof o.byteLength === "number" ? o.byteLength : undefined;
  const durationMs =
    typeof o.durationMs === "number" ? o.durationMs : undefined;

  if (o.kind === "text" && !body?.trim()) return null;
  if (o.kind === "sound_preset" && !presetId) return null;
  if (
    (o.kind === "photo" ||
      o.kind === "gif" ||
      o.kind === "voice" ||
      o.kind === "video") &&
    (!mediaPath || !mime)
  ) {
    return null;
  }

  return {
    id: o.id,
    kind: o.kind,
    createdAtMs: o.createdAtMs,
    ...(body ? { body } : {}),
    ...(presetId ? { presetId } : {}),
    ...(mediaPath ? { mediaPath } : {}),
    ...(mime ? { mime } : {}),
    ...(byteLength != null ? { byteLength } : {}),
    ...(durationMs != null ? { durationMs } : {}),
  };
}

async function stagedDir(): Promise<string> {
  const root = FileSystem.documentDirectory;
  if (!root) throw new Error("no_document_dir");
  const dir = `${root}buddy-staged/`;
  const info = await FileSystem.getInfoAsync(dir);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  }
  return dir;
}

function extForMime(mime: string): string {
  if (mime.includes("webm")) return "webm";
  if (mime.includes("gif")) return "gif";
  if (mime.includes("png")) return "png";
  if (mime.includes("jpeg") || mime.includes("jpg")) return "jpg";
  if (mime.startsWith("audio/")) return "m4a";
  if (mime.startsWith("video/")) return "mp4";
  return "bin";
}

/** Write base64 payload as a real media file (not UTF-8 text of base64). */
async function writeStagedMediaFile(
  id: string,
  mime: string,
  data: string,
): Promise<string> {
  const dir = await stagedDir();
  const path = `${dir}${id}.${extForMime(mime)}`;
  await FileSystem.writeAsStringAsync(path, data, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return path;
}

async function deleteStagedMediaFile(path: string | undefined): Promise<void> {
  if (!path) return;
  try {
    const info = await FileSystem.getInfoAsync(path);
    if (info.exists) await FileSystem.deleteAsync(path, { idempotent: true });
  } catch {
    /* best-effort */
  }
}

export async function loadStagedNudges(): Promise<StagedNudge[]> {
  try {
    let raw = await AsyncStorage.getItem(STAGED_KEY);
    if (!raw) {
      raw = await AsyncStorage.getItem(STAGED_KEY_V1);
      if (raw) {
        await AsyncStorage.setItem(STAGED_KEY, raw);
        await AsyncStorage.removeItem(STAGED_KEY_V1);
      }
    }
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.map(parseStaged).filter((x): x is StagedNudge => x != null);
  } catch {
    return [];
  }
}

export async function saveStagedNudges(list: StagedNudge[]): Promise<void> {
  await AsyncStorage.setItem(STAGED_KEY, JSON.stringify(list.slice(0, MAX_STAGED)));
}

function newStagedId(): string {
  return `sn_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

async function prependStaged(next: StagedNudge): Promise<StagedNudge[]> {
  const list = await loadStagedNudges();
  const mediaCount = list.filter(
    (n) =>
      n.kind === "photo" ||
      n.kind === "gif" ||
      n.kind === "voice" ||
      n.kind === "video",
  ).length;
  const nextIsMedia =
    next.kind === "photo" ||
    next.kind === "gif" ||
    next.kind === "voice" ||
    next.kind === "video";
  if (nextIsMedia && mediaCount >= MAX_MEDIA_STAGED) {
    // Drop oldest media to make room.
    const oldestMedia = [...list]
      .reverse()
      .find(
        (n) =>
          n.kind === "photo" ||
          n.kind === "gif" ||
          n.kind === "voice" ||
          n.kind === "video",
      );
    if (oldestMedia) {
      await deleteStagedMediaFile(oldestMedia.mediaPath);
      const trimmed = list.filter((n) => n.id !== oldestMedia.id);
      const out = [next, ...trimmed].slice(0, MAX_STAGED);
      await saveStagedNudges(out);
      return out;
    }
  }
  const out = [next, ...list].slice(0, MAX_STAGED);
  // Evict overflow media files when slicing.
  const kept = new Set(out.map((n) => n.id));
  for (const old of list) {
    if (!kept.has(old.id)) await deleteStagedMediaFile(old.mediaPath);
  }
  await saveStagedNudges(out);
  return out;
}

/** Text-only staged nudge (v1 helper name kept). */
export async function addStagedNudge(body: string): Promise<StagedNudge[]> {
  const trimmed = body.trim().slice(0, NUDGE_CAPS.textChars);
  if (!trimmed) return loadStagedNudges();
  return prependStaged({
    id: newStagedId(),
    kind: "text",
    body: trimmed,
    createdAtMs: Date.now(),
  });
}

export async function addStagedPreset(
  presetId: SoundPresetId,
  caption?: string,
): Promise<StagedNudge[]> {
  const body = caption?.trim().slice(0, NUDGE_CAPS.textChars) || undefined;
  return prependStaged({
    id: newStagedId(),
    kind: "sound_preset",
    presetId,
    createdAtMs: Date.now(),
    ...(body ? { body } : {}),
  });
}

export async function addStagedMedia(input: {
  kind: "photo" | "gif" | "voice" | "video";
  media: NudgeMediaInline;
  durationMs?: number;
  caption?: string;
}): Promise<StagedNudge[]> {
  const id = newStagedId();
  const mediaPath = await writeStagedMediaFile(
    id,
    input.media.mime,
    input.media.data,
  );
  const body = input.caption?.trim().slice(0, NUDGE_CAPS.textChars) || undefined;
  return prependStaged({
    id,
    kind: input.kind,
    createdAtMs: Date.now(),
    mediaPath,
    mime: input.media.mime,
    byteLength: input.media.byteLength,
    ...(input.durationMs != null ? { durationMs: input.durationMs } : {}),
    ...(body ? { body } : {}),
  });
}

export async function removeStagedNudge(id: string): Promise<StagedNudge[]> {
  const list = await loadStagedNudges();
  const target = list.find((n) => n.id === id);
  if (target) await deleteStagedMediaFile(target.mediaPath);
  const out = list.filter((n) => n.id !== id);
  await saveStagedNudges(out);
  return out;
}

async function readStagedMedia(
  path: string,
  mime: string,
  byteLengthHint?: number,
): Promise<NudgeMediaInline | null> {
  try {
    // Legacy rows used UTF-8 files of base64 characters (*.b64).
    const legacyText = path.endsWith(".b64");
    const data = await FileSystem.readAsStringAsync(path, {
      encoding: legacyText
        ? FileSystem.EncodingType.UTF8
        : FileSystem.EncodingType.Base64,
    });
    if (!data) return null;
    const info = await FileSystem.getInfoAsync(path);
    const fileSize =
      info.exists && !info.isDirectory && typeof info.size === "number"
        ? info.size
        : 0;
    const byteLength =
      !legacyText && fileSize > 0
        ? fileSize
        : byteLengthHint && byteLengthHint > 0
          ? byteLengthHint
          : Math.floor((data.length * 3) / 4);
    return {
      encoding: "base64",
      mime,
      byteLength,
      data,
    };
  } catch {
    return null;
  }
}

/** Local file URI for Image / VideoView thumbnails (binary staged files). */
export async function stagedMediaFileUri(
  staged: StagedNudge,
): Promise<string | null> {
  if (!staged.mediaPath || !staged.mime) return null;
  if (staged.mediaPath.endsWith(".b64")) {
    // Materialize a binary cache file for preview.
    const media = await readStagedMedia(
      staged.mediaPath,
      staged.mime,
      staged.byteLength,
    );
    if (!media) return null;
    const dir = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
    if (!dir) return null;
    const path = `${dir}staged-preview-${staged.id}.${extForMime(staged.mime)}`;
    await FileSystem.writeAsStringAsync(path, media.data, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return path;
  }
  const info = await FileSystem.getInfoAsync(staged.mediaPath);
  return info.exists ? staged.mediaPath : null;
}

/** Build a mailbox ciphertext from a staged row (reads media file if needed). */
export async function encodeStagedNudgeCipher(
  staged: StagedNudge,
): Promise<string | null> {
  const atMs = Date.now();
  const caption = staged.body?.trim() || undefined;

  if (staged.kind === "text") {
    if (!caption) return null;
    return encodeNudgeEnvelope(textNudgeEnvelope(caption));
  }

  if (staged.kind === "sound_preset") {
    if (!staged.presetId) return null;
    return encodeNudgeEnvelope({
      v: 1,
      kind: "sound_preset",
      atMs,
      presetId: staged.presetId,
      ...(caption ? { text: caption } : {}),
    });
  }

  if (!staged.mediaPath || !staged.mime) return null;
  const media = await readStagedMedia(
    staged.mediaPath,
    staged.mime,
    staged.byteLength,
  );
  if (!media) return null;

  return encodeNudgeEnvelope({
    v: 1,
    kind: staged.kind,
    atMs,
    ...(caption ? { text: caption } : {}),
    ...(staged.durationMs != null ? { durationMs: staged.durationMs } : {}),
    media,
  });
}

export function stagedNudgeSummary(staged: StagedNudge): string {
  if (staged.kind === "text") return staged.body ?? "";
  if (staged.kind === "sound_preset") {
    return staged.presetId ?? "sound_preset";
  }
  const caption = staged.body?.trim();
  return caption || staged.kind;
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
      ...(typeof o.interruptAtMs === "number"
        ? { interruptAtMs: o.interruptAtMs }
        : {}),
    };
  } catch {
    return null;
  }
}

/** Round-robin next staged nudge (mutates RR cursor). */
export async function pickNextStagedRoundRobin(): Promise<StagedNudge | null> {
  const list = await loadStagedNudges();
  if (list.length === 0) return null;
  let lastId: string | null = null;
  try {
    lastId = await AsyncStorage.getItem(STAGED_RR_KEY);
  } catch {
    lastId = null;
  }
  const lastIndex = lastId ? list.findIndex((n) => n.id === lastId) : -1;
  const nextIndex = nextRoundRobinIndex(list.length, lastIndex);
  if (nextIndex < 0) return null;
  const next = list[nextIndex]!;
  try {
    await AsyncStorage.setItem(STAGED_RR_KEY, next.id);
  } catch {
    /* best-effort */
  }
  return next;
}

/**
 * Build ciphertext for auto-send: next staged (RR) or default text fallback.
 * Returns null if library empty and default blank.
 */
export async function buildAutoSendCipher(
  defaultNudge: string,
): Promise<string | null> {
  const staged = await pickNextStagedRoundRobin();
  if (staged) {
    try {
      return await encodeStagedNudgeCipher(staged);
    } catch {
      /* fall through to default text */
    }
  }
  const text = defaultNudge.trim();
  if (!text) return null;
  return encodeNudgeBlob(text);
}

/** Dedup silent/lockout auto-sends per eventId (process + storage). */
export async function claimAutoSendEvent(eventId: string): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(AUTO_SENT_KEY);
    const prev: string[] = raw ? (JSON.parse(raw) as string[]) : [];
    const list = Array.isArray(prev) ? prev.filter((x) => typeof x === "string") : [];
    if (list.includes(eventId)) return false;
    list.push(eventId);
    await AsyncStorage.setItem(
      AUTO_SENT_KEY,
      JSON.stringify(list.slice(-40)),
    );
    return true;
  } catch {
    return true;
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

type PushLogEntry = { readonly atMs: number; readonly eventId?: string };

function parsePushLog(raw: string | null): PushLogEntry[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((x): PushLogEntry | null => {
        if (typeof x === "number" && Number.isFinite(x)) {
          return { atMs: x };
        }
        if (
          x &&
          typeof x === "object" &&
          typeof (x as PushLogEntry).atMs === "number"
        ) {
          const eventId = (x as PushLogEntry).eventId;
          return {
            atMs: (x as PushLogEntry).atMs,
            ...(typeof eventId === "string" ? { eventId } : {}),
          };
        }
        return null;
      })
      .filter((x): x is PushLogEntry => x != null);
  } catch {
    return [];
  }
}

/**
 * Buddy-side hourly cap (how often this phone will surface approaching
 * nudges). Dedupes by `eventId` so FCM redeliveries do not burn the quota.
 * Returns false when over cap for a new event.
 */
export async function allowApproachingPush(
  maxPerHour: number,
  nowMs: number = Date.now(),
  eventId?: string,
): Promise<boolean> {
  try {
    const prev = parsePushLog(await AsyncStorage.getItem(PUSH_LOG_KEY));
    const windowStart = nowMs - 60 * 60 * 1000;
    const recent = prev.filter((e) => e.atMs >= windowStart);
    if (eventId && recent.some((e) => e.eventId === eventId)) {
      // Same approaching event — allow UI reopen without consuming another slot.
      return true;
    }
    if (recent.length >= maxPerHour) return false;
    recent.push({
      atMs: nowMs,
      ...(eventId ? { eventId } : {}),
    });
    await AsyncStorage.setItem(PUSH_LOG_KEY, JSON.stringify(recent.slice(-40)));
    return true;
  } catch {
    return true;
  }
}
