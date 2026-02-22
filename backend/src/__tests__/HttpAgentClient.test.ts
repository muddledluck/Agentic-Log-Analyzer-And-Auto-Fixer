import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { HttpAgentClient } from "../agents/HttpAgentClient.js";
import { createLogger } from "../utils/logger.js";
import type { AppConfig, ParsedError } from "../types/index.js";

const mockConfig: AppConfig = {
  logFilePath: "/tmp/fake.log",
  reportDir: "/tmp/reports",
  dedupTtlMs: 300000,
  crewaiMode: "http",
  crewaiHost: "http://localhost:8000",
  ollamaModel: "llama3",
  ollamaBaseUrl: "http://localhost:11434",
  logLevel: "silent",
  redisUrl: "redis://localhost:6379",
};

describe("HttpAgentClient", () => {
  let client: HttpAgentClient;

  beforeEach(() => {
    createLogger({ logLevel: "silent" });
    client = new HttpAgentClient(mockConfig);
    // @ts-ignore
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should successfully parse an error via HTTP", async () => {
    const mockResponse = {
      success: true,
      data: {
        errorType: "TestType",
        errorMessage: "Test msg",
        stackFrames: [],
        contextLines: [],
        severity: "low",
      },
    };

    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    });

    const result = await client.parse("raw", ["context"]);

    expect(global.fetch).toHaveBeenCalledWith(
      "http://localhost:8000/api/parse",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: expect.any(String),
      }),
    );
    expect(result.errorType).toBe("TestType");
  });

  it("should retry on HTTP error and eventually succeed", async () => {
    const mockResponse = {
      success: true,
      data: {
        rootCause: "Cause",
        explanation: "Expl",
        suggestedFix: {
          language: "ts",
          fixed: "code",
          description: "fix",
        },
        severity: "medium",
        confidence: 90,
        additionalNotes: [],
      },
    };

    // First call fails, second succeeds
    (global.fetch as any)
      .mockRejectedValueOnce(new Error("Network error"))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

    // We reduce retry delays for test speed
    // @ts-ignore
    client.retryDelays = [0, 10, 20];

    const parsed: ParsedError = {
      errorType: "E",
      errorMessage: "M",
      stackFrames: [],
      contextLines: [],
      severity: "low",
    };

    const result = await client.debug(parsed);

    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(result.rootCause).toBe("Cause");
  });

  it("should throw if agent responds with success=false", async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({
        success: false,
        error: "LLM internal error",
      }),
    });

    // @ts-ignore
    client.retryDelays = [0, 10, 20];

    await expect(client.parse("raw", [])).rejects.toThrow("LLM internal error");
  });
});
