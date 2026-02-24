import type { ILogSource } from "./ILogSource.js";
import { FileLogSource } from "./sources/FileLogSource.js";
import { DockerLogSource } from "./sources/DockerLogSource.js";
import { PM2LogSource } from "./sources/PM2LogSource.js";
import { WebhookLogSource } from "./sources/WebhookLogSource.js";
import type { AppConfig } from "../types/index.js";
import { getLogger } from "../utils/logger.js";

/**
 * Factory class to initialize and manage log source plugins.
 * Conditionally registers adapters based on configuration flags.
 */
export class AdapterRegistry {
  private sources: ILogSource[] = [];

  constructor(config: AppConfig) {
    // Always register FileLogSource
    this.register(new FileLogSource(config.logFilePath));

    // Conditionally register Docker sources
    if (config.enableDockerSource && config.dockerContainerNames.length > 0) {
      for (const name of config.dockerContainerNames) {
        this.register(new DockerLogSource(name));
      }
      getLogger().info(
        { containers: config.dockerContainerNames },
        "Docker log sources registered",
      );
    }

    // Conditionally register PM2 sources
    if (config.enablePm2Source && config.pm2ProcessNames.length > 0) {
      for (const name of config.pm2ProcessNames) {
        this.register(new PM2LogSource(name));
      }
      getLogger().info(
        { processes: config.pm2ProcessNames },
        "PM2 log sources registered",
      );
    }

    // Conditionally register Webhook source
    if (config.enableWebhookSource) {
      this.register(
        new WebhookLogSource(config.webhookPort, config.webhookSecretKey),
      );
      getLogger().info(
        { port: config.webhookPort },
        "Webhook log source registered",
      );
    }
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
          { err: result.reason, source: this.sources[index]?.name },
          `Failed to start log source: ${this.sources[index]?.name}`,
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
