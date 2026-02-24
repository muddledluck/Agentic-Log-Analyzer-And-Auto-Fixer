import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createLogger } from "../utils/logger.js";
import { EventBus } from "../events/EventBus.js";
import { WebhookLogSource } from "../tailer/sources/WebhookLogSource.js";
import type { ErrorBlock } from "../types/index.js";

describe("WebhookLogSource", () => {
  let source: WebhookLogSource;
  const TEST_PORT = 19090;
  const TEST_SECRET = "test-secret-key";

  beforeEach(() => {
    createLogger({ logLevel: "silent" });
    EventBus.resetInstance();
    source = new WebhookLogSource(TEST_PORT, TEST_SECRET);
  });

  afterEach(async () => {
    source.stop();
    EventBus.resetInstance();
  });

  it("should have name 'webhook'", () => {
    expect(source.name).toBe("webhook");
  });

  it("should start and stop cleanly", async () => {
    await source.start();
    expect(() => source.stop()).not.toThrow();
  });

  it("should reject requests with invalid secret", async () => {
    await source.start();

    const res = await fetch(`http://localhost:${TEST_PORT}/api/webhooks/ingest`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-webhook-secret": "wrong-secret",
      },
      body: JSON.stringify({
        source: "test",
        rawBlock: "ERROR: test",
      }),
    });

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Unauthorized");
  });

  it("should reject requests with missing fields", async () => {
    await source.start();

    const res = await fetch(`http://localhost:${TEST_PORT}/api/webhooks/ingest`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-webhook-secret": TEST_SECRET,
      },
      body: JSON.stringify({ source: "test" }),
    });

    expect(res.status).toBe(400);
  });

  it("should accept valid payload and emit error-detected", async () => {
    await source.start();

    const bus = EventBus.getInstance();
    const received: ErrorBlock[] = [];
    bus.on("error-detected", (block) => {
      received.push(block);
    });

    const res = await fetch(`http://localhost:${TEST_PORT}/api/webhooks/ingest`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-webhook-secret": TEST_SECRET,
      },
      body: JSON.stringify({
        source: "aws-cloudwatch",
        rawBlock: "ERROR: Connection refused to database",
        timestamp: "2026-02-25T00:00:00Z",
        contextLines: ["context line 1"],
      }),
    });

    expect(res.status).toBe(202);
    const body = await res.json();
    expect(body.accepted).toBe(true);
    expect(body.errorId).toBeDefined();

    // Verify the EventBus received the error
    expect(received.length).toBe(1);
    expect(received[0].raw).toBe("ERROR: Connection refused to database");
    expect(received[0].source).toBe("webhook://aws-cloudwatch");
    expect(received[0].timestamp).toBe("2026-02-25T00:00:00Z");
    expect(received[0].contextLines).toEqual(["context line 1"]);
  });

  it("should return health check", async () => {
    await source.start();

    const res = await fetch(`http://localhost:${TEST_PORT}/api/webhooks/health`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("ok");
  });
});
