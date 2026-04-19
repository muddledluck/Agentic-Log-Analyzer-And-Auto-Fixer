import crypto from 'crypto';
import prisma from '../../shared/utils/prisma';
import { redisDedupService } from './RedisDedupService';
import { ingestionQueue } from './IngestionQueue';
import { UnauthorizedError } from '../../shared/errors/AppError';

export class WebhookService {
  static async processIngestion(apiKeyHeader: string, payload: any) {
    // 1. Hash incoming $PROJECT_API_KEY and lookup against DB
    const keyHash = crypto.createHash('sha256').update(apiKeyHeader).digest('hex');
    
    // Performance Note: keyHash should be indexed in Postgres
    const apiKeyRecord = await prisma.apiKey.findUnique({
      where: { keyHash },
    });

    if (!apiKeyRecord) {
      throw new UnauthorizedError('Unauthorized: Invalid API Key');
    }

    const { projectId } = apiKeyRecord;
    const { source, rawBlock, timestamp, contextLines } = payload;

    // 2. Hash rawBlock. Check for dedup:{projectId}:{hash} in Redis.
    const isDuplicate = await redisDedupService.isDuplicate(projectId, rawBlock);

    if (isDuplicate) {
      return { isDuplicate: true };
    }

    // 3. Push payload to BullMQ (Immediate DB inserts are bypassed)
    await ingestionQueue.add(
      'process-error',
      {
        projectId,
        source: source || 'unknown',
        rawBlock,
        timestamp: timestamp || new Date().toISOString(),
        contextLines: contextLines || [],
      },
      {
        attempts: 5,
        backoff: {
          type: 'exponential',
          delay: 10000,
        },
      }
    );

    return { isDuplicate: false };
  }
}
