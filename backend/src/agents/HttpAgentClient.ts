import { getLogger } from "../utils/logger.js";
import type { AppConfig, ParsedError, Diagnosis } from "../types/index.js";
import type { IAgentClient } from "./IAgentClient.js";

interface AgentRequest {
  payload: Record<string, unknown>;
  config: {
    parserModel: string;
    debuggerModel: string;
    fallbackModel?: string;
    baseUrl: string;
    apiKeys: {
      openai?: string;
      anthropic?: string;
      gemini?: string;
    };
  };
}

interface AgentResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Client for invoking the Python CrewAI service via HTTP (FastAPI).
 */
export class HttpAgentClient implements IAgentClient {
  private config: AppConfig;
  private maxRetries: number = 3;
  private retryDelays: number[] = [0, 2000, 5000];
  private endpoint: string;

  constructor(config: AppConfig) {
    this.config = config;
    this.endpoint = this.config.crewaiHost; // Default: http://localhost:8000
    
    // Ensure the endpoint doesn't end with a trailing slash
    if (this.endpoint.endsWith("/")) {
      this.endpoint = this.endpoint.slice(0, -1);
    }
  }

  /**
   * Send a raw error block to the Parser Agent via HTTP.
   */
  async parse(rawBlock: string, contextLines: string[]): Promise<ParsedError> {
    const request: AgentRequest = {
      payload: { rawBlock, contextLines },
      config: {
        parserModel: this.config.parserLlmModel,
        debuggerModel: this.config.debuggerLlmModel,
        fallbackModel: this.config.fallbackLlmModel,
        baseUrl: this.config.llmBaseUrl,
        apiKeys: this.config.apiKeys,
      },
    };

    return this.invokeWithRetry<ParsedError>("/api/parse", request);
  }

  /**
   * Send a parsed error to the Debugger Agent via HTTP.
   */
  async debug(parsedError: ParsedError): Promise<Diagnosis> {
    const request: AgentRequest = {
      payload: { parsedError },
      config: {
        parserModel: this.config.parserLlmModel,
        debuggerModel: this.config.debuggerLlmModel,
        fallbackModel: this.config.fallbackLlmModel,
        baseUrl: this.config.llmBaseUrl,
        apiKeys: this.config.apiKeys,
      },
    };

    return this.invokeWithRetry<Diagnosis>("/api/debug", request);
  }

  /**
   * Invoke the HTTP endpoint with retries.
   */
  private async invokeWithRetry<T>(path: string, request: AgentRequest): Promise<T> {
    const logger = getLogger();

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          const delay = this.retryDelays[attempt] ?? 5000;
          logger.warn({ attempt: attempt + 1, delayMs: delay }, `Retrying HTTP agent call to ${path}`);
          await this.sleep(delay);
        }

        return await this.invoke<T>(path, request);
      } catch (err) {
        logger.error({ err, attempt: attempt + 1, path }, "HTTP agent invocation failed");

        if (attempt === this.maxRetries - 1) {
          throw err;
        }
      }
    }

    throw new Error("Unreachable: all retries exhausted");
  }

  /**
   * Perform the actual fetch request.
   */
  private async invoke<T>(path: string, request: AgentRequest): Promise<T> {
    const url = `${this.endpoint}${path}`;
    const logger = getLogger();

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.config.agentTimeoutMs);

      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(request),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        throw new Error(`HTTP Error ${res.status}: ${res.statusText}`);
      }

      const response: AgentResponse<T> = await res.json() as AgentResponse<T>;

      if (!response.success) {
        throw new Error(`Agent returned error: ${response.error}`);
      }

      return response.data as T;
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") {
        throw new Error(`Agent HTTP request timed out for ${path}`);
      }
      throw err;
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
