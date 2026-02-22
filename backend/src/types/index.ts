// ─── Error Block (from Log Tailer) ─────────────────────────────

export interface ErrorBlock {
  /** The raw error line from the log */
  raw: string;
  /** Surrounding context lines (up to 10 preceding lines) */
  contextLines: string[];
  /** ISO 8601 timestamp extracted from the log line */
  timestamp: string;
  /** Source file path being watched */
  source: string;
  /** Unique ID for correlation across pipeline stages */
  id: string;
}

// ─── Parsed Error (from Parser Agent) ──────────────────────────

export interface ParsedError {
  /** Type of error (e.g., "ECONNREFUSED", "TimeoutError") */
  errorType: string;
  /** Human-readable error message */
  errorMessage: string;
  /** Parsed stack frames, if available */
  stackFrames: StackFrame[];
  /** Cleaned context lines */
  contextLines: string[];
  /** Severity: "critical" | "high" | "medium" | "low" */
  severity: ErrorSeverity;
}

export interface StackFrame {
  /** File path referenced in the stack trace */
  file: string;
  /** Line number */
  line: number;
  /** Function or method name */
  functionName: string;
  /** Code snippet at that line, if available */
  code?: string;
}

export type ErrorSeverity = "critical" | "high" | "medium" | "low";

// ─── Diagnosis (from Debugger Agent) ───────────────────────────

export interface Diagnosis {
  /** Root cause explanation */
  rootCause: string;
  /** Detailed analysis of why the error occurred */
  explanation: string;
  /** Proposed code fix */
  suggestedFix: CodeFix;
  /** Severity assessment */
  severity: ErrorSeverity;
  /** Confidence score (0-100) */
  confidence: number;
  /** Additional notes or recommendations */
  additionalNotes: string[];
}

export interface CodeFix {
  /** Programming language of the fix */
  language: string;
  /** File path that needs the fix (if identifiable) */
  filePath?: string;
  /** Original problematic code */
  original?: string;
  /** Fixed code */
  fixed: string;
  /** Description of what the fix does */
  description: string;
}

// ─── Analysis Result (complete pipeline output) ────────────────

export interface AnalysisResult {
  /** Original error block */
  errorBlock: ErrorBlock;
  /** Parsed error from Parser Agent */
  parsedError: ParsedError;
  /** Diagnosis from Debugger Agent */
  diagnosis: Diagnosis;
  /** Path to generated report file */
  reportPath: string;
  /** When the analysis was completed */
  processedAt: Date;
}

// ─── Event Payloads ────────────────────────────────────────────

export interface ReportMeta {
  /** Path to the generated report */
  filePath: string;
  /** Error ID for correlation */
  errorId: string;
  /** Timestamp of report generation */
  generatedAt: Date;
}

export interface ProcessingError {
  /** Error ID for correlation */
  errorId: string;
  /** Which pipeline stage failed */
  stage: "parse" | "debug" | "report";
  /** Error message */
  message: string;
  /** Original error object */
  error: Error;
}

// ─── Config ────────────────────────────────────────────────────

export interface AppConfig {
  logFilePath: string;
  reportDir: string;
  dedupTtlMs: number;
  crewaiMode: "subprocess" | "http";
  crewaiHost: string;
  ollamaModel: string;
  ollamaBaseUrl: string;
  logLevel: string;
}

// ─── Event Map (for typed EventEmitter) ────────────────────────

export interface EventMap {
  "error-detected": ErrorBlock;
  "analysis-complete": AnalysisResult;
  "report-generated": ReportMeta;
  "processing-error": ProcessingError;
}
