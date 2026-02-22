"""CrewAI Task definitions for ALAA."""

import json
from pydantic import BaseModel, Field
from crewai import Agent, Task


# ─── Pydantic Output Models ────────────────────────────────────

class StackFrameModel(BaseModel):
    """A single stack frame from an error trace."""
    file: str = Field(description="File path referenced in the stack trace")
    line: int = Field(description="Line number")
    functionName: str = Field(description="Function or method name")
    code: str | None = Field(default=None, description="Code snippet at that line")


class ParsedErrorModel(BaseModel):
    """Structured output from the Parser Agent."""
    errorType: str = Field(description='Error class name, e.g. "ECONNREFUSED"')
    errorMessage: str = Field(description="Human-readable error message")
    stackFrames: list[StackFrameModel] = Field(default_factory=list, description="Parsed stack frames")
    contextLines: list[str] = Field(default_factory=list, description="Cleaned context lines")
    severity: str = Field(description='One of: "critical", "high", "medium", "low"')


class SuggestedFixModel(BaseModel):
    """A proposed code fix."""
    language: str = Field(description="Programming language of the fix")
    filePath: str | None = Field(default=None, description="File that needs the fix")
    original: str | None = Field(default=None, description="Original problematic code")
    fixed: str = Field(description="The corrected code")
    description: str = Field(description="What the fix does")


class DiagnosisModel(BaseModel):
    """Structured output from the Debugger Agent."""
    rootCause: str = Field(description="Brief one-line root cause")
    explanation: str = Field(description="Detailed explanation (2-4 sentences)")
    suggestedFix: SuggestedFixModel = Field(description="Proposed code fix")
    severity: str = Field(description='One of: "critical", "high", "medium", "low"')
    confidence: int = Field(description="Confidence score 0-100")
    additionalNotes: list[str] = Field(default_factory=list, description="Extra recommendations")


# ─── Task Definitions ──────────────────────────────────────────

def create_parse_task(agent: Agent, raw_block: str, context_lines: list[str]) -> Task:
    """Create the parse task — extracts structured error from raw log."""
    return Task(
        description=f"""Analyze the following error log entry and extract structured information.

**Raw Error Line:**
```
{raw_block}
```

**Context (preceding lines):**
```
{chr(10).join(context_lines)}
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
- low: Deprecation warnings treated as errors""",
        expected_output="A valid JSON object matching the ParsedError schema",
        agent=agent,
        output_json=ParsedErrorModel,
    )


def create_debug_task(agent: Agent, parsed_error: dict) -> Task:
    """Create the debug task — analyzes parsed error and proposes fix."""
    return Task(
        description=f"""Analyze this parsed error and provide a root cause analysis with a code fix.

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

Be specific and practical. The developer should be able to copy-paste your fix.""",
        expected_output="A valid JSON object matching the Diagnosis schema",
        agent=agent,
        output_json=DiagnosisModel,
    )
