import { describe, expect, it } from "vitest";
import { InMemoryRelayPort } from "./nudge.js";
import { NudgeBus, createNudgeEventId } from "./nudgeBus.js";

describe("createNudgeEventId", () => {
  it("is stable format", () => {
    const id = createNudgeEventId(1_700_000_000_000, () => 0.5);
    expect(id.startsWith("ev_")).toBe(true);
  });
});

describe("NudgeBus", () => {
  it("emits approaching from usage, not wall clock", () => {
    let now = 1_000;
    const relay = new InMemoryRelayPort(() => now);
    const bus = new NudgeBus(relay, { now: () => now }, 60);
    bus.begin({
      mailboxId: "mb1",
      interruptAtMs: 1_000 + 10_000,
      warnLeadMs: 2_000,
    });
    // Wall clock at warn time must not fire approaching anymore.
    now = 1_000 + 8_000;
    expect(bus.tick()).toEqual([]);
    // Outside feed — no warn.
    expect(
      bus.observeUsage({
        accumulatedMs: 9_000,
        thresholdMs: 10_000,
        warnLeadMs: 2_000,
        inTargetFeed: false,
      }),
    ).toEqual([]);
    // In feed, past warnAfter (8s) — approaching once.
    const warn = bus.observeUsage({
      accumulatedMs: 8_000,
      thresholdMs: 10_000,
      warnLeadMs: 2_000,
      inTargetFeed: true,
    });
    expect(warn).toHaveLength(1);
    expect(warn[0]?.type).toBe("approaching");
    expect(
      bus.observeUsage({
        accumulatedMs: 9_000,
        thresholdMs: 10_000,
        warnLeadMs: 2_000,
        inTargetFeed: true,
      }),
    ).toEqual([]);
    const fetch = bus.observeUsage({
      accumulatedMs: 10_000,
      thresholdMs: 10_000,
      warnLeadMs: 2_000,
      inTargetFeed: true,
    });
    expect(fetch.some((i) => i.type === "interrupt_fetch")).toBe(true);
  });

  it("warnLead >= threshold → approaching as soon as feed is active", () => {
    const relay = new InMemoryRelayPort(() => 1_000);
    const bus = new NudgeBus(relay, { now: () => 1_000 }, 60);
    bus.begin({
      mailboxId: "mb1",
      interruptAtMs: 1_000 + 60_000,
      warnLeadMs: 60_000,
    });
    const warn = bus.observeUsage({
      accumulatedMs: 0,
      thresholdMs: 60_000,
      warnLeadMs: 60_000,
      inTargetFeed: true,
    });
    expect(warn[0]?.type).toBe("approaching");
  });

  it("put/get mailbox for active eventId; cancel purges", async () => {
    let now = 5_000;
    const relay = new InMemoryRelayPort(() => now);
    const bus = new NudgeBus(relay, { now: () => now }, 60);
    const session = bus.begin({
      mailboxId: "mb-u",
      interruptAtMs: 20_000,
      warnLeadMs: 5_000,
      eventId: "ev_fixed",
    });
    expect(session.eventId).toBe("ev_fixed");
    await bus.putNudge("cipher-1");
    expect(await bus.fetchNudge()).toBe("cipher-1");
    const cancel = await bus.cancel();
    expect(cancel?.type).toBe("cancel");
    expect(await relay.getMailbox("mb-u", "ev_fixed")).toBeNull();
    expect(await bus.fetchNudge()).toBeNull();
  });
});
