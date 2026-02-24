import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createLogger } from "../utils/logger.js";
import { EventBus } from "../events/EventBus.js";
import type { ErrorBlock } from "../types/index.js";

// Mock dockerode before importing DockerLogSource
vi.mock("dockerode", () => {
  const { EventEmitter } = require("node:events");

  class MockStream extends EventEmitter {
    destroy() {
      this.removeAllListeners();
    }
  }

  class MockContainer {
    async inspect() {
      return { Id: "test-container", Name: "test-app" };
    }
    async logs() {
      return new MockStream();
    }
  }

  class MockDocker {
    getContainer() {
      return new MockContainer();
    }
  }

  return { default: MockDocker };
});

describe("DockerLogSource", () => {
  let bus: EventBus;

  beforeEach(() => {
    createLogger({ logLevel: "silent" });
    EventBus.resetInstance();
    bus = EventBus.getInstance();
  });

  afterEach(() => {
    EventBus.resetInstance();
    vi.restoreAllMocks();
  });

  it("should have correct name", async () => {
    const { DockerLogSource } = await import(
      "../tailer/sources/DockerLogSource.js"
    );
    const source = new DockerLogSource("my-container");
    expect(source.name).toBe("docker:my-container");
  });

  it("should start and attach to Docker stream", async () => {
    const { DockerLogSource } = await import(
      "../tailer/sources/DockerLogSource.js"
    );
    const source = new DockerLogSource("my-container");
    await expect(source.start()).resolves.not.toThrow();
    source.stop();
  });

  it("should emit error-detected when ERROR pattern matches", async () => {
    const { DockerLogSource } = await import(
      "../tailer/sources/DockerLogSource.js"
    );
    const source = new DockerLogSource("my-container");

    const received: ErrorBlock[] = [];
    bus.on("error-detected", (block) => {
      received.push(block);
    });

    await source.start();

    // Simulate data coming from the Docker stream
    // @ts-expect-error Accessing private property for testing
    const stream = source.stream;
    stream.emit("data", Buffer.from("INFO: Server started\nERROR: Connection refused\n"));

    expect(received.length).toBe(1);
    expect(received[0].raw).toBe("ERROR: Connection refused");
    expect(received[0].source).toBe("docker://my-container");

    source.stop();
  });

  it("should NOT emit for non-error lines", async () => {
    const { DockerLogSource } = await import(
      "../tailer/sources/DockerLogSource.js"
    );
    const source = new DockerLogSource("my-container");

    const received: ErrorBlock[] = [];
    bus.on("error-detected", (block) => {
      received.push(block);
    });

    await source.start();

    // @ts-expect-error Accessing private property for testing
    const stream = source.stream;
    stream.emit("data", Buffer.from("INFO: All good\nDEBUG: Processing request\n"));

    expect(received.length).toBe(0);

    source.stop();
  });

  it("should stop cleanly", async () => {
    const { DockerLogSource } = await import(
      "../tailer/sources/DockerLogSource.js"
    );
    const source = new DockerLogSource("my-container");
    await source.start();
    expect(() => source.stop()).not.toThrow();
  });
});
