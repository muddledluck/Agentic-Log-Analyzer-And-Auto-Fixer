from crewai import Crew, Process
from app.core.llm_factory import apply_api_keys, create_llm_chain
from app.agents.debugger import create_debugger_agent, create_debug_task
from app.services.utils import extract_result

def handle_debug(payload: dict, config: dict) -> dict:
    apply_api_keys(config.get("apiKeys", {}))
    
    llm = create_llm_chain(
        primary_model=config["debuggerModel"],
        base_url=config.get("baseUrl"),
        fallback_model=config.get("fallbackModel")
    )
    
    agent = create_debugger_agent(llm)
    task = create_debug_task(agent, payload["parsedError"])
    
    crew = Crew(
        agents=[agent],
        tasks=[task],
        process=Process.sequential,
        verbose=False,
    )
    
    try:
        result = crew.kickoff()
        return extract_result(result)
    except Exception as e:
        fallback_model = config.get("fallbackModel")
        if not fallback_model:
            raise e
            
        print(f"Primary model {config['debuggerModel']} failed with {str(e)}, falling back to {fallback_model}...")
        fallback_llm = create_llm_chain(
            primary_model=fallback_model,
            base_url=config.get("baseUrl")
        )
        
        fallback_agent = create_debugger_agent(fallback_llm)
        fallback_task = create_debug_task(fallback_agent, payload["parsedError"])
        
        fallback_crew = Crew(
            agents=[fallback_agent],
            tasks=[fallback_task],
            process=Process.sequential,
            verbose=False,
        )
        
        result = fallback_crew.kickoff()
        return extract_result(result)
