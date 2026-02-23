# Phase 10: Multi-Agent Model Assignments & Fallbacks

## Overview
ALAA Phase 10 upgrades the decoupled Python AI Microservice (`alaa-ai-service`) to support **heterogeneous LLM assignments** and **reliable fallback chains**.

The Python service runs completely independent from the Node.js backend. It exposes HTTP endpoints (FastAPI) and handles the raw intelligence layer using CrewAI and LiteLLM.

## Objectives
1. **Per-Agent Model Assignment**:
   - The **Parser Agent** requires fast inference for structured log extraction. By default, it will use a faster/cheaper model (e.g., `ollama/llama3`).
   - The **Debugger Agent** requires deep reasoning and coding capabilities. It should ideally be routed to a more capable model (e.g., `ollama/codellama` or an external API like `openai/gpt-4o`).

2. **Multi-Provider Support via `.env`**:
   - The user must be able to seamlessly switch between leading models (ChatGPT, Anthropic, Google Gemini, or self-hosted Ollama).
   - We will achieve this natively using LiteLLM provider prefixes defined purely in the `.env` file (e.g., `openai/gpt-4o`, `anthropic/claude-3-5-sonnet-20240620`, `gemini/gemini-1.5-pro`).
   - The system must capture and securely pass specific API keys to the Python service.

3. **Fallback Chains**:
   - In production scenarios, primary LLMs might go down or hit rate limits.
   - LiteLLM natively supports fallbacks. If the primary model fails, the router should automatically switch to a defined secondary model.

## Implementation Steps

### 1. Node.js Configuration Updates (`.env`)
Update the existing Node.js Orchestrator to support multiple LLM environment variables and their respective API keys:
- **Model Routing Variables**:
  - `PARSER_LLM_MODEL`: (e.g. `ollama/llama3` or `openai/gpt-3.5-turbo`)
  - `DEBUGGER_LLM_MODEL`: (e.g. `openai/gpt-4o` or `anthropic/claude-3-5-sonnet`)
  - `FALLBACK_LLM_MODEL`: (e.g. `gemini/gemini-1.5-pro` or `ollama/llama3`)
- **API Keys**:
  - `OPENAI_API_KEY`
  - `ANTHROPIC_API_KEY`
  - `GEMINI_API_KEY`

These config values must be loaded and validated in `backend/src/config/index.ts`. All of these keys and model strings must then be packed into the `config` payload object during the `HttpAgentClient` network request to the Python microservice.

### 2. Python Microservice Upgrades
The `alaa-ai-service` is strictly decoupled. Modifying how models are invoked requires changes to `api.py` and `main.py`:

- **Refactor `create_llm`**: Instead of blindly accepting a single `model` string, update the signature to instantiate different LiteLLM fallback configurations based on whether the Agent is a parser or a debugger.
- Utilize the `litellm.Router` or CrewAI's native LiteLLM integrations to inject the fallback models.

### 3. Verification
- Shut off your local Ollama instance or provide a broken API key for the primary model.
- Verify that ALAA successfully falls back to the secondary model and still generates the diagnostic markdown report.
