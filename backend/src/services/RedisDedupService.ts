import { Redis } from "ioredis";
import crypto from "node:crypto";
import { getLogger } from "../utils/logger.js";
import type { IDedupService } from "./DedupService.js";

/**
 * Redis-backed implementation of Deduplication Service.
 * Suitable for distributed processing and multi-instance deployments.
 */
export class RedisDedupService implements IDedupService {
  private redis: Redis;
  private dedupTtlMs: number;
  private dedupTtlSeconds: number;

  constructor(ttlMs: number, redisUrl = "redis://localhost:6379") {
    this.dedupTtlMs = ttlMs;
    this.dedupTtlSeconds = Math.max(1, Math.floor(ttlMs / 1000));
    
    this.redis = new Redis(redisUrl);
    
    this.redis.on("error", (err: Error) => {
      getLogger().error({ err }, "Redis connection error in DedupService");
    });
    
    this.redis.on("connect", () => {
      getLogger().info("Connected to Redis for Deduplication");
    });
  }

  async isDuplicate(raw: string): Promise<boolean> {
    try {
      const hash = this.computeHash(raw);
      const key = `alaa:dedup:${hash}`;

      // SET key value EX seconds NX (Only set if it does not exist)
      // Returns "OK" if set (meaning it's new), or null if it already existed (meaning it's a duplicate)
      const result = await this.redis.set(key, Date.now().toString(), "EX", this.dedupTtlSeconds, "NX");

      if (result === "OK") {
        return false; // New unique error
      } else {
        return true; // Duplicate detected
      }
    } catch (err) {
      getLogger().error({ err }, "Redis error during isDuplicate check. Defaulting to processing the error.");
      // Fail open: if Redis is down, we process the error rather than dropping it silently.
      return false;
    }
  }

  private computeHash(raw: string): string {
    // Strip timestamp to normalize — hash only the error content
    const normalized = raw.replace(/\[.*?\]\s*/, "").trim();
    return crypto
      .createHash("sha256")
      .update(normalized)
      .digest("hex")
      .slice(0, 16);
  }

  stop(): void {
    this.redis.disconnect();
  }
}
