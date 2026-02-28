# Backend Agent Handoff Prompt: Phase 12 (SaaS Backend Foundation)

**Target Agent:** `@[/backend]`
**Context:** The architecture phase for the ALAA Multi-Tenant SaaS Platform is complete. We are now transitioning to implementation. Please read the High-Level Design (`docs/saas/hld.md`) thoroughly before beginning.

## 🎯 Primary Objective
Your goal is to scaffold the new Node.js SaaS Backend and implement the absolute core foundation (Milestone 1). This is a completely new project located inside the `saas/backend` folder, separate from the legacy `backend/` folder.

**Tech Stack:** 
- Node.js (TypeScript)
- Framework: Express.js (or NestJS/Fastify, but keep it robust for rapid REST APIs)
- Data Modeling: Prisma ORM
- Database: PostgreSQL (Relational Data)
- Cache & Queue: Redis & BullMQ
- Auth: JWT (JSON Web Tokens)
- Hashing: Node `crypto` (SHA-256) or `bcrypt` (Passwords)

## 🏗️ Architectural Constraints (KISS Principle)
The new architecture **strictly enforces** that the Node.js backend handles **100%** of all database mutations and queue operations. The Python AI Service (which you do not need to build yet) will eventually operate as a completely isolated, stateless HTTP endpoint (`POST /analyze`). Your Node.js backend will be responsible for sending it data via synchronous HTTP POST requests. 

## 📝 Required Implementation Steps

Please execute the following steps sequentially. Document your progress in standard markdown.

### Step 1: Initialize Project & Setup Prisma
1. Create the `saas/backend` directory.
2. Initialize a new Node.js TypeScript project.
3. Install Prisma (`npx prisma init`) and configure it for PostgreSQL.
4. Implement the Prisma Schema exactly as defined in `docs/saas/hld.md`:
   - `User`, `Organization`, `Project`, `ApiKey`, `ErrorEvent`, `Report`.
   - Ensure the `ApiKey` model uses `keyHash` (string) and `partialKey` (string) instead of storing the raw key.

### Step 2: Implement Authentication & Tenant Management
1. **Auth Endpoints:** 
   - `POST /api/auth/register` (Creates User AND Organization).
   - `POST /api/auth/login` (Returns a stateless JWT).
2. **Project Management:**
   - `GET /api/projects` (List projects for the user's organization).
   - `POST /api/projects` (Create a new project).

### Step 3: API Key Generation (Strict Security)
1. **Endpoint:** `POST /api/projects/:id/api-keys`
2. **Logic:** 
   - Generate a secure random string (e.g., `crypto.randomBytes(32).toString('hex')`).
   - Hash the string using SHA-256.
   - Save the hash (`keyHash`) and a partial masked version (`partialKey`, e.g., `*******a1b2`) into PostgreSQL via Prisma.
   - Return the **raw, unhashed key** in the HTTP response exactly once. 
   - *Security Note: Inform the user this is the only time they will see the key.*

### Step 4: High-Throughput Ingestion Webhook (Burst Resilient)
1. **Endpoint:** `POST /api/webhooks/ingest`
2. **Logic:**
   - Extract `x-api-key` from headers.
   - Hash the incoming key (SHA-256) and query PostgreSQL for a match. Respond `401 Unauthorized` if invalid.
   - **Deduplication:** Hash the incoming error payload (`rawBlock`). Check Redis for key `dedup:{projectId}:{hash}`. If it exists, return `202 Accepted` immediately (drop duplicate). If not, set the Redis key with a short TTL (e.g., 5 mins).
   - **Queueing (Crucial):** Do NOT `INSERT` into PostgreSQL here. Push the incoming JSON payload into a BullMQ queue ("error-ingestion-queue").
   - Respond cleanly with `202 Accepted`.

### Step 5: Implement the Background Worker (BullMQ Consumer)
1. **Logic:** Build a dedicated worker file that listens to the "error-ingestion-queue".
2. **Processing Flow:**
   - Pop a job off the queue.
   - Execute an `INSERT` into PostgreSQL to create the `ErrorEvent` row.
   - For now, **mock** the HTTP POST to the AI Service (e.g., just `console.log("Mocking POST to AI Service: ", errorEvent.id)` and wait 2 seconds).
   - Upon (mock) completion, create a dummy `Report` row attached to the `ErrorEvent` in PostgreSQL.
3. **Resilience:** Configure the worker with exponential backoff retries for future AI rate limits.

---
**Agent Instruction:** Please confirm when you have read this prompt and are ready to begin Step 1. Focus strongly on clean, layered code structure (Controllers vs Services) from the beginning.
