import { describe, it, expect, vi, beforeEach } from "vitest";
import { EventEmitter } from "node:events";
import { Readable, Writable } from "node:stream";
import { createLogger } from "../utils/logger.js";
import type { AppConfig } from "../types/index.js";

// Mock child_process.spawn
vi.mock("node:child_process", () => ({
  spawn: vi.fn(),
}));

function createMockProcess(responseJson: string, exitCode: number = 0) {
  const proc = new EventEmitter() as EventEmitter & {
    stdout: Readable;
    stderr: Readable;
    stdin: Writable;
    kill: ReturnType<typeof vi.fn>;
  };

  proc.stdout = new Readable({ read() {} });
  proc.stderr = new Readable({ read() {} });
  proc.stdin = new Writable({
    write(_chunk: unknown, _encoding: unknown, callback: () => void) {
      callback();
    },
  });
  proc.kill = vi.fn();

  // When stdin closes, push response and exit
  proc.stdin.on("finish", () => {
    if (exitCode === 0) {
      proc.stdout.push(responseJson);
      proc.stdout.push(null);
    } else {
      proc.stderr.push("Python error");
      proc.stderr.push(null);
      proc.stdout.push(null);
    }
    setTimeout(() => proc.emit("close", exitCode), 10);
  });

  return proc;
}

describe("SubprocessAgentClient", () => {
  let config: AppConfig;

  beforeEach(() => {
    createLogger({ logLevel: "silent" });
    vi.clearAllMocks();

    config = {
      logFilePath: "/tmp/test.log",
      reportDir: "/tmp/reports",
      dedupTtlMs: 300000,
      crewaiMode: "subprocess",
      crewaiHost: "http://localhost:8000",
      ollamaModel: "llama3",
      ollamaBaseUrl: "http://localhost:11434",
      logLevel: "silent",
    };
  });

  it("should parse an error block successfully", async () => {
    const { spawn } = await import("node:child_process");

    const mockResponse = JSON.stringify({
      success: true,
      data: {
        errorType: "ECONNREFUSED",
        errorMessage: "Connection refused",
        stackFrames: [],
        contextLines: ["context line"],
        severity: "high",
      },
    });

    (spawn as ReturnType<typeof vi.fn>).mockReturnValueOnce(
      createMockProcess(mockResponse)
    );

    const { SubprocessAgentClient } = await import("../agents/SubprocessAgentClient.js");
    const client = new SubprocessAgentClient(config);
    const result = await client.parse("ERROR: test", ["context"]);

    expect(result.errorType).toBe("ECONNREFUSED");
    expect(result.severity).toBe("high");
  });

  it("should handle agent errors with retries", async () => {
    const { spawn } = await import("node:child_process");

    const errorResponse = JSON.stringify({
      success: false,
      error: "LLM failed",
    });

    // All 3 attempts fail
    (spawn as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce(createMockProcess(errorResponse))
      .mockReturnValueOnce(createMockProcess(errorResponse))
      .mockReturnValueOnce(createMockProcess(errorResponse));

    const { SubprocessAgentClient } = await import("../agents/SubprocessAgentClient.js");

    const client = new SubprocessAgentClient(config);
    (client as unknown as { retryDelays: number[] }).retryDelays = [0, 0, 0];

    await expect(client.parse("ERROR: test", ["context"])).rejects.toThrow(
      "Agent returned error: LLM failed"
    );
  }, 10000);

  it("should handle non-zero exit code", async () => {
    const { spawn } = await import("node:child_process");

    // All 3 attempts fail with exit code 1
    (spawn as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce(createMockProcess("", 1))
      .mockReturnValueOnce(createMockProcess("", 1))
      .mockReturnValueOnce(createMockProcess("", 1));

    const { SubprocessAgentClient } = await import("../agents/SubprocessAgentClient.js");
    const client = new SubprocessAgentClient(config);
    (client as unknown as { retryDelays: number[] }).retryDelays = [0, 0, 0];

    await expect(client.parse("ERROR: test", ["context"])).rejects.toThrow(
      "Agent exited with code 1"
    );
  }, 10000);
});
