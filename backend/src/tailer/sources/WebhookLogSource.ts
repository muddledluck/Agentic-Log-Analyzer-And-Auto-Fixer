import express, { type Express, type Request, type Response } from "express";
import http from "node:http";
import crypto from "node:crypto";
import { EventBus } from "../../events/EventBus.js";
import { getLogger } from "../../utils/logger.js";
import type { ErrorBlock } from "../../types/index.js";
import type { ILogSource } from "../ILogSource.js";

/** Incoming webhook payload schema */
interface WebhookPayload {
  /** Source identifier, e.g. "aws-cloudwatch", "gcp-logging", "custom" */
  source: string;
  /** The raw error text / stack trace */
  rawBlock: string;
  /** ISO 8601 timestamp (optional, defaults to now) */
  timestamp?: string;
  /** Optional surrounding context lines */
  contextLines?: string[];
}

/**
 * Push-based log source — spins up a lightweight Express HTTP server
 * to receive error payloads from cloud providers or custom scripts.
 *
 * Endpoint: POST /api/webhooks/ingest
 * Auth: x-webhook-secret header
 */
export class WebhookLogSource implements ILogSource {
  readonly name = "webhook";
  private app: Express;
  private server: http.Server | null = null;
  private port: number;
  private secretKey: string;
  private bus: EventBus;

  constructor(port: number, secretKey: string) {
    this.port = port;
    this.secretKey = secretKey;
    this.bus = EventBus.getInstance();
    this.app = express();
    this.app.use(express.json());
    this.setupRoutes();
  }

  private setupRoutes(): void {
    // Health check
    this.app.get("/api/webhooks/health", (_req: Request, res: Response) => {
      res.json({ status: "ok", source: "webhook" });
    });

    // Main ingestion endpoint
    this.app.post("/api/webhooks/ingest", (req: Request, res: Response) => {
      const logger = getLogger();

      // 1. Validate secret
      const token = req.headers["x-webhook-secret"] as string | undefined;
      if (token !== this.secretKey) {
        logger.warn("Webhook rejected: invalid secret");
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      // 2. Parse and validate payload
      const payload = req.body as WebhookPayload;
      if (!payload.source || !payload.rawBlock) {
        res.status(400).json({
          error: "Missing required fields: source, rawBlock",
        });
        return;
      }

      // 3. Normalize to ErrorBlock
      const errorBlock: ErrorBlock = {
        id: crypto.randomUUID(),
        raw: payload.rawBlock,
        contextLines: payload.contextLines ?? [],
        timestamp: payload.timestamp ?? new Date().toISOString(),
        source: `webhook://${payload.source}`,
      };

      // 4. Emit to pipeline
      this.bus.emit("error-detected", errorBlock);
      logger.info(
        { errorId: errorBlock.id, source: payload.source },
        "Webhook error ingested"
      );

      res.status(202).json({ accepted: true, errorId: errorBlock.id });
    });
  }

  async start(): Promise<void> {
    return new Promise((resolve) => {
      this.server = this.app.listen(this.port, () => {
        getLogger().info({ port: this.port }, "WebhookLogSource listening");
        resolve();
      });
    });
  }

  stop(): void {
    if (this.server) {
      this.server.close();
      this.server = null;
    }
    getLogger().info("WebhookLogSource stopped");
  }
}
