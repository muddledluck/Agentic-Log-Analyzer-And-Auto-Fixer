# ALAA Phase 10 — Low-Level Design (LLD)

## 1. Overview
This document specifies the concrete implementation details for **Phase 10: Multi-Agent Model Assignments & Fallbacks**.
The objective is to allow the decoupled Python `alaa-ai-service` to run separate LLM models per agent (Parser vs. Debugger) and cleanly fallback to secondary models upon inference failure, driven entirely by Node.js `.env` variables.

## 2. Node.js Layer

### 2.1 `backend/src/config/index.ts`
Add the following properties to the `AppConfig` interface and parsing logic:
```typescript
export interface AppConfig {
  // ... existing config
  parserLlmModel: string;
  debuggerLlmModel: string;
  fallbackLlmModel?: string; // Optional
  apiKeys: {
    openai?: string;
    anthropic?: string;
    gemini?: string;
  }
}
```

Update the configuration parser to extract keys securely:
```typescript
  parserLlmModel: process.env.PARSER_LLM_MODEL ?? "ollama/llama3",
  debuggerLlmModel: process.env.DEBUGGER_LLM_MODEL ?? "ollama/llama3",
  fallbackLlmModel: process.env.FALLBACK_LLM_MODEL,
  apiKeys: {
    openai: process.env.OPENAI_API_KEY,
    anthropic: process.env.ANTHROPIC_API_KEY,
    gemini: process.env.GEMINI_API_KEY,
  }
```

### 2.2 `backend/src/agents/HttpAgentClient.ts`
Update the `config` payload object sent during the `POST /api/parse` and `POST /api/debug` requests to structurally match the required Python Pydantic models. Ensure the `baseUrl` configuration (for local Ollama) is also passed correctly.

## 3. Python Microservice Layer (`alaa-ai-service/app/`)

To guarantee long-term scalability and maintainability, the flat Python directory must be refactored into a modular enterprise-grade FastAPI structure before implementing the Phase 10 logic.

### 3.1 Target Directory Structure
Move the flat files into a proper `app/` package:
```text
alaa-ai-service/
├── requirements.txt
├── Dockerfile
└── app/
    ├── __init__.py
    ├── main.py                 # FastAPI app initialization & server boot
    ├── api/
    │   ├── __init__.py
    │   └── routes.py           # POST /api/parse and POST /api/debug endpoints
    ├── core/
    │   ├── __init__.py
    │   └── llm_factory.py      # LiteLLM routing, fallback chains, API key injection
    ├── models/
    │   ├── __init__.py
    │   └── schemas.py          # Pydantic request/response models
    ├── services/
    │   ├── __init__.py
    │   ├── parser_service.py   # CrewAI Parser orchestration
    │   └── debugger_service.py # CrewAI Debugger orchestration
    └── agents/
        ├── __init__.py
        ├── prompts.py          # Extracted prompt templates
        ├── parser.py           # Parser Agent & Task definitions
        └── debugger.py         # Debugger Agent & Task definitions
```

### 3.2 `app/models/schemas.py` (Pydantic Schemas)
Move all Pydantic models here. Update `ConfigModel` to accept the new multi-model and API key structure:
```python
from pydantic import BaseModel
from typing import Optional

class ApiKeysModel(BaseModel):
    openai: Optional[str] = None
    anthropic: Optional[str] = None
    gemini: Optional[str] = None

class ConfigModel(BaseModel):
    parserModel: str
    debuggerModel: str
    fallbackModel: Optional[str] = None
    baseUrl: Optional[str] = None
    apiKeys: ApiKeysModel
```

### 3.3 `app/core/llm_factory.py` (LiteLLM Routing)
Extract the `create_llm` logic into a dedicated factory.

```python
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

def create_llm_chain(primary_model: str, base_url: str | None, fallback_model: str | None) -> LLM:
    """Creates an LLM instance, optionally configuring a fallback chain."""
    
    kwargs = {"model": primary_model, "temperature": 0.1, "max_tokens": 2000}
    if primary_model.startswith("ollama/") and base_url:
         kwargs["base_url"] = base_url
         
    if fallback_model:
        kwargs["fallbacks"] = [fallback_model]

    return LLM(**kwargs)
```

### 3.4 `app/services/parser_service.py` (Agent Orchestration)
Update the handlers to accept their respective designated `LLM` instances rather than a generic shared one.

```python
from app.core.llm_factory import apply_api_keys, create_llm_chain
from app.agents.parser import create_parser_agent

def handle_parse(payload: dict, config: dict) -> dict:
    apply_api_keys(config.get("apiKeys", {}))
    
    llm = create_llm_chain(
        primary_model=config["parserModel"],
        base_url=config.get("baseUrl"),
        fallback_model=config.get("fallbackModel")
    )
    
    agent = create_parser_agent(llm)
    # ... executes Crew
```

### 3.5 `app/api/routes.py`
The FastAPI routes simply import and invoke the services using the structured schemas.

## 4. Dependencies
No new dependencies are strictly required since `crewai` natively wraps `litellm`. Ensure the developer checks the imports for `from crewai import LLM`.
