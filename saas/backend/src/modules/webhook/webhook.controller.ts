import { Request, Response } from 'express';
import crypto from 'crypto';
import prisma from '../../shared/utils/prisma';
import { redisDedupService } from './RedisDedupService';
import { ingestionQueue } from './IngestionQueue';

export const ingestError = async (req: Request, res: Response): Promise<void> => {
  try {
    const apiKeyHeader = req.headers['x-api-key'];

    if (!apiKeyHeader || typeof apiKeyHeader !== 'string') {
      res.status(401).json({ error: 'Unauthorized: Missing x-api-key header' });
      return;
    }

    // 1. Hash incoming $PROJECT_API_KEY and lookup against DB
    const keyHash = crypto.createHash('sha256').update(apiKeyHeader).digest('hex');
    
    // Performance Note: keyHash should be indexed in Postgres
    const apiKeyRecord = await prisma.apiKey.findUnique({
      where: { keyHash },
    });

    if (!apiKeyRecord) {
      res.status(401).json({ error: 'Unauthorized: Invalid API Key' });
      return;
    }

    const { projectId } = apiKeyRecord;
    const { source, rawBlock, timestamp, contextLines } = req.body;

    if (!rawBlock) {
      res.status(400).json({ error: 'Bad Request: rawBlock is required' });
      return;
    }

    // 2. Hash rawBlock. Check for dedup:{projectId}:{hash} in Redis.
    const isDuplicate = await redisDedupService.isDuplicate(projectId, rawBlock);

    if (isDuplicate) {
      // Abort 202 if duplicate
      res.status(202).json({ message: 'Accepted (Duplicate dropped)' });
      return;
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

    // 4. Return 202 Accepted
    res.status(202).json({ message: 'Accepted (Queued for processing)' });
  } catch (error) {
    console.error('Ingestion webhook error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
