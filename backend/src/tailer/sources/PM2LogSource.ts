import pm2 from "pm2";
import crypto from "node:crypto";
import { EventBus } from "../../events/EventBus.js";
import { getLogger } from "../../utils/logger.js";
import type { ErrorBlock } from "../../types/index.js";
import type { ILogSource } from "../ILogSource.js";

/**
 * Packet structure received from the PM2 IPC bus for log events.
 */
interface PM2LogPacket {
  process: { name: string };
  data: string;
}

/**
 * Packet structure received from the PM2 IPC bus for exception events.
 */
interface PM2ExceptionPacket {
  process: { name: string };
  data: { message: string; stack?: string };
}

/**
 * Pull-based log source — connects to the PM2 daemon's IPC bus
 * and listens for log:err and process:exception events.
 *
 * Pass processName = "*" to listen to all PM2 processes.
 */
export class PM2LogSource implements ILogSource {
  readonly name: string;
  private processName: string;
  private bus: EventBus;
  private connected: boolean = false;

  constructor(processName: string) {
    this.processName = processName;
    this.name = `pm2:${processName}`;
    this.bus = EventBus.getInstance();
  }

  async start(): Promise<void> {
    const logger = getLogger();

    return new Promise((resolve, reject) => {
      pm2.connect((err) => {
        if (err) {
          logger.error({ err }, "Failed to connect to PM2 daemon");
          reject(err);
          return;
        }
        this.connected = true;

        pm2.launchBus((err, bus) => {
          if (err) {
            logger.error({ err }, "Failed to launch PM2 bus");
            reject(err);
            return;
          }

          // Listen for stderr log events
          bus.on("log:err", (packet: PM2LogPacket) => {
            if (
              packet.process.name === this.processName ||
              this.processName === "*"
            ) {
              this.handleError(packet.data, packet.process.name);
            }
          });

          // Listen for uncaught exceptions
          bus.on("process:exception", (packet: PM2ExceptionPacket) => {
            if (
              packet.process.name === this.processName ||
              this.processName === "*"
            ) {
              const raw = packet.data.stack ?? packet.data.message;
              this.handleError(raw, packet.process.name);
            }
          });

          logger.info(
            { processName: this.processName },
            "PM2LogSource connected to bus",
          );
          resolve();
        });
      });
    });
  }

  private handleError(rawData: string, processName: string): void {
    const errorBlock: ErrorBlock = {
      id: crypto.randomUUID(),
      raw: rawData,
      contextLines: [],
      timestamp: new Date().toISOString(),
      source: `pm2://${processName}`,
    };
    this.bus.emit("error-detected", errorBlock);
    getLogger().info(
      { errorId: errorBlock.id, process: processName },
      "PM2 error detected",
    );
  }

  stop(): void {
    if (this.connected) {
      pm2.disconnect();
      this.connected = false;
    }
    getLogger().info({ processName: this.processName }, "PM2LogSource stopped");
  }
}
