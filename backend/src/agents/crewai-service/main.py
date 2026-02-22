#!/usr/bin/env python3
"""
ALAA CrewAI Service — Subprocess mode.
Reads JSON from stdin, processes via CrewAI agents, writes JSON to stdout.
"""

import sys
import json
from agents import create_parser_agent, create_debugger_agent
from tasks import create_parse_task, create_debug_task
from crewai import Crew, LLM, Process


def create_llm(config: dict) -> LLM:
    """Create an Ollama-backed LLM instance."""
    return LLM(
        model=f"ollama/{config['model']}",
        base_url=config["baseUrl"],
        temperature=0.1,
        max_tokens=2000,
    )


def extract_result(result) -> dict:
    """Extract dict from CrewAI result, handling both raw JSON and Pydantic models."""
    # Try json_dict first (CrewAI v1.x with Pydantic output)
    if hasattr(result, "json_dict") and result.json_dict:
        return result.json_dict

    # Try pydantic model
    if hasattr(result, "pydantic") and result.pydantic:
        return result.pydantic.model_dump()

    # Fall back to raw JSON string
    if hasattr(result, "raw") and result.raw:
        return json.loads(result.raw)

    raise ValueError("Could not extract result from CrewAI output")


def handle_parse(payload: dict, llm: LLM) -> dict:
    """Run the Parser Agent on raw error data."""
    agent = create_parser_agent(llm)
    task = create_parse_task(agent, payload["rawBlock"], payload["contextLines"])

    crew = Crew(
        agents=[agent],
        tasks=[task],
        process=Process.sequential,
        verbose=False,
    )

    result = crew.kickoff()
    return extract_result(result)


def handle_debug(payload: dict, llm: LLM) -> dict:
    """Run the Debugger Agent on a parsed error."""
    agent = create_debugger_agent(llm)
    task = create_debug_task(agent, payload["parsedError"])

    crew = Crew(
        agents=[agent],
        tasks=[task],
        process=Process.sequential,
        verbose=False,
    )

    result = crew.kickoff()
    return extract_result(result)


def main():
    try:
        # Read JSON from stdin
        raw_input = sys.stdin.read()
        request = json.loads(raw_input)

        action = request["action"]
        payload = request["payload"]
        config = request["config"]

        llm = create_llm(config)

        # Route to handler
        if action == "parse":
            data = handle_parse(payload, llm)
        elif action == "debug":
            data = handle_debug(payload, llm)
        else:
            raise ValueError(f"Unknown action: {action}")

        # Write success response to stdout
        response = {"success": True, "data": data}
        print(json.dumps(response))

    except Exception as e:
        # Write error response to stdout
        response = {"success": False, "error": str(e)}
        print(json.dumps(response))
        sys.exit(1)


if __name__ == "__main__":
    main()
