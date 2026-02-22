import type { ILogSource } from "../ILogSource.js";
import { getLogger } from "../../utils/logger.js";

/**
 * Stub for PM2 Log Source plugin.
 */
export class PM2LogSource implements ILogSource {
  private processName: string;

  constructor(processName: string) {
    this.processName = processName;
  }

  async start(): Promise<void> {
    getLogger().info({ processName: this.processName }, "PM2LogSource started (STUB)");
    // TODO: Implement using PM2 API or child_process `pm2 logs --raw`
  }

  stop(): void {
    getLogger().info("PM2LogSource stopped (STUB)");
  }
}
