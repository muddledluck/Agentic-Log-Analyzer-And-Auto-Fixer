import { EventBus } from "../events/EventBus.js";
import { getLogger } from "../utils/logger.js";
import type { AppConfig, ErrorBlock } from "../types/index.js";
import type { IDedupService } from "../services/DedupService.js";
import type { AnalysisQueue } from "../queue/AnalysisQueue.js";

/**
 * Central pipeline coordinator.
 * Receives error-detected events, deduplicates, and passes valid errors to the Queue.
 */
export class Orchestrator {
  private bus: EventBus;
  private queue: AnalysisQueue;
  private dedupService: IDedupService;

  constructor(
    config: AppConfig,
    queue: AnalysisQueue,
    dedupService: IDedupService,
  ) {
    this.bus = EventBus.getInstance();
    this.queue = queue;
    this.dedupService = dedupService;
  }

  /**
   * Start listening for error-detected events.
   */
  start(): void {
    const logger = getLogger();

    this.bus.on("error-detected", (errorBlock) => {
      this.handleError(errorBlock);
    });

    logger.info("Orchestrator started");
  }

  /**
   * Process a single error through the full pipeline.
   */
  private async handleError(errorBlock: ErrorBlock): Promise<void> {
    const logger = getLogger();
    const errorId = errorBlock.id;

    try {
      // 1. Deduplication check
      if (await this.dedupService.isDuplicate(errorBlock.raw)) {
        logger.info({ errorId }, "Duplicate error — skipping");
        return;
      }

      logger.info(
        { errorId },
        "Error verified unique. Adding to processing queue.",
      );

      // 2. Queue for asynchronous agent processing
      await this.queue.add(errorBlock);
    } catch (err) {
      logger.error({ err, errorId }, "Orchestration routing failed");

      this.bus.emit("processing-error", {
        errorId,
        stage: "report", // routing level error
        message: (err as Error).message,
        error: err as Error,
      });
    }
  }

  /**
   * Stop the orchestrator. Called during graceful shutdown.
   */
  async stop(): Promise<void> {
    await this.queue.stop();
    this.dedupService.stop();
    getLogger().info("Orchestrator stopped");
  }
}
