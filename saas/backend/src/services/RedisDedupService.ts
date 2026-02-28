import { redisClient } from '../config/redis';
import crypto from 'crypto';

export class RedisDedupService {
  private readonly DEFAULT_TTL_SECONDS = 300; // 5 minutes

  /**
   * Checks if an error block is a duplicate for a specific project.
   * If it's new, it caches the hash and returns false.
   * If it's a duplicate, it returns true.
   */
  public async isDuplicate(projectId: string, rawBlock: string): Promise<boolean> {
    try {
      const hash = crypto.createHash('sha256').update(rawBlock).digest('hex');
      const key = `dedup:${projectId}:${hash}`;

      // SETNX: Sets the value only if it does not exist (1 if set, 0 if not set)
      const isNew = await redisClient.set(key, '1', 'EX', this.DEFAULT_TTL_SECONDS, 'NX');

      return isNew !== 'OK'; 
    } catch (error) {
      console.error('Redis deduction logic failed. Failing open to prevent message loss:', error);
      return false; // Fail open
    }
  }
}

export const redisDedupService = new RedisDedupService();
