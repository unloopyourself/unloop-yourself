import { describe, expect, it } from "vitest";
import type { Capability } from "./challenge.js";
import {
  AiCompanionProvider,
  HumanBuddyProvider,
  InMemoryRelayPort,
  NullPushPort,
  resolveInterruptCascade,
  type NudgeProvider,
} from "./nudge.js";

const buddyCaps: ReadonlySet<Capability> = new Set(["buddy"]);
const bareCaps: ReadonlySet<Capability> = new Set(["accelerometer"]);

describe("resolveInterruptCascade", () => {
  it("falls through to challenges when cascade disabled", async () => {
    const providers: NudgeProvider[] = [
      new HumanBuddyProvider(async () => ({ body: "hi" })),
    ];
    const out = await resolveInterruptCascade({
      eventId: "e1",
      availableCapabilities: buddyCaps,
      nowMs: 1,
      providers,
      cascadeEnabled: false,
    });
    expect(out).toEqual({ kind: "challenges" });
  });

  it("prefers human buddy when payload exists", async () => {
    const out = await resolveInterruptCascade({
      eventId: "e1",
      availableCapabilities: buddyCaps,
      nowMs: 100,
      providers: [
        new HumanBuddyProvider(async () => ({
          body: "cipher",
          kind: "opaque",
          createdAtMs: 50,
        })),
        new AiCompanionProvider(),
      ],
    });
    expect(out.kind).toBe("nudge");
    if (out.kind === "nudge") {
      expect(out.payload.providerId).toBe("human_buddy");
      expect(out.payload.body).toBe("cipher");
      expect(out.payload.eventId).toBe("e1");
    }
  });

  it("skips human buddy without buddy capability", async () => {
    const out = await resolveInterruptCascade({
      eventId: "e1",
      availableCapabilities: bareCaps,
      nowMs: 1,
      providers: [
        new HumanBuddyProvider(async () => ({ body: "should-not-see" })),
        new AiCompanionProvider(),
      ],
    });
    expect(out).toEqual({ kind: "challenges" });
  });

  it("AiCompanionProvider is always null → challenges", async () => {
    const ai = new AiCompanionProvider();
    expect(await ai.fetchForEvent({ eventId: "e", availableCapabilities: bareCaps, nowMs: 1 })).toBeNull();
    const out = await resolveInterruptCascade({
      eventId: "e1",
      availableCapabilities: bareCaps,
      nowMs: 1,
      providers: [ai],
    });
    expect(out).toEqual({ kind: "challenges" });
  });

  it("falls through when buddy mailbox empty", async () => {
    const out = await resolveInterruptCascade({
      eventId: "e1",
      availableCapabilities: buddyCaps,
      nowMs: 1,
      providers: [
        new HumanBuddyProvider(async () => null),
        new AiCompanionProvider(),
      ],
    });
    expect(out).toEqual({ kind: "challenges" });
  });
});

describe("InMemoryRelayPort", () => {
  it("put/get/cancel mailbox with TTL", async () => {
    let now = 1_000;
    const relay = new InMemoryRelayPort(() => now);
    await relay.putMailbox("mb-a", "ev-1", "blob", 10);
    expect(await relay.getMailbox("mb-a", "ev-1")).toBe("blob");
    now = 1_000 + 10_000;
    expect(await relay.getMailbox("mb-a", "ev-1")).toBeNull();

    await relay.putMailbox("mb-a", "ev-2", "x", 60);
    await relay.cancelMailbox("mb-a", "ev-2");
    expect(await relay.getMailbox("mb-a", "ev-2")).toBeNull();
  });

  it("registers and forgets push tokens", async () => {
    const relay = new InMemoryRelayPort();
    await relay.registerPushToken("mb", "tok-1");
    expect(relay.peekToken("mb")).toBe("tok-1");
    await relay.forgetPushToken("mb");
    expect(relay.peekToken("mb")).toBeUndefined();
  });
});

describe("NullPushPort", () => {
  it("returns null token", async () => {
    expect(await new NullPushPort().getToken()).toBeNull();
  });
});
