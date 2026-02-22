import crypto from "node:crypto";
import { getLogger } from "../utils/logger.js";

export interface IDedupService {
  /**
   * Check if a raw error line is a duplicate and record it if not.
   */
  isDuplicate(rawErrorLine: string): boolean;

  /**
   * Stop background eviction tasks.
   */
  stop(): void;
}

/**
 * In-memory implementation of Deduplication Service.
 * Suitable for single-instance MVP deployments.
 */
export class InMemoryDedupService implements IDedupService {
  private dedupMap: Map<string, number> = new Map();
  private dedupTtlMs: number;
  private evictionInterval: ReturnType<typeof setInterval> | null = null;

  constructor(ttlMs: number) {
    this.dedupTtlMs = ttlMs;
    this.startEviction();
  }

  isDuplicate(raw: string): boolean {
    const hash = this.computeHash(raw);
    const lastSeen = this.dedupMap.get(hash);

    if (lastSeen && Date.now() - lastSeen < this.dedupTtlMs) {
      return true; // Duplicate detected
    }

    this.dedupMap.set(hash, Date.now());
    return false; // New unique error
  }

  private startEviction(): void {
    if (this.evictionInterval) return;
    this.evictionInterval = setInterval(() => this.evictExpired(), 60_000);
  }

  private evictExpired(): void {
    const now = Date.now();
    let evicted = 0;

    for (const [hash, timestamp] of this.dedupMap.entries()) {
      if (now - timestamp >= this.dedupTtlMs) {
        this.dedupMap.delete(hash);
        evicted++;
      }
    }

    if (evicted > 0) {
      getLogger().debug(
        { evicted, remaining: this.dedupMap.size },
        "Dedup eviction"
      );
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
    if (this.evictionInterval) {
      clearInterval(this.evictionInterval);
      this.evictionInterval = null;
    }
  }
}
