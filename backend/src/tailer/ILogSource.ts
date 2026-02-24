export interface ILogSource {
  /** Unique name describing this source instance */
  readonly name: string;

  /**
   * Start listening/watching the log source.
   */
  start(): Promise<void>;

  /**
   * Stop watching the log source.
   */
  stop(): void | Promise<void>;
}
