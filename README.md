# ALAA — Agentic Log Analyzer & Auto-Fixer (SaaS Platform)

ALAA is a **multi-tenant SaaS platform** that ingests error logs, analyzes root cause with **LiteLLM** (e.g. **Ollama** locally), and produces Markdown debugging reports.

## Features

- **Multi-tenant API:** Organizations, projects, and hashed API keys for log ingestion.
- **Webhook ingestion:** `POST /api/webhooks/ingest` with Redis deduplication and BullMQ buffering.
- **AI pipeline:** Parser + debugger agents in a stateless Python service (`alaa-ai-service`).
- **Legacy local runner (optional):** The `backend/` package can tail files, PM2, Docker, or a local webhook and write reports to disk — useful for development without the full SaaS stack.

## Prerequisites

- **Node.js** v18+ (v22 supported)
- **Python** 3.10+
- **Docker** (recommended for Postgres, Redis, and the AI service)
- **Ollama** (default local LLM): [ollama.com/download](https://ollama.com/download)

```bash
ollama serve
ollama pull llama3
```

## Architecture documentation

Numbered specs live under [`docs/`](./docs/); SaaS blueprint: [`docs/saas/hld.md`](./docs/saas/hld.md).

## Quick start — SaaS backend (primary path)

1. **Infrastructure** (Postgres + Redis + AI service):

   ```bash
   docker compose up -d
   ```

2. **Configure the API** — copy env and set secrets:

   ```bash
   cd saas/backend
   cp .env.example .env
   # Edit .env: DATABASE_URL, JWT_SECRET (≥32 chars), REDIS_URL, AI_SERVICE_URL
   ```

3. **Database schema:**

   ```bash
   cd saas/backend
   npm install
   npx prisma generate
   npx prisma db push
   ```

4. **Run API + worker** (worker is imported from `server.ts`):

   ```bash
   npm run dev
   ```

   Default API: `http://localhost:5050` (see `PORT` in `.env`; **avoid 5000 on macOS** — it is often AirPlay). Health: `GET /health`. API docs: `GET /api-docs`.

5. **Optional — smoke test webhook** — after you have a real API key:

   ```bash
   cd example-app
   cp .env.example .env
   # Set ALAA_API_KEY and ALAA_INGEST_URL (default port 5050 unless you changed PORT)
   npm run send
   ```

6. **Check that a report landed in Postgres:**

   ```bash
   cd saas/backend
   npm run verify:reports
   ```

## Quick start — legacy local orchestrator (optional)

For file / PM2 / Docker tailing and reports under `backend/reports/`:

```bash
cd backend
npm install
# Copy backend/.env.example to .env and ensure LOG_FILE_PATH exists, Redis + AI service up
npm run dev
```

Run tests:

```bash
cd backend
npm test
```

## Project layout

```text
alaa/
├── saas/backend/          # Express + Prisma + BullMQ (SaaS API)
├── alaa-ai-service/       # FastAPI + LiteLLM (POST /api/analyze)
├── backend/               # Legacy V1 log orchestrator (optional)
├── example-app/           # Tiny webhook client for local testing
├── docs/                  # Architecture specs
└── docker-compose.yml     # Postgres, Redis, alaa-ai-service
```

The **Next.js dashboard** described in older docs is **not in this repository yet**; API-only for now.

## Testing

| Package        | Command              |
|----------------|----------------------|
| Legacy `backend/` | `cd backend && npm test` (Vitest) |
| SaaS `saas/backend/` | `npm test` is a placeholder; add tests as the API stabilizes. |

---

*Architecture MVP and SaaS evolution.*
