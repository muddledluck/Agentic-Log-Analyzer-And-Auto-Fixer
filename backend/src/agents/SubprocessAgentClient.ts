import { spawn } from "node:child_process";
import path from "node:path";
import { getLogger } from "../utils/logger.js";
import type { AppConfig, ParsedError, Diagnosis } from "../types/index.js";
import type { IAgentClient } from "./IAgentClient.js";

const CREWAI_SCRIPT = path.resolve("src/agents/crewai-service/main.py");
const TIMEOUT_MS = 60_000;

interface AgentRequest {
  action: "parse" | "debug";
  payload: Record<string, unknown>;
  config: {
    model: string;
    baseUrl: string;
  };
}

interface AgentResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Client for invoking the Python CrewAI sidecar.
 * MVP: subprocess mode (stdin/stdout JSON).
 */
export class SubprocessAgentClient implements IAgentClient {
  private config: AppConfig;
  private maxRetries: number = 3;
  private retryDelays: number[] = [0, 2000, 5000];

  constructor(config: AppConfig) {
    this.config = config;
  }

  /**
   * Send a raw error block to the Parser Agent.
   * Returns structured ParsedError.
   */
  async parse(rawBlock: string, contextLines: string[]): Promise<ParsedError> {
    const request: AgentRequest = {
      action: "parse",
      payload: { rawBlock, contextLines },
      config: {
        model: this.config.ollamaModel,
        baseUrl: this.config.ollamaBaseUrl,
      },
    };

    const response = await this.invokeWithRetry<ParsedError>(request);
    return response;
  }

  /**
   * Send a parsed error to the Debugger Agent.
   * Returns Diagnosis with root cause and fix.
   */
  async debug(parsedError: ParsedError): Promise<Diagnosis> {
    const request: AgentRequest = {
      action: "debug",
      payload: { parsedError },
      config: {
        model: this.config.ollamaModel,
        baseUrl: this.config.ollamaBaseUrl,
      },
    };

    const response = await this.invokeWithRetry<Diagnosis>(request);
    return response;
  }

  /**
   * Invoke the Python process with retries.
   */
  private async invokeWithRetry<T>(request: AgentRequest): Promise<T> {
    const logger = getLogger();

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          const delay = this.retryDelays[attempt] ?? 5000;
          logger.warn(
            { attempt: attempt + 1, delayMs: delay },
            "Retrying agent call"
          );
          await this.sleep(delay);
        }

        return await this.invoke<T>(request);
      } catch (err) {
        logger.error({ err, attempt: attempt + 1 }, "Agent invocation failed");

        if (attempt === this.maxRetries - 1) {
          throw err;
        }
      }
    }

    throw new Error("Unreachable: all retries exhausted");
  }

  /**
   * Spawn python subprocess, send JSON via stdin, read JSON from stdout.
   */
  private invoke<T>(request: AgentRequest): Promise<T> {
    return new Promise((resolve, reject) => {
      const logger = getLogger();

      const proc = spawn("python3", [CREWAI_SCRIPT], {
        stdio: ["pipe", "pipe", "pipe"],
        env: { ...process.env },
      });

      let stdout = "";
      let stderr = "";

      // Timeout — kill process if stuck
      const timer = setTimeout(() => {
        proc.kill("SIGKILL");
        reject(new Error(`Agent timed out after ${TIMEOUT_MS}ms`));
      }, TIMEOUT_MS);

      proc.stdout.on("data", (chunk: Buffer) => {
        stdout += chunk.toString();
      });

      proc.stderr.on("data", (chunk: Buffer) => {
        stderr += chunk.toString();
      });

      proc.on("close", (code) => {
        clearTimeout(timer);

        if (code !== 0) {
          logger.error({ code, stderr }, "Agent process exited with error");
          reject(new Error(`Agent exited with code ${code}: ${stderr}`));
          return;
        }

        try {
          const response: AgentResponse<T> = JSON.parse(stdout);

          if (!response.success) {
            reject(new Error(`Agent returned error: ${response.error}`));
            return;
          }

          resolve(response.data as T);
        } catch {
          logger.error({ stdout }, "Failed to parse agent response as JSON");
          reject(
            new Error(`Invalid JSON from agent: ${stdout.slice(0, 200)}`)
          );
        }
      });

      proc.on("error", (err) => {
        clearTimeout(timer);
        reject(new Error(`Failed to spawn agent: ${err.message}`));
      });

      // Send request via stdin
      proc.stdin.write(JSON.stringify(request));
      proc.stdin.end();
    });
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
