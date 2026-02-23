from crewai import Crew, Process
from app.core.llm_factory import apply_api_keys, create_llm_chain
from app.agents.parser import create_parser_agent, create_parse_task
from app.services.utils import extract_result

def handle_parse(payload: dict, config: dict) -> dict:
    apply_api_keys(config.get("apiKeys", {}))
    
    llm = create_llm_chain(
        primary_model=config["parserModel"],
        base_url=config.get("baseUrl"),
        fallback_model=config.get("fallbackModel")
    )
    
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
