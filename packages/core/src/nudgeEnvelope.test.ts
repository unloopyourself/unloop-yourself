import { describe, expect, it } from "vitest";
import {
  NUDGE_CAPS,
  NUDGE_ENVELOPE_V,
  decodeNudgeEnvelope,
  encodeNudgeEnvelope,
  soundPresetNudgeEnvelope,
  textNudgeEnvelope,
  validateNudgeEnvelope,
} from "./nudgeEnvelope.js";

describe("nudgeEnvelope v1", () => {
  it("round-trips text", () => {
    const env = textNudgeEnvelope("Hey — look up");
    const raw = encodeNudgeEnvelope(env);
    const parsed = decodeNudgeEnvelope(raw);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.envelope.kind).toBe("text");
      expect(parsed.envelope.text).toBe("Hey — look up");
      expect(parsed.envelope.v).toBe(NUDGE_ENVELOPE_V);
    }
  });

  it("accepts legacy v0 text blob", () => {
    const legacy = JSON.stringify({
      v: 0,
      kind: "text",
      body: "Nokia nudge: take a breath.",
      atMs: 1000,
    });
    const parsed = decodeNudgeEnvelope(legacy);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.envelope.kind).toBe("text");
      expect(parsed.envelope.text).toBe("Nokia nudge: take a breath.");
    }
  });

  it("accepts plain text fallback", () => {
    const parsed = decodeNudgeEnvelope("just a line");
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.envelope.text).toBe("just a line");
  });

  it("rejects text over cap", () => {
    const long = "x".repeat(NUDGE_CAPS.textChars + 1);
    const out = validateNudgeEnvelope({
      v: 1,
      kind: "text",
      atMs: 1,
      text: long,
    });
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.error).toBe("text_too_long");
  });

  it("round-trips sound_preset with optional caption", () => {
    const env = soundPresetNudgeEnvelope("ship_horn", "Ahoy");
    const raw = encodeNudgeEnvelope(env);
    const parsed = decodeNudgeEnvelope(raw);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.envelope.kind).toBe("sound_preset");
      expect(parsed.envelope.presetId).toBe("ship_horn");
      expect(parsed.envelope.text).toBe("Ahoy");
    }
  });

  it("rejects unknown preset", () => {
    const out = validateNudgeEnvelope({
      v: 1,
      kind: "sound_preset",
      atMs: 1,
      presetId: "nope" as "ship_horn",
    });
    expect(out.ok).toBe(false);
  });

  it("rejects photo over byte cap", () => {
    const out = validateNudgeEnvelope({
      v: 1,
      kind: "photo",
      atMs: 1,
      text: "hi",
      media: {
        encoding: "base64",
        mime: "image/jpeg",
        byteLength: NUDGE_CAPS.photoBytes + 1,
        data: "AA==",
      },
    });
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.error).toBe("media_too_large");
  });

  it("rejects voice longer than 30s", () => {
    const out = validateNudgeEnvelope({
      v: 1,
      kind: "voice",
      atMs: 1,
      durationMs: NUDGE_CAPS.voiceMaxMs + 1,
      media: {
        encoding: "base64",
        mime: "audio/mp4",
        byteLength: 100,
        data: "AA==",
      },
    });
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.error).toBe("voice_too_long");
  });

  it("rejects video longer than 10s", () => {
    const out = validateNudgeEnvelope({
      v: 1,
      kind: "video",
      atMs: 1,
      durationMs: NUDGE_CAPS.videoMaxMs + 1,
      media: {
        encoding: "base64",
        mime: "video/mp4",
        byteLength: 100,
        data: "AA==",
      },
    });
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.error).toBe("video_too_long");
  });

  it("accepts composed photo + text under caps", () => {
    const out = validateNudgeEnvelope({
      v: 1,
      kind: "photo",
      atMs: 1,
      text: "look",
      media: {
        encoding: "base64",
        mime: "image/jpeg",
        byteLength: 1024,
        data: "AA==",
      },
    });
    expect(out.ok).toBe(true);
  });
});
