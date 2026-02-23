import json
from crewai import Agent, Task
from app.models.schemas import DiagnosisModel

def create_debugger_agent(llm) -> Agent:
    """Create the Debugger Agent — analyzes errors and proposes fixes."""
    return Agent(
        role="Root Cause Analyst & Code Fixer",
        goal=(
            "Analyze the parsed error, identify the root cause, and "
            "propose a specific, actionable code fix."
        ),
        backstory=(
            "You are a staff engineer with deep debugging expertise across "
            "the full stack. You have resolved thousands of production "
            "incidents and can trace any error to its root cause. You "
            "always provide practical, copy-paste-ready code fixes."
        ),
        llm=llm,
        verbose=False,
        allow_delegation=False,
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
