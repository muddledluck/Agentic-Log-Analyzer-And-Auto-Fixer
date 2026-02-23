from crewai import Agent, Task
from app.models.schemas import ParsedErrorModel

def create_parser_agent(llm) -> Agent:
    """Create the Parser Agent — extracts structured error data from raw logs."""
    return Agent(
        role="Log Error Parser",
        goal=(
            "Clean raw log data, strip unnecessary noise, and extract "
            "the core error signature into a structured format."
        ),
        backstory=(
            "You are a senior SRE with 15 years of experience. You have "
            "parsed millions of stack traces across Java, Python, Node.js, "
            "and Go applications. You can instantly identify the critical "
            "error information from noisy log output."
        ),
        llm=llm,
        verbose=False,
        allow_delegation=False,
    )

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
