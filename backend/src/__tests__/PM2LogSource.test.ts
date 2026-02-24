import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createLogger } from "../utils/logger.js";
import { EventBus } from "../events/EventBus.js";
import type { ErrorBlock } from "../types/index.js";

// Capture bus callback references for manual triggering
let connectCallback: ((err: Error | null) => void) | null = null;
let launchBusCallback:
  | ((err: Error | null, bus: { on: (event: string, cb: (...args: unknown[]) => void) => void }) => void)
  | null = null;
let busListeners: Record<string, ((...args: unknown[]) => void)[]> = {};

vi.mock("pm2", () => ({
  default: {
    connect: (cb: (err: Error | null) => void) => {
      connectCallback = cb;
      cb(null); // Auto-connect successfully
    },
    launchBus: (
      cb: (
        err: Error | null,
        bus: { on: (event: string, handler: (...args: unknown[]) => void) => void }
      ) => void
    ) => {
      launchBusCallback = cb;
      const mockBus = {
        on: (event: string, handler: (...args: unknown[]) => void) => {
          if (!busListeners[event]) busListeners[event] = [];
          busListeners[event].push(handler);
        },
      };
      cb(null, mockBus);
    },
    disconnect: vi.fn(),
  },
}));

describe("PM2LogSource", () => {
  let bus: EventBus;

  beforeEach(() => {
    createLogger({ logLevel: "silent" });
    EventBus.resetInstance();
    bus = EventBus.getInstance();
    busListeners = {};
    connectCallback = null;
    launchBusCallback = null;
  });

  afterEach(() => {
    EventBus.resetInstance();
    vi.restoreAllMocks();
  });

  it("should have correct name", async () => {
    const { PM2LogSource } = await import("../tailer/sources/PM2LogSource.js");
    const source = new PM2LogSource("my-app");
    expect(source.name).toBe("pm2:my-app");
  });

  it("should start and connect to PM2 bus", async () => {
    const { PM2LogSource } = await import("../tailer/sources/PM2LogSource.js");
    const source = new PM2LogSource("my-app");
    await expect(source.start()).resolves.not.toThrow();
    source.stop();
  });

  it("should emit error-detected on log:err event", async () => {
    const { PM2LogSource } = await import("../tailer/sources/PM2LogSource.js");
    const source = new PM2LogSource("my-app");

    const received: ErrorBlock[] = [];
    bus.on("error-detected", (block) => {
      received.push(block);
    });

    await source.start();

    // Simulate a log:err event from PM2
    const logErrHandlers = busListeners["log:err"] ?? [];
    for (const handler of logErrHandlers) {
      handler({
        process: { name: "my-app" },
        data: "ERROR: Database connection failed",
      });
    }

    expect(received.length).toBe(1);
    expect(received[0].raw).toBe("ERROR: Database connection failed");
    expect(received[0].source).toBe("pm2://my-app");

    source.stop();
  });

  it("should emit error-detected on process:exception event", async () => {
    const { PM2LogSource } = await import("../tailer/sources/PM2LogSource.js");
    const source = new PM2LogSource("my-app");

    const received: ErrorBlock[] = [];
    bus.on("error-detected", (block) => {
      received.push(block);
    });

    await source.start();

    // Simulate a process:exception event from PM2
    const exceptionHandlers = busListeners["process:exception"] ?? [];
    for (const handler of exceptionHandlers) {
      handler({
        process: { name: "my-app" },
        data: {
          message: "Uncaught TypeError",
          stack: "TypeError: Cannot read property 'id' of null\n    at app.js:42",
        },
      });
    }

    expect(received.length).toBe(1);
    expect(received[0].raw).toContain("TypeError");
    expect(received[0].source).toBe("pm2://my-app");

    source.stop();
  });

  it("should filter events by process name", async () => {
    const { PM2LogSource } = await import("../tailer/sources/PM2LogSource.js");
    const source = new PM2LogSource("my-app");

    const received: ErrorBlock[] = [];
    bus.on("error-detected", (block) => {
      received.push(block);
    });

    await source.start();

    // Simulate a log:err from a DIFFERENT app
    const logErrHandlers = busListeners["log:err"] ?? [];
    for (const handler of logErrHandlers) {
      handler({
        process: { name: "other-app" },
        data: "ERROR: Should be filtered",
      });
    }

    expect(received.length).toBe(0);

    source.stop();
  });

  it("should accept all processes when name is *", async () => {
    const { PM2LogSource } = await import("../tailer/sources/PM2LogSource.js");
    const source = new PM2LogSource("*");

    const received: ErrorBlock[] = [];
    bus.on("error-detected", (block) => {
      received.push(block);
    });

    await source.start();

    const logErrHandlers = busListeners["log:err"] ?? [];
    for (const handler of logErrHandlers) {
      handler({
        process: { name: "any-random-app" },
        data: "ERROR: Should be accepted",
      });
    }

    expect(received.length).toBe(1);

    source.stop();
  });

  it("should stop cleanly", async () => {
    const { PM2LogSource } = await import("../tailer/sources/PM2LogSource.js");
    const source = new PM2LogSource("my-app");
    await source.start();
    expect(() => source.stop()).not.toThrow();
  });
});
