import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createLogger } from "../utils/logger.js";
import { EventBus } from "../events/EventBus.js";

describe("EventBus", () => {
  beforeEach(() => {
    createLogger({ logLevel: "silent" });
    EventBus.resetInstance();
  });

  afterEach(() => {
    EventBus.resetInstance();
  });

  it("should return the same instance (singleton)", () => {
    const bus1 = EventBus.getInstance();
    const bus2 = EventBus.getInstance();
    expect(bus1).toBe(bus2);
  });

  it("should emit and receive events", () => {
    const bus = EventBus.getInstance();

    let received = false;
    const handler = () => {
      received = true;
    };

    bus.on("error-detected", handler);
    bus.emit("error-detected", {
      id: "test-1",
      raw: "ERROR: test",
      contextLines: [],
      timestamp: new Date().toISOString(),
      source: "/tmp/test.log",
    });

    expect(received).toBe(true);
  });

  it("should support off to remove listeners", () => {
    const bus = EventBus.getInstance();

    let callCount = 0;
    const handler = () => {
      callCount++;
    };

    bus.on("error-detected", handler);
    bus.emit("error-detected", {
      id: "test-1",
      raw: "ERROR: test",
      contextLines: [],
      timestamp: new Date().toISOString(),
      source: "/tmp/test.log",
    });
    expect(callCount).toBe(1);

    bus.off("error-detected", handler);
    bus.emit("error-detected", {
      id: "test-2",
      raw: "ERROR: test2",
      contextLines: [],
      timestamp: new Date().toISOString(),
      source: "/tmp/test.log",
    });
    expect(callCount).toBe(1);
  });

  it("should remove all listeners on removeAllListeners", () => {
    const bus = EventBus.getInstance();

    let called = false;
    bus.on("error-detected", () => {
      called = true;
    });

    bus.removeAllListeners();
    bus.emit("error-detected", {
      id: "test-1",
      raw: "ERROR: test",
      contextLines: [],
      timestamp: new Date().toISOString(),
      source: "/tmp/test.log",
    });

    expect(called).toBe(false);
  });

  it("should reset singleton on resetInstance", () => {
    const bus1 = EventBus.getInstance();
    EventBus.resetInstance();
    const bus2 = EventBus.getInstance();
    expect(bus1).not.toBe(bus2);
  });
});
