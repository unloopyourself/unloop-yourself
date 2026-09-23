import { describe, expect, it, vi } from "vitest";
import { TypedEventEmitter } from "./events.js";

type DemoEvents = {
  ping: { n: number };
  done: undefined;
};

describe("TypedEventEmitter", () => {
  it("delivers payloads to subscribers", () => {
    const bus = new TypedEventEmitter<DemoEvents>();
    const seen: number[] = [];
    bus.on("ping", (payload) => {
      seen.push(payload.n);
    });
    bus.emit("ping", { n: 1 });
    bus.emit("ping", { n: 2 });
    expect(seen).toEqual([1, 2]);
  });

  it("supports unsubscribe", () => {
    const bus = new TypedEventEmitter<DemoEvents>();
    const handler = vi.fn();
    const off = bus.on("ping", handler);
    bus.emit("ping", { n: 1 });
    off();
    bus.emit("ping", { n: 2 });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("fans out to multiple listeners", () => {
    const bus = new TypedEventEmitter<DemoEvents>();
    const a = vi.fn();
    const b = vi.fn();
    bus.on("done", a);
    bus.on("done", b);
    bus.emit("done", undefined);
    expect(a).toHaveBeenCalledOnce();
    expect(b).toHaveBeenCalledOnce();
    expect(bus.listenerCount("done")).toBe(2);
  });
});
