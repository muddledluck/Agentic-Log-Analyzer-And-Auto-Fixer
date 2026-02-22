import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { createLogger } from "../utils/logger.js";
import { EventBus } from "../events/EventBus.js";
import type { AppConfig, ErrorBlock } from "../types/index.js";
import { InMemoryDedupService } from "../services/DedupService.js";
import { SubprocessAgentClient } from "../agents/SubprocessAgentClient.js";

// Mock SubprocessAgentClient
vi.mock("../agents/SubprocessAgentClient.js", () => {
  return {
    SubprocessAgentClient: vi.fn().mockImplementation(() => ({
      parse: vi.fn().mockResolvedValue({
        errorType: "TestError",
        errorMessage: "Test error message",
        stackFrames: [],
        contextLines: ["context"],
        severity: "medium",
      }),
      debug: vi.fn().mockResolvedValue({
        rootCause: "Test root cause",
        explanation: "Test explanation",
        suggestedFix: {
          language: "typescript",
          fixed: "// fixed code",
          description: "Test fix",
        },
        severity: "medium",
        confidence: 90,
        additionalNotes: [],
      }),
    })),
  };
});

describe("Orchestrator", () => {
  let tmpDir: string;
  let config: AppConfig;

  beforeEach(() => {
    createLogger({ logLevel: "silent" });
    EventBus.resetInstance();

    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "alaa-orch-test-"));
    const reportDir = path.join(tmpDir, "reports");
    fs.mkdirSync(reportDir, { recursive: true });

    config = {
      logFilePath: "/tmp/test.log",
      reportDir,
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

  it("should process an error through the full pipeline", async () => {
    const { Orchestrator } = await import("../orchestrator/Orchestrator.js");
    const dedupService = new InMemoryDedupService(config.dedupTtlMs);
    const agentClient = new SubprocessAgentClient(config);
    const orchestrator = new Orchestrator(config, agentClient, dedupService);
    
    const bus = EventBus.getInstance();

    let reportGenerated = false;
    bus.on("report-generated", () => {
      reportGenerated = true;
    });

    orchestrator.start();

    const errorBlock: ErrorBlock = {
      id: "test-1",
      raw: "[2026-01-01T00:00:00Z] ERROR: TestError: Something broke",
      contextLines: ["context line 1"],
      timestamp: "2026-01-01T00:00:00Z",
      source: "/tmp/test.log",
    };

    bus.emit("error-detected", errorBlock);

    await new Promise((resolve) => setTimeout(resolve, 500));
    orchestrator.stop();

    expect(reportGenerated).toBe(true);
    const reports = fs.readdirSync(config.reportDir);
    expect(reports.length).toBeGreaterThanOrEqual(1);
    expect(reports[0].endsWith(".md")).toBe(true);
  });

  it("should deduplicate identical errors", async () => {
    const { Orchestrator } = await import("../orchestrator/Orchestrator.js");
    const dedupService = new InMemoryDedupService(config.dedupTtlMs);
    const agentClient = new SubprocessAgentClient(config);
    const orchestrator = new Orchestrator(config, agentClient, dedupService);
    
    const bus = EventBus.getInstance();

    let reportCount = 0;
    bus.on("report-generated", () => { reportCount++; });

    orchestrator.start();

    const errorBlock: ErrorBlock = {
      id: "test-dup-1",
      raw: "[2026-01-01T00:00:00Z] ERROR: DuplicateError: Same error",
      contextLines: [],
      timestamp: "2026-01-01T00:00:00Z",
      source: "/tmp/test.log",
    };

    bus.emit("error-detected", errorBlock);
    await new Promise((resolve) => setTimeout(resolve, 300));
    
    bus.emit("error-detected", { ...errorBlock, id: "test-dup-2" });
    await new Promise((resolve) => setTimeout(resolve, 300));

    orchestrator.stop();
    expect(reportCount).toBe(1);
  });

  it("should stop cleanly", async () => {
    const { Orchestrator } = await import("../orchestrator/Orchestrator.js");
    const dedupService = new InMemoryDedupService(config.dedupTtlMs);
    const agentClient = new SubprocessAgentClient(config);
    const orchestrator = new Orchestrator(config, agentClient, dedupService);
    
    orchestrator.start();
    expect(() => orchestrator.stop()).not.toThrow();
  });
});
