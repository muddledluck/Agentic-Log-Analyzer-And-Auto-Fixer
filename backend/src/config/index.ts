import dotenv from "dotenv";
import path from "node:path";
import fs from "node:fs";
import type { AppConfig } from "../types/index.js";

export function loadConfig(): AppConfig {
  dotenv.config();

  const config: AppConfig = {
    logFilePath: path.resolve(process.env.LOG_FILE_PATH ?? "./system.log"),
    reportDir: path.resolve(process.env.REPORT_DIR ?? "./reports"),
    dedupTtlMs: parseInt(process.env.DEDUP_TTL_MS ?? "300000", 10),
    crewaiMode:
      (process.env.CREWAI_MODE as "subprocess" | "http") ?? "subprocess",
    crewaiHost: process.env.CREWAI_HOST ?? "http://localhost:8000",
    ollamaModel: process.env.OLLAMA_MODEL ?? "llama3",
    ollamaBaseUrl: process.env.OLLAMA_BASE_URL ?? "http://localhost:11434",
    logLevel: process.env.LOG_LEVEL ?? "info",
  };

  validate(config);
  return config;
}

function validate(config: AppConfig): void {
  // Check log file exists
  if (!fs.existsSync(config.logFilePath)) {
    throw new Error(`LOG_FILE_PATH does not exist: ${config.logFilePath}`);
  }

  // Ensure report directory exists (create if not)
  if (!fs.existsSync(config.reportDir)) {
    fs.mkdirSync(config.reportDir, { recursive: true });
  }

  // Validate numeric config
  if (isNaN(config.dedupTtlMs) || config.dedupTtlMs < 0) {
    throw new Error(`Invalid DEDUP_TTL_MS: ${config.dedupTtlMs}`);
  }

  // Validate CrewAI mode
  if (!["subprocess", "http"].includes(config.crewaiMode)) {
    throw new Error(`Invalid CREWAI_MODE: ${config.crewaiMode}`);
  }
}
