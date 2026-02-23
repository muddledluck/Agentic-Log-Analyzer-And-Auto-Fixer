import os
from crewai import LLM

def apply_api_keys(api_keys: dict):
    """Sets os.environ keys so LiteLLM can pick them up dynamically."""
    if api_keys.get("openai"):
        os.environ["OPENAI_API_KEY"] = api_keys["openai"]
    if api_keys.get("anthropic"):
        os.environ["ANTHROPIC_API_KEY"] = api_keys["anthropic"]
    if api_keys.get("gemini"):
        os.environ["GEMINI_API_KEY"] = api_keys["gemini"]

def create_llm_chain(primary_model: str, base_url: str | None, fallback_model: str | None = None) -> LLM:
    """Creates an LLM instance."""
    
    # Initialize the base CrewAI LLM wrapper
    # Note: If it's an Ollama model, we supply the custom base_url
    kwargs = {"model": primary_model, "temperature": 0.1, "max_tokens": 2000}
    if primary_model.startswith("ollama/") and base_url:
         kwargs["base_url"] = base_url

    return LLM(**kwargs)
