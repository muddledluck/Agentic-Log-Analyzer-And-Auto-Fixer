import json

def extract_result(result) -> dict:
    """Extract dict from CrewAI result, handling both raw JSON and Pydantic models."""
    if hasattr(result, "json_dict") and result.json_dict:
        return result.json_dict
    if hasattr(result, "pydantic") and result.pydantic:
        return result.pydantic.model_dump()
    if hasattr(result, "raw") and result.raw:
        return json.loads(result.raw)
    raise ValueError("Could not extract result from CrewAI output")
