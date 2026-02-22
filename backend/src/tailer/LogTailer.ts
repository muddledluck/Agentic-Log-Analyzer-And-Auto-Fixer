import fs from "node:fs";
import readline from "node:readline";
import crypto from "node:crypto";
import { EventBus } from "../events/EventBus.js";
import { getLogger } from "../utils/logger.js";
import type { AppConfig, ErrorBlock } from "../types/index.js";

const ERROR_PATTERN = /\b(ERROR|FATAL)\b|Exception/i;
const TIMESTAMP_PATTERN = /\[(\d{4}-\d{2}-\d{2}T[\d:.]+Z?)\]/;
const CONTEXT_BUFFER_SIZE = 10;

/**
 * Watches a log file for new ERROR/Exception lines.
 * Uses fs.watch + stream-based reading for memory efficiency.
 */
export class LogTailer {
  private filePath: string;
  private offset: number = 0;
  private watcher: fs.FSWatcher | null = null;
  private contextBuffer: string[] = [];
  private bus: EventBus;
  private isProcessing: boolean = false;
  private retryCount: number = 0;
  private maxRetries: number = 5;

  constructor(config: AppConfig) {
    this.filePath = config.logFilePath;
    this.bus = EventBus.getInstance();
  }

  /**
   * Start watching the log file.
   * Seeks to end of file — only processes new lines.
   */
  async start(): Promise<void> {
    const logger = getLogger();

    // Seek to end of file
    const stats = fs.statSync(this.filePath);
    this.offset = stats.size;
    logger.info(
      { filePath: this.filePath, offset: this.offset },
      "Log tailer started"
    );

    // Start file watcher
    this.watcher = fs.watch(this.filePath, (eventType) => {
      if (eventType === "change" && !this.isProcessing) {
        this.processNewLines();
      }
    });

    // Handle watcher errors
    this.watcher.on("error", (err) => {
      logger.error({ err, filePath: this.filePath }, "File watcher error");
      this.handleWatcherError();
    });
  }

  /**
   * Read new lines appended since last offset.
   */
  private async processNewLines(): Promise<void> {
    this.isProcessing = true;
    const logger = getLogger();

    try {
      const stats = fs.statSync(this.filePath);

      // File truncated (rotated) — reset offset
      if (stats.size < this.offset) {
        logger.warn("File truncated, resetting offset to 0");
        this.offset = 0;
      }

      // No new data
      if (stats.size === this.offset) {
        return;
      }

      // Create read stream from offset
      const stream = fs.createReadStream(this.filePath, {
        start: this.offset,
        encoding: "utf-8",
      });

      const rl = readline.createInterface({
        input: stream,
        crlfDelay: Infinity,
      });

      for await (const line of rl) {
        this.processLine(line);
      }

      // Update offset
      this.offset = stats.size;
      this.retryCount = 0; // Reset retry count on success
    } catch (err) {
      logger.error({ err }, "Error processing new lines");
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Process a single log line:
   * - Add to circular context buffer
   * - If ERROR/Exception detected, emit ErrorBlock
   */
  private processLine(line: string): void {
    const trimmed = line.trim();
    if (!trimmed) return;

    // Add to circular buffer
    this.contextBuffer.push(trimmed);
    if (this.contextBuffer.length > CONTEXT_BUFFER_SIZE) {
      this.contextBuffer.shift();
    }

    // Check for error pattern
    if (ERROR_PATTERN.test(trimmed)) {
      const errorBlock = this.createErrorBlock(trimmed);
      this.bus.emit("error-detected", errorBlock);
      getLogger().info(
        { errorId: errorBlock.id, raw: trimmed },
        "Error detected"
      );
    }
  }

  /**
   * Create an ErrorBlock from a matched error line.
   */
  private createErrorBlock(line: string): ErrorBlock {
    const timestampMatch = line.match(TIMESTAMP_PATTERN);

    return {
      id: crypto.randomUUID(),
      raw: line,
      contextLines: [...this.contextBuffer],
      timestamp: timestampMatch?.[1] ?? new Date().toISOString(),
      source: this.filePath,
    };
  }

  /**
   * Handle watcher errors with exponential backoff reconnect.
   */
  private handleWatcherError(): void {
    const logger = getLogger();

    if (this.retryCount >= this.maxRetries) {
      logger.fatal("Max retries exceeded for file watcher. Exiting.");
      process.exit(1);
    }

    this.retryCount++;
    const delay = Math.pow(2, this.retryCount) * 1000; // exponential backoff
    logger.warn(
      { retryCount: this.retryCount, delayMs: delay },
      "Retrying file watcher"
    );

    setTimeout(() => {
      this.stop();
      this.start();
    }, delay);
  }

  /**
   * Stop watching the file. Called during graceful shutdown.
   */
  stop(): void {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
    getLogger().info("Log tailer stopped");
  }
}
