"""CrewAI Agent definitions for ALAA."""

from crewai import Agent, LLM


def create_parser_agent(llm: LLM) -> Agent:
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


def create_debugger_agent(llm: LLM) -> Agent:
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
