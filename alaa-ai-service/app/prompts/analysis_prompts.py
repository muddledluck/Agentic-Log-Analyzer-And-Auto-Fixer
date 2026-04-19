"""User prompts for parse / debug (plain LLM, no CrewAI)."""

import json


PARSE_SYSTEM = (
    "You are an expert SRE parsing error logs. "
    "Reply with a single JSON object only — no markdown fences, no commentary."
)


def build_parse_user_message(raw_block: str, context_lines: list[str]) -> str:
    ctx = "\n".join(context_lines)
    return f"""Analyze the following error log entry and extract structured information.

**Raw Error Line:**
```
{raw_block}
```

**Context (preceding lines):**
```
{ctx}
```

Extract and return a JSON object with exactly these fields:
- errorType (string): The error class name (e.g., "ECONNREFUSED", "TimeoutError", "NullPointerException")
- errorMessage (string): The human-readable error message
- stackFrames (array): Array of objects with: file, line (number), functionName, code (optional)
- contextLines (array of strings): The cleaned, relevant context lines
- severity (string): One of "critical", "high", "medium", "low"

Severity guide:
- critical: OutOfMemory, process crash, data corruption
- high: Connection refused, timeouts, null pointer
- medium: Syntax errors, validation failures
- low: Deprecation warnings treated as errors"""


DEBUG_SYSTEM = (
    "You are a staff engineer debugging production errors. "
    "Reply with a single JSON object only — no markdown fences, no commentary."
)


def build_debug_user_message(parsed_error: dict) -> str:
    return f"""Analyze this parsed error and provide a root cause analysis with a code fix.

**Parsed Error:**
```json
{json.dumps(parsed_error, indent=2)}
```

Return a JSON object with exactly these fields:
- rootCause (string): Brief one-line root cause
- explanation (string): Detailed explanation of why this error occurs (2-4 sentences)
- suggestedFix (object):
  - language (string): Programming language of the fix
  - filePath (string or null): File that needs the fix if identifiable
  - original (string or null): The problematic code pattern
  - fixed (string): The corrected code
  - description (string): What the fix does
- severity (string): One of "critical", "high", "medium", "low"
- confidence (number): Your confidence in this diagnosis (0-100)
- additionalNotes (array of strings): Any extra recommendations

Be specific and practical. The developer should be able to copy-paste your fix."""
