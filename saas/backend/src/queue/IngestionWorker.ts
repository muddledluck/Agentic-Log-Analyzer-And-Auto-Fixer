import { Worker, Job } from 'bullmq';
import { redisClient } from '../config/redis';
import prisma from '../utils/prisma';
import { IngestionJobPayload } from './IngestionQueue';

// Placeholder for future HTTP POST to the Python AI stateless service
const mockPostToAIService = async (errorEventId: string, payload: any): Promise<string> => {
  console.log(`[BackgroundWorker] Mocking sync HTTP POST to Python AI for Event: ${errorEventId}...`);
  // Simulate network delay for AI generation
  await new Promise((resolve) => setTimeout(resolve, 2000));
  return `## AI Root Cause Analysis\n\nThis is a mock response for error event \`${errorEventId}\`\n\n**Raw Block:**\n\`\`\`\n${payload.rawBlock}\n\`\`\``;
};

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
          status: 'pending',
        },
      });

      // 2. Synchronous HTTP POST to Python AI
      const markdownBody = await mockPostToAIService(errorEvent.id, job.data);

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
        data: { status: 'resolved' },
      });

      console.log(`[BackgroundWorker] Successfully processed job ${job.id}. Report saved.`);
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
