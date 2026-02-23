# ALAA — Agentic Log Analyzer & Auto-Fixer

ALAA is a backend service powered by AI agents (using [CrewAI](https://www.crewai.com/) and [Ollama](https://ollama.com/)) that automatically monitors application logs in real-time, detects errors, analyzes the root cause, and generates detailed Markdown diagnostic reports with suggested code fixes.

## 🌟 Features

- **Real-time Tail Logging:** Uses efficient Node.js filesystem watchers to stream log files without reading the entire file memory.
- **Deduplication Engine:** Prevents duplicate AI analysis using SHA-256 error signature hashing and a configurable Time-To-Live (TTL) cache.
- **AI Dual-Agent Architecture:**
  - **Parser Agent:** Cleans raw log text and extracts structured data (error type, stack frames, context).
  - **Debugger Agent:** Analyzes the structured error, infers root causes across the stack, and generates copy-pasteable code fixes.
- **Local Privacy-First AI:** Built to run entirely locally using `llama3` via Ollama for zero-cost, privacy-respecting LLM inference.
- **Rich Markdown Reports:** Outputs detailed post-mortem documents for developers directly into a `/reports` folder.

## 🏗️ Architecture Stack

- **Orchestrator (Backend):** Node.js, TypeScript, EventBus, Redis, BullMQ.
- **AI Microservice:** Python 3, FastAPI, CrewAI, LiteLLM.
- **LLM Provider:** Ollama (`llama3` default) or any LiteLLM-compatible API (e.g. OpenAI).

Our backend is completely decoupled: the Python AI service runs as a standalone FastAPI microservice (`alaa-ai-service`) and is **never** imported into the Node.js backend. Instead, the Node.js Core Engine manages the file tailing and deduplication, and schedules API workloads into a resilient BullMQ queue cluster which issues HTTP requests to the Python compute layer.

## 📋 Prerequisites

Before you begin, ensure you have the following installed:
1. **Node.js**: v18 or v22 (with `npm`)
2. **Python**: v3.10+ (with `pip`)
3. **Ollama**: [Download here](https://ollama.com/download)

Start Ollama and pull the default MVP model:
```bash
ollama serve
ollama pull llama3
```

## 📚 Architecture Documentation Index

For a deep dive into the system's design, consult the sequentially numbered documentation inside the `docs/` folder:

1. **[01_product_requirements.md](./docs/01_product_requirements.md)** - Core feature specifications
2. **[02_general_architecture.md](./docs/02_general_architecture.md)** - High-level component diagrams
3. **[03_mvp_plan.md](./docs/03_mvp_plan.md)** - Execution schedule for the initial build
4. **[04_high_level_design.md](./docs/04_high_level_design.md)** - Detailed API boundaries and DB schemas
5. **[05_low_level_design.md](./docs/05_low_level_design.md)** - Class-level specifications for Phase 1
6. **[06_backend_v2_extensions.md](./docs/06_backend_v2_extensions.md)** - Extensibility planning post-MVP
7. **[07_multi_agent_spec.md](./docs/07_multi_agent_spec.md)** - Specifications for Python microservice extraction
8. **[08_multi_agent_lld.md](./docs/08_multi_agent_lld.md)** - Low-level design for Python refactor
9. **[09_llm_routing_strategy.md](./docs/09_llm_routing_strategy.md)** - Architectural rationale for multi-model fallback

## 🚀 Setup & Installation

### 1. Unified Boot (Recommended)
ALAA ships with a `docker-compose.yml` to effortlessly boot the Redis queue and the Python Microservice side-by-side:
```bash
docker-compose up -d
```
*Note: This automatically builds and starts the `alaa-ai-service` strictly isolated from the Node.js layer.*

### 2. Node.js Core Backend Setup
Install the TypeScript backend dependencies:
```bash
cd backend
npm install
```

Make sure your environment variables are configured. (Copy the `.env.example` file securely).

## 🖥️ Usage

1. Start the ALAA Orchestrator:
   ```bash
   cd backend
   npm run dev
   ```
   *The Node.js Orchestrator will seamlessly connect to the Redis instance and the standalone Python `alaa-ai-service`.*
   You should see terminal output indicating ALAA is watching for errors.

2. In a separate terminal, inject an error into your target log file (e.g., `system.log`):
   ```bash
   echo '[2026-02-22T12:00:00Z] ERROR: SequelizeConnectionRefusedError: connect ECONNREFUSED 127.0.0.1:3306' >> system.log
   ```

3. Look at the Orchestrator logs. ALAA will immediately capture the error, pass it to the Python AI service, and generate a comprehensive diagnostic report inside the `backend/reports/` folder.

## 📁 Project Structure

```text
alaa/
├── alaa-ai-service/                 # 100% Isolated Python Compute Layer
│   ├── Dockerfile
│   ├── requirements.txt
│   └── app/                         # Modular FastAPI Application
│       ├── main.py                  # FastAPI Application Entry
│       ├── api/                     # API Routers & Endpoints
│       ├── core/                    # Config & LLM Routing Logic
│       ├── models/                  # Pydantic Schemas
│       ├── services/                # CrewAI Orchestration
│       └── agents/                  # Prompts & Task Definitions
├── backend/                         # Node.js Core Engine
│   ├── src/
│   │   ├── index.ts                 # Application entry point
│   │   ├── config/                  # Environment validation
│   │   ├── tailer/                  # fs.watch Log tailing & Adapters
│   │   ├── orchestrator/            # Pipeline manager
│   │   ├── queue/                   # BullMQ workers for AI dispatch
│   │   ├── reporter/                # Markdown builder
│   │   └── agents/                  # HttpAgentClient for REST invocations
├── docs/                            # Internal Architecture specs (HLD/LLD)
├── docker-compose.yml               # Orchestrates Redis + ai-service
└── system.log                       # Local application log (mock target)
```

## 🧪 Testing

The backend includes a full test suite built with `vitest`.
```bash
cd backend
npm run test
```
To run the end-to-end MVP smoke test script:
```bash
cd temp/mvp-test
./run_e2e.sh
```

---
*Generated as part of the Phase 1 Architecture MVP.*
