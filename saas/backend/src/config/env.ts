import { z } from 'zod';

const envSchema = z.object({
  PORT: z.string().default("5050"),
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  REDIS_URL: z.string().url().default("redis://localhost:6379"),
  /** Full URL to FastAPI analyze endpoint (includes /api prefix). */
  AI_SERVICE_URL: z
    .string()
    .url()
    .default("http://localhost:8000/api/analyze"),
  /**
   * Ollama HTTP API base, passed to the AI container so LiteLLM can reach the host.
   * Use http://host.docker.internal:11434 when alaa-ai-service runs in Docker (default).
   * If you run the Python service on the same machine without Docker, use http://localhost:11434.
   */
  LLM_BASE_URL: z
    .string()
    .url()
    .default("http://host.docker.internal:11434"),
  PARSER_LLM_MODEL: z.string().default("ollama/llama3"),
  DEBUGGER_LLM_MODEL: z.string().default("ollama/llama3"),
  FALLBACK_LLM_MODEL: z.string().optional(),
});

const _env = envSchema.safeParse(process.env);

if (!_env.success) {
  console.error('❌ Invalid environment variables', _env.error.format());
  process.exit(1);
}

export const env = _env.data;
