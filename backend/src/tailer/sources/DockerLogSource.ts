import type { ILogSource } from "../ILogSource.js";
import { getLogger } from "../../utils/logger.js";

/**
 * Stub for Docker Log Source plugin.
 */
export class DockerLogSource implements ILogSource {
  private containerName: string;

  constructor(containerName: string) {
    this.containerName = containerName;
  }

  async start(): Promise<void> {
    getLogger().info({ containerName: this.containerName }, "DockerLogSource started (STUB)");
    // TODO: Implement using Docker Engine API or child_process `docker logs -f`
  }

  stop(): void {
    getLogger().info("DockerLogSource stopped (STUB)");
  }
}
