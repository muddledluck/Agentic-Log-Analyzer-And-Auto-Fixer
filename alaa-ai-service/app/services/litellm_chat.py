"""Direct LiteLLM completion — avoids CrewAI's Instructor path (broken with Ollama)."""

from __future__ import annotations

import os
from typing import Any

import litellm


def chat_completion(
    model: str,
    base_url: str | None,
    messages: list[dict[str, str]],
    *,
    temperature: float = 0.1,
    max_tokens: int = 2000,
) -> str:
    if model.startswith("ollama/") and base_url:
        os.environ["OLLAMA_API_BASE"] = base_url

    kwargs: dict[str, Any] = {
        "model": model,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
    }
    if model.startswith("ollama/") and base_url:
        kwargs["api_base"] = base_url

    resp = litellm.completion(**kwargs)
    content = resp.choices[0].message.content
    return (content or "").strip()
