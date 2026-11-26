import type { NudgeKind } from "./nudge.js";

/** Mailbox envelope schema version (Phase 3.5). */
export const NUDGE_ENVELOPE_V = 1 as const;

/** Hard caps — no 4K raw; encode on device before upload. */
export const NUDGE_CAPS = {
  textChars: 500,
  photoBytes: 2 * 1024 * 1024,
  gifBytes: 2 * 1024 * 1024,
  voiceBytes: 1 * 1024 * 1024,
  voiceMaxMs: 30_000,
  videoBytes: 8 * 1024 * 1024,
  videoMaxMs: 10_000,
  /** Max serialized mailbox string (UTF-8 length). */
  envelopeBytes: 8 * 1024 * 1024,
} as const;

export const SOUND_PRESET_IDS = [
  "ship_horn",
  "truck_horn",
  "hell_yeah",
] as const;

export type SoundPresetId = (typeof SOUND_PRESET_IDS)[number];

export type NudgeMediaInline = {
  readonly encoding: "base64";
  readonly mime: string;
  /** Raw byte length before base64 (for cap checks). */
  readonly byteLength: number;
  readonly data: string;
};

export type NudgeEnvelopeV1 = {
  readonly v: typeof NUDGE_ENVELOPE_V;
  readonly kind: Exclude<NudgeKind, "opaque">;
  readonly atMs: number;
  /** Optional caption / standalone text. */
  readonly text?: string;
  readonly media?: NudgeMediaInline;
  readonly presetId?: SoundPresetId;
  /** Duration hint for voice/video (ms). */
  readonly durationMs?: number;
};

export type NudgeEnvelopeParse =
  | { readonly ok: true; readonly envelope: NudgeEnvelopeV1 }
  | { readonly ok: false; readonly error: string };

const KIND_SET = new Set<string>([
  "text",
  "voice",
  "photo",
  "gif",
  "video",
  "sound_preset",
]);

const PRESET_SET = new Set<string>(SOUND_PRESET_IDS);

function utf8ByteLength(s: string): number {
  return new TextEncoder().encode(s).length;
}

function clampText(text: string | undefined): string | undefined {
  if (text == null) return undefined;
  const t = text.trim();
  if (!t) return undefined;
  return t.slice(0, NUDGE_CAPS.textChars);
}

function mediaCapFor(kind: NudgeEnvelopeV1["kind"]): number | null {
  switch (kind) {
    case "photo":
      return NUDGE_CAPS.photoBytes;
    case "gif":
      return NUDGE_CAPS.gifBytes;
    case "voice":
      return NUDGE_CAPS.voiceBytes;
    case "video":
      return NUDGE_CAPS.videoBytes;
    default:
      return null;
  }
}

/**
 * Validate a v1 envelope (structure + caps). Does not check base64 integrity.
 */
export function validateNudgeEnvelope(
  env: NudgeEnvelopeV1,
): NudgeEnvelopeParse {
  if (env.v !== NUDGE_ENVELOPE_V) {
    return { ok: false, error: "unsupported_version" };
  }
  if (!KIND_SET.has(env.kind)) {
    return { ok: false, error: "bad_kind" };
  }
  if (!Number.isFinite(env.atMs) || env.atMs <= 0) {
    return { ok: false, error: "bad_atMs" };
  }

  const text = clampText(env.text);
  if (env.text != null && env.text.trim() && !text) {
    return { ok: false, error: "empty_text" };
  }
  if (env.text != null && env.text.length > NUDGE_CAPS.textChars) {
    return { ok: false, error: "text_too_long" };
  }

  if (env.kind === "text") {
    if (!text) return { ok: false, error: "text_required" };
    if (env.media || env.presetId) {
      return { ok: false, error: "text_no_media" };
    }
  }

  if (env.kind === "sound_preset") {
    if (!env.presetId || !PRESET_SET.has(env.presetId)) {
      return { ok: false, error: "bad_preset" };
    }
    if (env.media) return { ok: false, error: "preset_no_media" };
  }

  const needsMedia =
    env.kind === "photo" ||
    env.kind === "gif" ||
    env.kind === "voice" ||
    env.kind === "video";
  if (needsMedia) {
    if (!env.media) return { ok: false, error: "media_required" };
    if (env.media.encoding !== "base64") {
      return { ok: false, error: "bad_encoding" };
    }
    if (!env.media.mime || !env.media.data) {
      return { ok: false, error: "bad_media" };
    }
    if (
      !Number.isFinite(env.media.byteLength) ||
      env.media.byteLength <= 0
    ) {
      return { ok: false, error: "bad_byteLength" };
    }
    const cap = mediaCapFor(env.kind);
    if (cap != null && env.media.byteLength > cap) {
      return { ok: false, error: "media_too_large" };
    }
  }

  if (env.kind === "voice") {
    if (
      env.durationMs != null &&
      (env.durationMs <= 0 || env.durationMs > NUDGE_CAPS.voiceMaxMs)
    ) {
      return { ok: false, error: "voice_too_long" };
    }
  }
  if (env.kind === "video") {
    if (
      env.durationMs != null &&
      (env.durationMs <= 0 || env.durationMs > NUDGE_CAPS.videoMaxMs)
    ) {
      return { ok: false, error: "video_too_long" };
    }
  }

  // Photo/GIF/voice/video may include optional caption (composed).
  const normalized: NudgeEnvelopeV1 = {
    v: NUDGE_ENVELOPE_V,
    kind: env.kind,
    atMs: env.atMs,
    ...(text ? { text } : {}),
    ...(env.media ? { media: env.media } : {}),
    ...(env.presetId ? { presetId: env.presetId } : {}),
    ...(env.durationMs != null ? { durationMs: env.durationMs } : {}),
  };

  const serialized = JSON.stringify(normalized);
  if (utf8ByteLength(serialized) > NUDGE_CAPS.envelopeBytes) {
    return { ok: false, error: "envelope_too_large" };
  }

  return { ok: true, envelope: normalized };
}

export function encodeNudgeEnvelope(env: NudgeEnvelopeV1): string {
  const checked = validateNudgeEnvelope(env);
  if (!checked.ok) {
    throw new Error(`nudge_envelope:${checked.error}`);
  }
  return JSON.stringify(checked.envelope);
}

/**
 * Parse mailbox blob: v1 envelope, or Phase 3 legacy `{v:0,kind:"text",body}` / plain text.
 */
export function decodeNudgeEnvelope(raw: string): NudgeEnvelopeParse {
  const trimmed = raw?.trim();
  if (!trimmed) return { ok: false, error: "empty" };

  try {
    const o = JSON.parse(trimmed) as Record<string, unknown>;

    // Legacy Phase 3 text blob
    if (o.v === 0 && typeof o.body === "string" && o.body.trim()) {
      return validateNudgeEnvelope({
        v: NUDGE_ENVELOPE_V,
        kind: "text",
        atMs:
          typeof o.atMs === "number" && o.atMs > 0 ? o.atMs : Date.now(),
        text: o.body.trim().slice(0, NUDGE_CAPS.textChars),
      });
    }

    if (o.v === NUDGE_ENVELOPE_V) {
      return validateNudgeEnvelope(o as unknown as NudgeEnvelopeV1);
    }

    // Loose legacy: { kind, body }
    if (typeof o.body === "string" && o.body.trim()) {
      return validateNudgeEnvelope({
        v: NUDGE_ENVELOPE_V,
        kind: "text",
        atMs: Date.now(),
        text: o.body.trim().slice(0, NUDGE_CAPS.textChars),
      });
    }

    return { ok: false, error: "unrecognized" };
  } catch {
    // Plain text fallback (Phase 3)
    return validateNudgeEnvelope({
      v: NUDGE_ENVELOPE_V,
      kind: "text",
      atMs: Date.now(),
      text: trimmed.slice(0, NUDGE_CAPS.textChars),
    });
  }
}

/** Convenience builders (clamp text; caller supplies media already sized). */
export function textNudgeEnvelope(
  text: string,
  atMs = Date.now(),
): NudgeEnvelopeV1 {
  return {
    v: NUDGE_ENVELOPE_V,
    kind: "text",
    atMs,
    text: text.trim().slice(0, NUDGE_CAPS.textChars),
  };
}

export function soundPresetNudgeEnvelope(
  presetId: SoundPresetId,
  text?: string,
  atMs = Date.now(),
): NudgeEnvelopeV1 {
  return {
    v: NUDGE_ENVELOPE_V,
    kind: "sound_preset",
    atMs,
    presetId,
    ...(clampText(text) ? { text: clampText(text) } : {}),
  };
}
