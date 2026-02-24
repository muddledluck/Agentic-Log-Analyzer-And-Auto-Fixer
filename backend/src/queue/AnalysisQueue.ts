import { Queue, Worker, type Job } from "bullmq";
import { getLogger } from "../utils/logger.js";
import { EventBus } from "../events/EventBus.js";
import { ReportGenerator } from "../reporter/ReportGenerator.js";
import type { AppConfig, ErrorBlock, AnalysisResult } from "../types/index.js";
import type { IAgentClient } from "../agents/IAgentClient.js";
import { Redis } from "ioredis";

export class AnalysisQueue {
  private queue: Queue;
  private worker: Worker;
  private agentClient: IAgentClient;
  private reportGenerator: ReportGenerator;
  private bus: EventBus;
  private connection: Redis;

  constructor(
    config: AppConfig,
    agentClient: IAgentClient,
  ) {
    this.agentClient = agentClient;
    this.reportGenerator = new ReportGenerator(config);
    this.bus = EventBus.getInstance();
    
    // We reuse ioredis for BullMQ as recommended
    this.connection = new Redis(config.redisUrl, {
      maxRetriesPerRequest: null,
    });

    this.queue = new Queue("error-analysis-queue", {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      connection: this.connection as any,
    });

    this.worker = new Worker(
      "error-analysis-queue",
      async (job: Job<ErrorBlock>) => {
        return this.processJob(job.data);
      },
      {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        connection: this.connection as any,
        concurrency: 2, // Process up to 2 errors concurrently
      },
    );

    this.setupWorkerEvents();
    getLogger().info("AnalysisQueue (BullMQ) initialized with 2 workers");
  }

  private setupWorkerEvents(): void {
    const logger = getLogger();

    this.worker.on("completed", (job: Job) => {
      logger.info({ jobId: job.id, errorId: job.data.id }, "Job completed successfully");
    });

    this.worker.on("failed", (job: Job | undefined, err: Error) => {
      if (!job) return;
      const attempts = job.opts.attempts ?? 1;
      const exhausted = job.attemptsMade >= attempts;

      logger.error(
        { err, jobId: job.id, errorId: job.data.id, attemptsMade: job.attemptsMade, attempts },
        exhausted ? "Job exhausted all retries" : "Job failed attempt"
      );
      
      if (exhausted) {
        this.bus.emit("processing-error", {
          errorId: job.data.id,
          stage: this.inferStage(err),
          message: err.message,
          error: err,
        });
      }
    });
  }

  private inferStage(err: Error): "parse" | "debug" | "report" {
    const msg = err.message.toLowerCase();
    if (msg.includes("parse")) return "parse";
    if (msg.includes("report") || msg.includes("write")) return "report";
    return "debug";
  }

  async add(errorBlock: ErrorBlock): Promise<void> {
    await this.queue.add("analyze-error", errorBlock, {
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 2000,
      },
      removeOnComplete: true, // Keep Redis clean
      removeOnFail: false, // Keep failed jobs for inspection
    });
    getLogger().info({ errorId: errorBlock.id }, "ErrorBlock added to AnalysisQueue");
  }

  private async processJob(errorBlock: ErrorBlock): Promise<AnalysisResult> {
    const logger = getLogger();
    const errorId = errorBlock.id;

    logger.info({ errorId }, "Worker started processing error");

    // 1. Parser Agent
    const parsedError = await this.agentClient.parse(
      errorBlock.raw,
      errorBlock.contextLines
    );
    logger.info({ errorId, errorType: parsedError.errorType }, "Parse complete");

    // 2. Debugger Agent
    const diagnosis = await this.agentClient.debug(parsedError);
    logger.info({ errorId, confidence: diagnosis.confidence }, "Debug complete");

    // 3. Report Generator
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

    // 4. Emit events
    this.bus.emit("analysis-complete", result);
    this.bus.emit("report-generated", {
      filePath: reportPath,
      errorId,
      generatedAt: new Date(),
    });

    logger.info({ errorId, reportPath }, "Worker pipeline complete");
    return result;
  }

  async stop(): Promise<void> {
    const logger = getLogger();
    await this.worker.close();
    await this.queue.close();
    this.connection.disconnect();
    logger.info("AnalysisQueue stopped");
  }
}
