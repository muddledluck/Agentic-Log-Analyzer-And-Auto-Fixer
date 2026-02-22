import { loadConfig } from "./config/index.js";
import { createLogger } from "./utils/logger.js";
import { EventBus } from "./events/EventBus.js";
import { LogTailer } from "./tailer/LogTailer.js";
import { Orchestrator } from "./orchestrator/Orchestrator.js";
import { SubprocessAgentClient } from "./agents/SubprocessAgentClient.js";
import { InMemoryDedupService } from "./services/DedupService.js";

async function main(): Promise<void> {
  // 1. Load config
  const config = loadConfig();

  // 2. Initialize logger
  const logger = createLogger(config);
  logger.info("ALAA starting...");
  logger.info({ config: { ...config } }, "Configuration loaded");

  // 3. Initialize modules
  const tailer = new LogTailer(config);
  const agentClient = new SubprocessAgentClient(config);
  const dedupService = new InMemoryDedupService(config.dedupTtlMs);
  const orchestrator = new Orchestrator(config, agentClient, dedupService);

  // 4. Start pipeline
  orchestrator.start();
  await tailer.start();

  logger.info("✅ ALAA is running. Watching for errors...");

  // 5. Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info({ signal }, "Shutdown signal received");

    tailer.stop();
    orchestrator.stop();
    EventBus.getInstance().removeAllListeners();

    logger.info("Shutdown complete. Goodbye.");
    process.exit(0);
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));

  // Handle uncaught errors
  process.on("uncaughtException", (err) => {
    logger.fatal({ err }, "Uncaught exception");
    process.exit(1);
  });

  process.on("unhandledRejection", (reason) => {
    logger.fatal({ reason }, "Unhandled rejection");
    process.exit(1);
  });
}

main().catch((err) => {
  console.error("Fatal startup error:", err);
  process.exit(1);
});
