import pino from "pino";
import type { AppConfig } from "../types/index.js";

let logger: pino.Logger;

export function createLogger(config: Pick<AppConfig, "logLevel">): pino.Logger {
  logger = pino({
    level: config.logLevel,
    transport: {
      target: "pino-pretty",
      options: {
        colorize: true,
        translateTime: "SYS:HH:MM:ss.l",
        ignore: "pid,hostname",
      },
    },
  });
  return logger;
}

export function getLogger(): pino.Logger {
  if (!logger) {
    throw new Error("Logger not initialized. Call createLogger() first.");
  }
  return logger;
}
