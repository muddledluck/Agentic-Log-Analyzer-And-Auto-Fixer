import type { ILogSource } from "./ILogSource.js";
import { FileLogSource } from "./sources/FileLogSource.js";
import type { AppConfig } from "../types/index.js";
import { getLogger } from "../utils/logger.js";

/**
 * Factory class to initialize and manage log source plugins.
 */
export class AdapterRegistry {
  private sources: ILogSource[] = [];

  constructor(config: AppConfig) {
    // For MVP, we automatically initialize the FileLogSource from config.
    this.register(new FileLogSource(config.logFilePath));

    // Stubs for future configuration-driven initialization
    // For example, if config.dockerContainers exists:
    // config.dockerContainers.forEach(container => this.register(new DockerLogSource(container)));
  }

  /**
   * Register a new log source to be managed.
   */
  register(source: ILogSource): void {
    this.sources.push(source);
  }

  /**
   * Start all registered log sources.
   */
  async startAll(): Promise<void> {
    getLogger().info(`Starting ${this.sources.length} log sources`);
    const results = await Promise.allSettled(
      this.sources.map((source) => source.start())
    );

    results.forEach((result, index) => {
      if (result.status === "rejected") {
        getLogger().error(
          { err: result.reason },
          `Failed to start log source at index ${index}`
        );
      }
    });
  }

  /**
   * Stop all registered log sources.
   */
  async stopAll(): Promise<void> {
    getLogger().info("Stopping all log sources");
    await Promise.all(this.sources.map((source) => source.stop()));
  }
}
