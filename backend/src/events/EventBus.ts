import { EventEmitter } from "node:events";
import type { EventMap } from "../types/index.js";
import { getLogger } from "../utils/logger.js";

type EventName = keyof EventMap;

/**
 * Singleton typed Event Bus wrapping Node.js EventEmitter.
 * All inter-module communication flows through this bus.
 */
export class EventBus {
  private static instance: EventBus;
  private emitter: EventEmitter;

  private constructor() {
    this.emitter = new EventEmitter();
    this.emitter.setMaxListeners(20);

    // Global error handler — never crash the process
    this.emitter.on("error", (err: Error) => {
      getLogger().error({ err }, "Unhandled event bus error");
    });
  }

  static getInstance(): EventBus {
    if (!EventBus.instance) {
      EventBus.instance = new EventBus();
    }
    return EventBus.instance;
  }

  emit<K extends EventName>(event: K, payload: EventMap[K]): void {
    getLogger().debug({ event }, "Event emitted");
    this.emitter.emit(event, payload);
  }

  on<K extends EventName>(
    event: K,
    handler: (payload: EventMap[K]) => void
  ): void {
    this.emitter.on(event, handler);
  }

  off<K extends EventName>(
    event: K,
    handler: (payload: EventMap[K]) => void
  ): void {
    this.emitter.off(event, handler);
  }

  /** Remove all listeners — used during shutdown */
  removeAllListeners(): void {
    this.emitter.removeAllListeners();
  }

  /** Reset singleton — used in tests only */
  static resetInstance(): void {
    if (EventBus.instance) {
      EventBus.instance.removeAllListeners();
    }
    EventBus.instance = undefined as unknown as EventBus;
  }
}
