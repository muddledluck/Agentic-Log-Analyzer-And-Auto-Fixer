import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { createLogger } from "../utils/logger.js";
import { ReportGenerator } from "../reporter/ReportGenerator.js";
import type { AppConfig, AnalysisResult } from "../types/index.js";

describe("ReportGenerator", () => {
  let tmpDir: string;
  let config: AppConfig;
  let generator: ReportGenerator;

  beforeEach(() => {
    createLogger({ logLevel: "silent" });

    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "alaa-report-test-"));
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

    generator = new ReportGenerator(config);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function createMockResult(
    severity: "critical" | "high" | "medium" | "low" = "high"
  ): AnalysisResult {
    return {
      errorBlock: {
        id: "test-error-123",
        raw: "[2026-01-01T00:00:00Z] ERROR: ECONNREFUSED: Connection refused",
        contextLines: ["previous line 1", "previous line 2"],
        timestamp: "2026-01-01T00:00:00Z",
        source: "/app/system.log",
      },
      parsedError: {
        errorType: "ECONNREFUSED",
        errorMessage: "Connection refused to upstream service",
        stackFrames: [
          {
            file: "src/server.ts",
            line: 42,
            functionName: "connectDB",
            code: 'await pg.connect("postgresql://...")',
          },
        ],
        contextLines: ["previous line 1", "previous line 2"],
        severity,
      },
      diagnosis: {
        rootCause:
          "Database server is not running or unreachable at port 5432",
        explanation:
          "The application tried to connect to a PostgreSQL database. The connection was refused because the DB server is down or the port is blocked.",
        suggestedFix: {
          language: "typescript",
          filePath: "src/server.ts",
          original: 'await pg.connect("postgresql://...")',
          fixed:
            'try {\n  await pg.connect("postgresql://...");\n} catch (err) {\n  logger.error("DB connection failed, retrying...");\n  await retry(connectDB, 3);\n}',
          description: "Add retry logic with error handling for DB connection",
        },
        severity,
        confidence: 85,
        additionalNotes: [
          "Check if PostgreSQL is running",
          "Verify connection string",
        ],
      },
      reportPath: "",
      processedAt: new Date(),
    };
  }

  it("should generate a markdown report file", async () => {
    const result = createMockResult();
    const reportPath = await generator.generate(result);

    expect(fs.existsSync(reportPath)).toBe(true);
    expect(reportPath.endsWith(".md")).toBe(true);
  });

  it("should include all required sections", async () => {
    const result = createMockResult();
    const reportPath = await generator.generate(result);
    const content = fs.readFileSync(reportPath, "utf-8");

    expect(content).toContain("Error Diagnostic Report");
    expect(content).toContain("Error Summary");
    expect(content).toContain("ECONNREFUSED");
    expect(content).toContain("Root Cause Analysis");
    expect(content).toContain("Proposed Fix");
    expect(content).toContain("85%"); // confidence
    expect(content).toContain("Additional Notes");
  });

  it("should include stack frames", async () => {
    const result = createMockResult();
    const reportPath = await generator.generate(result);
    const content = fs.readFileSync(reportPath, "utf-8");

    expect(content).toContain("connectDB");
    expect(content).toContain("src/server.ts:42");
  });

  it("should use correct severity emoji", async () => {
    const severities = [
      { level: "critical" as const, emoji: "🔴" },
      { level: "high" as const, emoji: "🟠" },
      { level: "medium" as const, emoji: "🟡" },
      { level: "low" as const, emoji: "🟢" },
    ];

    for (const { level, emoji } of severities) {
      const result = createMockResult(level);
      const reportPath = await generator.generate(result);
      const content = fs.readFileSync(reportPath, "utf-8");
      expect(content).toContain(emoji);
    }
  });

  it("should create correct filename format", async () => {
    const result = createMockResult();
    const reportPath = await generator.generate(result);
    const fileName = path.basename(reportPath);

    // Should match pattern: YYYY-MM-DDTHH-MM-SS_ERRORTYPE.md
    expect(fileName).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}_\w+\.md$/);
    expect(fileName).toContain("ECONNREFUSED");
  });
});
