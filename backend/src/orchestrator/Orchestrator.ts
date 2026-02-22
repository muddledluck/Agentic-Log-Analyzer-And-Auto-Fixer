import { EventBus } from "../events/EventBus.js";
import { ReportGenerator } from "../reporter/ReportGenerator.js";
import { getLogger } from "../utils/logger.js";
import type { AppConfig, ErrorBlock, AnalysisResult } from "../types/index.js";
import type { IAgentClient } from "../agents/IAgentClient.js";
import type { IDedupService } from "../services/DedupService.js";

/**
 * Central pipeline coordinator.
 * Receives error-detected events, deduplicates via IDedupService,
 * runs agents via IAgentClient, generates reports.
 */
export class Orchestrator {
  private bus: EventBus;
  private agentClient: IAgentClient;
  private dedupService: IDedupService;
  private reportGenerator: ReportGenerator;

  constructor(
    config: AppConfig,
    agentClient: IAgentClient,
    dedupService: IDedupService
  ) {
    this.bus = EventBus.getInstance();
    this.agentClient = agentClient;
    this.dedupService = dedupService;
    this.reportGenerator = new ReportGenerator(config);
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
      if (this.dedupService.isDuplicate(errorBlock.raw)) {
        logger.info({ errorId }, "Duplicate error — skipping");
        return;
      }

      logger.info({ errorId }, "Processing error through pipeline");

      // 2. Parser Agent
      const parsedError = await this.agentClient.parse(
        errorBlock.raw,
        errorBlock.contextLines
      );
      logger.info(
        { errorId, errorType: parsedError.errorType },
        "Parse complete"
      );

      // 3. Debugger Agent
      const diagnosis = await this.agentClient.debug(parsedError);
      logger.info(
        { errorId, confidence: diagnosis.confidence },
        "Debug complete"
      );

      // 4. Report Generator
      const reportPath = await this.reportGenerator.generate({
        errorBlock,
        parsedError,
        diagnosis,
        reportPath: "", // Will be set by generator
        processedAt: new Date(),
      });

      const result: AnalysisResult = {
        errorBlock,
        parsedError,
        diagnosis,
        reportPath,
        processedAt: new Date(),
      };

      // 5. Emit events
      this.bus.emit("analysis-complete", result);
      this.bus.emit("report-generated", {
        filePath: reportPath,
        errorId,
        generatedAt: new Date(),
      });

      logger.info({ errorId, reportPath }, "Pipeline complete");
    } catch (err) {
      logger.error({ err, errorId }, "Pipeline failed");

      this.bus.emit("processing-error", {
        errorId,
        stage: this.inferStage(err as Error),
        message: (err as Error).message,
        error: err as Error,
      });
    }
  }

  /**
   * Infer which pipeline stage failed based on the error.
   */
  private inferStage(err: Error): "parse" | "debug" | "report" {
    const msg = err.message.toLowerCase();
    if (msg.includes("parse")) return "parse";
    if (msg.includes("report") || msg.includes("write")) return "report";
    return "debug";
  }

  /**
   * Stop the orchestrator. Called during graceful shutdown.
   */
  stop(): void {
    this.dedupService.stop();
    getLogger().info("Orchestrator stopped");
  }
}
