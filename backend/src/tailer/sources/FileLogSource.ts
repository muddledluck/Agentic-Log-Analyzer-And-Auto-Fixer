import fs from "node:fs";
import readline from "node:readline";
import crypto from "node:crypto";
import { EventBus } from "../../events/EventBus.js";
import { getLogger } from "../../utils/logger.js";
import type { ErrorBlock } from "../../types/index.js";
import type { ILogSource } from "../ILogSource.js";

const ERROR_PATTERN = /(ERROR|Exception|FATAL)/i;
const TIMESTAMP_PATTERN = /\[(\d{4}-\d{2}-\d{2}T[\d:.]+Z?)\]/;
const CONTEXT_BUFFER_SIZE = 10;

/**
 * Watches a log file for new ERROR/Exception lines.
 * Implements ILogSource.
 */
export class FileLogSource implements ILogSource {
  private filePath: string;
  private offset: number = 0;
  private watcher: fs.FSWatcher | null = null;
  private contextBuffer: string[] = [];
  private bus: EventBus;
  private isProcessing: boolean = false;
  private retryCount: number = 0;
  private maxRetries: number = 5;

  constructor(filePath: string) {
    this.filePath = filePath;
    this.bus = EventBus.getInstance();
  }

  async start(): Promise<void> {
    const logger = getLogger();

    if (!fs.existsSync(this.filePath)) {
      logger.warn(`Log file ${this.filePath} does not exist yet. Watching dir.`);
      // In a real app we might watch the dir for creation, but for MVP we will throw or retry.
      // Keeping it simple for the MVP implementation.
    }

    const stats = fs.existsSync(this.filePath) ? fs.statSync(this.filePath) : { size: 0 };
    this.offset = stats.size;
    logger.info({ filePath: this.filePath, offset: this.offset }, "FileLogSource started");

    if (fs.existsSync(this.filePath)) {
      this.attachWatcher();
    } else {
      // Fallback polling if file doesn't exist yet
      this.handleWatcherError();
    }
  }

  private attachWatcher() {
    this.watcher = fs.watch(this.filePath, (eventType) => {
      if (eventType === "change" && !this.isProcessing) {
        this.processNewLines();
      }
    });

    this.watcher.on("error", (err) => {
      getLogger().error({ err, filePath: this.filePath }, "File watcher error");
      this.handleWatcherError();
    });
  }

  private async processNewLines(): Promise<void> {
    this.isProcessing = true;
    const logger = getLogger();

    try {
      const stats = fs.statSync(this.filePath);

      if (stats.size < this.offset) {
        logger.warn("File truncated, resetting offset to 0");
        this.offset = 0;
      }

      if (stats.size === this.offset) {
        return;
      }

      const stream = fs.createReadStream(this.filePath, {
        start: this.offset,
        encoding: "utf-8",
      });

      const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

      for await (const line of rl) {
        this.processLine(line);
      }

      this.offset = stats.size;
      this.retryCount = 0;
    } catch (err) {
      logger.error({ err }, "Error processing new lines");
    } finally {
      this.isProcessing = false;
    }
  }

  private processLine(line: string): void {
    const trimmed = line.trim();
    if (!trimmed) return;

    this.contextBuffer.push(trimmed);
    if (this.contextBuffer.length > CONTEXT_BUFFER_SIZE) {
      this.contextBuffer.shift();
    }

    if (ERROR_PATTERN.test(trimmed)) {
      const errorBlock = this.createErrorBlock(trimmed);
      this.bus.emit("error-detected", errorBlock);
      getLogger().info({ errorId: errorBlock.id, raw: trimmed }, "Error detected by FileLogSource");
    }
  }

  private createErrorBlock(line: string): ErrorBlock {
    const timestampMatch = line.match(TIMESTAMP_PATTERN);

    return {
      id: crypto.randomUUID(),
      raw: line,
      contextLines: [...this.contextBuffer],
      timestamp: timestampMatch?.[1] ?? new Date().toISOString(),
      source: `file://${this.filePath}`,
    };
  }

  private handleWatcherError(): void {
    const logger = getLogger();

    if (this.retryCount >= this.maxRetries) {
      logger.fatal("Max retries exceeded for file watcher. Exiting.");
      process.exit(1);
    }

    this.retryCount++;
    const delay = Math.pow(2, this.retryCount) * 1000;
    logger.warn({ retryCount: this.retryCount, delayMs: delay }, "Retrying file watcher");

    setTimeout(() => {
      this.stop();
      this.start();
    }, delay);
  }

  stop(): void {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
    getLogger().info("FileLogSource stopped");
  }
}
