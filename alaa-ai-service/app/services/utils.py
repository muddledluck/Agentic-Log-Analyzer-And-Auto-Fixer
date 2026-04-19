import json
import re
from typing import Any


def _strip_markdown_json_fence(text: str) -> str:
    text = text.strip()
    m = re.search(r"```(?:json)?\s*([\s\S]*?)```", text)
    if m:
        return m.group(1).strip()
    return text


def parse_json_object_from_text(text: str) -> dict[str, Any]:
    """Extract the first complete JSON object from LLM output."""
    text = _strip_markdown_json_fence(text)
    start = text.find("{")
    if start == -1:
        raise ValueError("No JSON object found in model output")
    decoder = json.JSONDecoder()
    obj, _ = decoder.raw_decode(text[start:])
    if not isinstance(obj, dict):
        raise ValueError("Parsed JSON is not an object")
    return obj
