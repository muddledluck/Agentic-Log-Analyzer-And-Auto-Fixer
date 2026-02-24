import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

// We need to test loadConfig directly, so we'll manipulate env vars
describe("Config Module", () => {
  const originalEnv = { ...process.env };
  let tmpDir: string;
  let tmpLogFile: string;

  beforeEach(() => {
    // Create temp directory and log file
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "alaa-test-"));
    tmpLogFile = path.join(tmpDir, "test.log");
    fs.writeFileSync(tmpLogFile, "");

    // Reset env
    process.env = { ...originalEnv };
    process.env.LOG_FILE_PATH = tmpLogFile;
    process.env.REPORT_DIR = path.join(tmpDir, "reports");
  });

  afterEach(() => {
    process.env = originalEnv;
    // Clean up temp files
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("should load valid config with defaults", async () => {
    const { loadConfig } = await import("../config/index.js");
    const config = loadConfig();

    expect(config.logFilePath).toBe(path.resolve(tmpLogFile));
    expect(config.dedupTtlMs).toBe(300000);
    expect(config.crewaiMode).toBe("http");
    expect(config.parserLlmModel).toBe("ollama/llama3");
    expect(config.debuggerLlmModel).toBe("openai/gpt-4o");
    expect(config.fallbackLlmModel).toBe("ollama/llama3");
    expect(config.llmBaseUrl).toBe("http://host.docker.internal:11434");
    expect(config.logLevel).toBe("info");

    // Phase 11 defaults
    expect(config.enableDockerSource).toBe(false);
    expect(config.enablePm2Source).toBe(false);
    expect(config.enableWebhookSource).toBe(false);
    expect(config.webhookPort).toBe(9090);
    expect(config.dockerContainerNames).toEqual([]);
    expect(config.pm2ProcessNames).toEqual([]);
  });;

  it("should respect custom env vars", async () => {
    process.env.DEDUP_TTL_MS = "60000";
    process.env.PARSER_LLM_MODEL = "codellama";
    process.env.DEBUGGER_LLM_MODEL = "gpt-4";
    process.env.LOG_LEVEL = "debug";

    const { loadConfig } = await import("../config/index.js");
    const config = loadConfig();

    expect(config.dedupTtlMs).toBe(60000);
    expect(config.parserLlmModel).toBe("codellama");
    expect(config.debuggerLlmModel).toBe("gpt-4");
    expect(config.logLevel).toBe("debug");
  });

  it("should throw if LOG_FILE_PATH does not exist", async () => {
    process.env.LOG_FILE_PATH = "/nonexistent/path/file.log";

    const { loadConfig } = await import("../config/index.js");
    expect(() => loadConfig()).toThrow("LOG_FILE_PATH does not exist");
  });

  it("should create report directory if it does not exist", async () => {
    const reportDir = path.join(tmpDir, "new-reports");
    process.env.REPORT_DIR = reportDir;

    const { loadConfig } = await import("../config/index.js");
    loadConfig();

    expect(fs.existsSync(reportDir)).toBe(true);
  });

  it("should throw for invalid DEDUP_TTL_MS", async () => {
    process.env.DEDUP_TTL_MS = "not-a-number";

    const { loadConfig } = await import("../config/index.js");
    expect(() => loadConfig()).toThrow("Invalid DEDUP_TTL_MS");
  });
});
