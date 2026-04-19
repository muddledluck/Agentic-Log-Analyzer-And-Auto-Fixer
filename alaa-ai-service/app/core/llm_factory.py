import os


def apply_api_keys(api_keys: dict):
    """Sets os.environ keys so LiteLLM can pick them up dynamically."""
    if api_keys.get("openai"):
        os.environ["OPENAI_API_KEY"] = api_keys["openai"]
    if api_keys.get("anthropic"):
        os.environ["ANTHROPIC_API_KEY"] = api_keys["anthropic"]
    if api_keys.get("gemini"):
        os.environ["GEMINI_API_KEY"] = api_keys["gemini"]
