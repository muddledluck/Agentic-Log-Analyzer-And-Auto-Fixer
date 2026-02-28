import { Queue } from 'bullmq';
import { redisClient } from '../../config/redis';

export interface IngestionJobPayload {
  projectId: string;
  source: string;
  rawBlock: string;
  timestamp: string;
  contextLines: string[] | any; // allow specific JSON structure
}

export const ingestionQueue = new Queue<IngestionJobPayload, any, string>('error-ingestion-queue', {
  connection: redisClient as any,
});
