import type { ParsedError, Diagnosis } from "../types/index.js";

/**
 * Interface for AI Agent Clients.
 * Defines the contract for parsing raw logs and debugging parsed errors.
 */
export interface IAgentClient {
  /**
   * Send a raw error block to the Parser Agent.
   * Returns structured ParsedError.
   */
  parse(rawBlock: string, contextLines: string[]): Promise<ParsedError>;

  /**
   * Send a parsed error to the Debugger Agent.
   * Returns Diagnosis with root cause and fix.
   */
  debug(parsedError: ParsedError): Promise<Diagnosis>;
}
