import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { createLogger } from "../utils/logger.js";
import { EventBus } from "../events/EventBus.js";
import { LogTailer } from "../tailer/LogTailer.js";
import type { AppConfig, ErrorBlock } from "../types/index.js";

/**
 * Helper to stop the internal watcher so we can test processNewLines
 * in isolation without race conditions from fs.watch.
 */
function stopWatcher(tailer: LogTailer): void {
  // @ts-expect-error Accessing private property for testing
  if (tailer.watcher) {
    // @ts-expect-error Accessing private property for testing
    tailer.watcher.close();
    // @ts-expect-error Accessing private property for testing
    tailer.watcher = null;
  }
}

async function triggerProcessing(tailer: LogTailer): Promise<void> {
  // @ts-expect-error Accessing private method for testing
  await tailer.processNewLines();
}

describe("LogTailer", () => {
  let tmpDir: string;
  let logFile: string;
  let config: AppConfig;

  beforeEach(() => {
    createLogger({ logLevel: "silent" });
    EventBus.resetInstance();

    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "alaa-tailer-test-"));
    logFile = path.join(tmpDir, "test.log");
    fs.writeFileSync(logFile, "initial line\n");

    config = {
      logFilePath: logFile,
      reportDir: path.join(tmpDir, "reports"),
      dedupTtlMs: 300000,
      crewaiMode: "subprocess",
      crewaiHost: "http://localhost:8000",
      ollamaModel: "llama3",
      ollamaBaseUrl: "http://localhost:11434",
      logLevel: "silent",
    };
  });

  afterEach(() => {
    EventBus.resetInstance();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("should emit error-detected for ERROR lines", async () => {
    const tailer = new LogTailer(config);
    const bus = EventBus.getInstance();

    const received: ErrorBlock[] = [];
    bus.on("error-detected", (block) => {
      received.push(block);
    });

    await tailer.start();
    stopWatcher(tailer);

    fs.appendFileSync(
      logFile,
      "[2026-01-01T00:00:00Z] ERROR: Something broke\n"
    );

    await triggerProcessing(tailer);

    expect(received.length).toBeGreaterThanOrEqual(1);
    expect(received[0].raw).toContain("ERROR");
    expect(received[0].id).toBeDefined();
    expect(received[0].source).toBe(logFile);
  });

  it("should NOT emit for non-error lines", async () => {
    const tailer = new LogTailer(config);
    const bus = EventBus.getInstance();

    const received: ErrorBlock[] = [];
    bus.on("error-detected", (block) => {
      received.push(block);
    });

    await tailer.start();
    stopWatcher(tailer);

    fs.appendFileSync(logFile, "[2026-01-01T00:00:00Z] INFO: All is well\n");

    await triggerProcessing(tailer);

    expect(received.length).toBe(0);
  });

  it("should include context lines", async () => {
    const tailer = new LogTailer(config);
    const bus = EventBus.getInstance();

    const received: ErrorBlock[] = [];
    bus.on("error-detected", (block) => {
      received.push(block);
    });

    await tailer.start();
    stopWatcher(tailer);

    fs.appendFileSync(
      logFile,
      "context line 1\ncontext line 2\n[2026-01-01T00:00:00Z] ERROR: Failure\n"
    );

    await triggerProcessing(tailer);

    expect(received.length).toBeGreaterThanOrEqual(1);
    expect(received[0].contextLines.length).toBeGreaterThan(0);
    const contextStr = received[0].contextLines.join("\n");
    expect(contextStr).toContain("context line 1");
  });

  it("should extract timestamp from log line", async () => {
    const tailer = new LogTailer(config);
    const bus = EventBus.getInstance();

    const received: ErrorBlock[] = [];
    bus.on("error-detected", (block) => {
      received.push(block);
    });

    await tailer.start();
    stopWatcher(tailer);

    fs.appendFileSync(logFile, "[2026-03-15T10:30:00Z] ERROR: Timed out\n");

    await triggerProcessing(tailer);

    expect(received.length).toBeGreaterThanOrEqual(1);
    expect(received[0].timestamp).toBe("2026-03-15T10:30:00Z");
  });

  it("should only process new lines (offset tracking)", async () => {
    // Write error BEFORE starting tailer
    fs.appendFileSync(logFile, "[2026-01-01T00:00:00Z] ERROR: Old error\n");

    const tailer = new LogTailer(config);
    const bus = EventBus.getInstance();

    const received: ErrorBlock[] = [];
    bus.on("error-detected", (block) => {
      received.push(block);
    });

    await tailer.start();
    stopWatcher(tailer);

    await triggerProcessing(tailer);

    // Old errors written before start() should be skipped
    expect(received.length).toBe(0);
  });

  it("should stop cleanly", async () => {
    const tailer = new LogTailer(config);
    await tailer.start();
    expect(() => tailer.stop()).not.toThrow();
  });

  it("should detect FATAL lines", async () => {
    const tailer = new LogTailer(config);
    const bus = EventBus.getInstance();

    const received: ErrorBlock[] = [];
    bus.on("error-detected", (block) => {
      received.push(block);
    });

    await tailer.start();
    stopWatcher(tailer);

    fs.appendFileSync(logFile, "[2026-01-01T00:00:00Z] FATAL: Out of memory\n");

    await triggerProcessing(tailer);

    expect(received.length).toBe(1);
    expect(received[0].raw).toContain("FATAL");
  });

  it("should detect Exception lines", async () => {
    const tailer = new LogTailer(config);
    const bus = EventBus.getInstance();

    const received: ErrorBlock[] = [];
    bus.on("error-detected", (block) => {
      received.push(block);
    });

    await tailer.start();
    stopWatcher(tailer);

    fs.appendFileSync(
      logFile,
      "NullPointerException: Cannot read property 'id'\n"
    );

    await triggerProcessing(tailer);

    expect(received.length).toBe(1);
    expect(received[0].raw).toContain("Exception");
  });
});
