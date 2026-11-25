import { describe, expect, it } from "vitest";
import {
  createPairInviteV0,
  encodePairDeepLink,
  isPairInviteFresh,
  normalizePairInvite,
  parsePairInvite,
  type PairInviteV0,
} from "./pairing.js";

const sample: PairInviteV0 = {
  v: 0,
  mailboxId: "mailbox-abc-12345",
  pub: "pubfingerprint0123456789",
  exp: 1_800_000_000_000,
  sig: "sig-placeholder",
  role: "seeker",
};

describe("pair invite v0", () => {
  it("round-trips through unloop:// deep link", () => {
    const link = encodePairDeepLink(sample);
    expect(link.startsWith("unloop://pair?p=")).toBe(true);
    const parsed = parsePairInvite(link);
    expect(parsed).toEqual(sample);
  });

  it("parses raw JSON", () => {
    expect(parsePairInvite(JSON.stringify(sample))).toEqual(sample);
  });

  it("rejects malformed invites", () => {
    expect(parsePairInvite("")).toBeNull();
    expect(parsePairInvite("not-a-link")).toBeNull();
    expect(normalizePairInvite({ v: 1, mailboxId: "x" })).toBeNull();
    expect(
      normalizePairInvite({
        v: 0,
        mailboxId: "short",
        pub: "also",
        exp: 1,
        sig: "x",
      }),
    ).toBeNull();
  });

  it("checks freshness via exp", () => {
    expect(isPairInviteFresh(sample, sample.exp - 1)).toBe(true);
    expect(isPairInviteFresh(sample, sample.exp)).toBe(false);
  });

  it("accepts invite without optional role", () => {
    const { role: _role, ...rest } = sample;
    const link = encodePairDeepLink(rest);
    expect(parsePairInvite(link)).toEqual(rest);
  });

  it("createPairInviteV0 fills defaults", () => {
    const invite = createPairInviteV0({
      mailboxId: "mailbox-abc-12345",
      pub: "pubfingerprint0123456789",
      nowMs: 1_000,
    });
    expect(invite.v).toBe(0);
    expect(invite.exp).toBe(1_000 + 24 * 60 * 60 * 1000);
    expect(invite.sig).toBe("local-v0-unsigned");
  });
});
