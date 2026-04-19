import { Worker, Job } from 'bullmq';
import { AiServiceClient } from "../../shared/services/AiServiceClient";
import { redisClient } from '../../config/redis';
import prisma from '../../shared/utils/prisma';
import { IngestionJobPayload } from './IngestionQueue';


export const ingestionWorker = new Worker<IngestionJobPayload, any, string>(
  'error-ingestion-queue',
  async (job: Job<IngestionJobPayload, any, string>) => {
    const { projectId, source, rawBlock, timestamp, contextLines } = job.data;
    console.log(`[BackgroundWorker] Processing job ${job.id} for project ${projectId}`);

    try {
      // 1. Insert into Postgres (State Persistence)
      const errorEvent = await prisma.errorEvent.create({
        data: {
          projectId,
          rawMessage: `[${source}] ${rawBlock}`,
          timestamp: new Date(timestamp),
          contextLines: contextLines || [],
          status: "pending",
        },
      });

      // 2. Synchronous HTTP POST to Python AI (via decoupled Service Client)
      const markdownBody = await AiServiceClient.analyzeError(
        errorEvent.id,
        job.data,
      );

      // 3. Save Final Report to Postgres
      await prisma.report.create({
        data: {
          errorEventId: errorEvent.id,
          markdownBody,
        },
      });

      // 4. Update Event Status
      await prisma.errorEvent.update({
        where: { id: errorEvent.id },
        data: { status: "resolved" },
      });

      console.log(
        `[BackgroundWorker] Successfully processed job ${job.id}. Report saved.`,
      );
    } catch (error) {
      console.error(`[BackgroundWorker] Job ${job.id} failed:`, error);
      throw error; // Let BullMQ handle exponential backoffs
    }
  },
  {
    connection: redisClient as any,
    concurrency: 5, // Process 5 jobs simultaneously
  }
);

ingestionWorker.on('failed', (job, err) => {
  console.error(`[BackgroundWorker] BullMQ Worker failed for job ${job?.id}:`, err.message);
});
