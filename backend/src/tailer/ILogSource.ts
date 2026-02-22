export interface ILogSource {
  /**
   * Start listening/watching the log source.
   */
  start(): Promise<void>;

  /**
   * Stop watching the log source.
   */
  stop(): void | Promise<void>;
}
