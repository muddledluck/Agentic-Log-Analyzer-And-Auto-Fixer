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

- **Orchestrator (Backend):** Node.js, TypeScript, EventBus architecture.
- **AI Service:** Python 3, CrewAI, LiteLLM.
- **LLM Provider:** Ollama (`llama3`).

Our backend is built using Interface Dependency Injection (SOLID principles), paving the way for future cloud log adapters (AWS CloudWatch, PM2) and external AI providers (OpenAI, Anthropic).

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

## 🚀 Setup & Installation

### 1. Python Environment Setup
Install the required Python dependencies for the CrewAI subprocess:
```bash
cd backend/src/agents/crewai-service
pip3 install -r requirements.txt
```

### 2. Node.js Environment Setup
Install the TypeScript backend dependencies:
```bash
cd backend
npm install
```

Make sure your environment variables are configured. (By default, the `.env` file assumes an output log file named `system.log` in the root directory).

## 🖥️ Usage

1. Start the ALAA Orchestrator in development mode:
   ```bash
   cd backend
   npm run dev
   ```
   You should see terminal output indicating ALAA is watching for errors.

2. In a separate terminal, inject an error into your target log file (e.g., `system.log`):
   ```bash
   echo '[2026-02-22T12:00:00Z] ERROR: SequelizeConnectionRefusedError: connect ECONNREFUSED 127.0.0.1:3306' >> system.log
   ```

3. Look at the Orchestrator logs. ALAA will immediately capture the error, pass it to the Python AI service, and generate a comprehensive diagnostic report inside the `backend/reports/` folder.

## 📁 Project Structure

```text
alaa/
├── backend/
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts                 # Application entry point
│       ├── config/                  # Environment validation
│       ├── events/                  # Singleton EventBus
│       ├── orchestrator/            # Pipeline manager
│       ├── reporter/                # Markdown builder
│       ├── services/                # IDedupService
│       ├── tailer/                  # fs.watch Log tailing
│       └── agents/
│           ├── IAgentClient.ts      # Agent Interface definition
│           ├── SubprocessAgentClient.ts # IPC Executor
│           └── crewai-service/      # Python Multi-Agent Logic
│               ├── main.py          # JSON stdin/stdout router
│               ├── agents.py        # Parser & Debugger prompts
│               └── tasks.py         # CrewAI logic & Pydantic output schemas
├── docs/                            # Internal Architecture specs (HLD/LLD)
├── system.log                       # Local application log (mock target)
└── temp/mvp-test/                   # Automated end-to-end testing scripts
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
