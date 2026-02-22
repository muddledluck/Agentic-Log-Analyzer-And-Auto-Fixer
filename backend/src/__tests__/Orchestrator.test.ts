import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createLogger } from "../utils/logger.js";
import { EventBus } from "../events/EventBus.js";
import type { AppConfig, ErrorBlock } from "../types/index.js";
import { InMemoryDedupService } from "../services/DedupService.js";

// Mock AnalysisQueue
vi.mock("../queue/AnalysisQueue.js", () => {
  return {
    AnalysisQueue: vi.fn().mockImplementation(() => ({
      add: vi.fn().mockResolvedValue(undefined),
      stop: vi.fn().mockResolvedValue(undefined),
    })),
  };
});

describe("Orchestrator", () => {
  let config: AppConfig;

  beforeEach(() => {
    createLogger({ logLevel: "silent" });
    EventBus.resetInstance();

    config = {
      logFilePath: "/tmp/test.log",
      reportDir: "/tmp/reports",
      dedupTtlMs: 300000,
      crewaiMode: "subprocess",
      crewaiHost: "http://localhost:8000",
      llmModel: "llama3",
      llmBaseUrl: "http://localhost:11434",
      logLevel: "silent",
      redisUrl: "redis://localhost:6379",
    };
  });

  afterEach(() => {
    EventBus.resetInstance();
  });

  it("should process an error by checking dedup and adding to queue", async () => {
    const { Orchestrator } = await import("../orchestrator/Orchestrator.js");
    const { AnalysisQueue } = await import("../queue/AnalysisQueue.js");

    const dedupService = new InMemoryDedupService(config.dedupTtlMs);
    const queue = new AnalysisQueue(config, {} as any);
    const orchestrator = new Orchestrator(config, queue, dedupService);

    const bus = EventBus.getInstance();
    orchestrator.start();

    const errorBlock: ErrorBlock = {
      id: "test-1",
      raw: "[2026-01-01T00:00:00Z] ERROR: TestError: Something broke",
      contextLines: ["context line 1"],
      timestamp: "2026-01-01T00:00:00Z",
      source: "/tmp/test.log",
    };

    bus.emit("error-detected", errorBlock);

    // Wait for async handler
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(queue.add).toHaveBeenCalledWith(errorBlock);
    await orchestrator.stop();
  });

  it("should deduplicate identical errors and not add to queue", async () => {
    const { Orchestrator } = await import("../orchestrator/Orchestrator.js");
    const { AnalysisQueue } = await import("../queue/AnalysisQueue.js");

    const dedupService = new InMemoryDedupService(config.dedupTtlMs);
    const queue = new AnalysisQueue(config, {} as any);
    const orchestrator = new Orchestrator(config, queue, dedupService);

    const bus = EventBus.getInstance();
    orchestrator.start();

    const errorBlock: ErrorBlock = {
      id: "test-dup-1",
      raw: "[2026-01-01T00:00:00Z] ERROR: DuplicateError: Same error",
      contextLines: [],
      timestamp: "2026-01-01T00:00:00Z",
      source: "/tmp/test.log",
    };

    bus.emit("error-detected", errorBlock);
    await new Promise((resolve) => setTimeout(resolve, 50));

    bus.emit("error-detected", { ...errorBlock, id: "test-dup-2" });
    await new Promise((resolve) => setTimeout(resolve, 50));

    // queue.add should only be called once, because the second emission is a duplicate
    expect(queue.add).toHaveBeenCalledTimes(1);
    await orchestrator.stop();
  });

  it("should stop cleanly", async () => {
    const { Orchestrator } = await import("../orchestrator/Orchestrator.js");
    const { AnalysisQueue } = await import("../queue/AnalysisQueue.js");

    const dedupService = new InMemoryDedupService(config.dedupTtlMs);
    const queue = new AnalysisQueue(config, {} as any);
    const orchestrator = new Orchestrator(config, queue, dedupService);

    orchestrator.start();
    await orchestrator.stop();
    expect(queue.stop).toHaveBeenCalled();
  });
});
