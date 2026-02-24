import Docker from "dockerode";
import crypto from "node:crypto";
import { EventBus } from "../../events/EventBus.js";
import { getLogger } from "../../utils/logger.js";
import type { ErrorBlock } from "../../types/index.js";
import type { ILogSource } from "../ILogSource.js";

const ERROR_PATTERN = /(ERROR|Exception|FATAL)/i;
const CONTEXT_BUFFER_SIZE = 10;

/**
 * Pull-based log source — connects to the Docker Engine socket
 * and streams stderr from specified containers via dockerode.
 */
export class DockerLogSource implements ILogSource {
  readonly name: string;
  private docker: Docker;
  private containerName: string;
  private bus: EventBus;
  private stream: NodeJS.ReadableStream | null = null;
  private contextBuffer: string[] = [];

  constructor(containerName: string) {
    this.containerName = containerName;
    this.name = `docker:${containerName}`;
    this.docker = new Docker({ socketPath: "/var/run/docker.sock" });
    this.bus = EventBus.getInstance();
  }

  async start(): Promise<void> {
    const logger = getLogger();
    const container = this.docker.getContainer(this.containerName);

    // Verify container exists
    await container.inspect();

    // Attach to log stream (follow mode, stderr only, new logs only)
    this.stream = (await container.logs({
      follow: true,
      stdout: false,
      stderr: true,
      tail: 0,
    })) as unknown as NodeJS.ReadableStream;

    // Process log stream line by line
    let buffer = "";
    this.stream.on("data", (chunk: Buffer) => {
      buffer += chunk.toString("utf-8");
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? ""; // keep incomplete line in buffer

      for (const line of lines) {
        this.processLine(line.trim());
      }
    });

    this.stream.on("error", (err) => {
      logger.error(
        { err, container: this.containerName },
        "Docker stream error",
      );
    });

    logger.info({ container: this.containerName }, "DockerLogSource started");
  }

  private processLine(line: string): void {
    if (!line) return;

    this.contextBuffer.push(line);
    if (this.contextBuffer.length > CONTEXT_BUFFER_SIZE) {
      this.contextBuffer.shift();
    }

    if (ERROR_PATTERN.test(line)) {
      const errorBlock: ErrorBlock = {
        id: crypto.randomUUID(),
        raw: line,
        contextLines: [...this.contextBuffer],
        timestamp: new Date().toISOString(),
        source: `docker://${this.containerName}`,
      };
      this.bus.emit("error-detected", errorBlock);
      getLogger().info({ errorId: errorBlock.id }, "Docker error detected");
    }
  }

  stop(): void {
    if (this.stream) {
      // Docker streams implement Readable which has destroy()
      if (
        "destroy" in this.stream &&
        typeof this.stream.destroy === "function"
      ) {
        (
          this.stream as NodeJS.ReadableStream & { destroy: () => void }
        ).destroy();
      }
      this.stream = null;
    }
    getLogger().info(
      { container: this.containerName },
      "DockerLogSource stopped",
    );
  }
}
