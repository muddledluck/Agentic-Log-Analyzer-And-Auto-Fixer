const fs = require("fs");
const path = require("path");

/** Minimal .env loader (no extra packages). */
function loadEnvFile() {
  const envPath = path.join(__dirname, ".env");
  if (!fs.existsSync(envPath)) return;
  const text = fs.readFileSync(envPath, "utf8");
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
}

loadEnvFile();

async function simulateCrash() {
  const ingestUrl = process.env.ALAA_INGEST_URL;
  const apiKey = process.env.ALAA_API_KEY;

  if (!ingestUrl || !apiKey) {
    console.error(
      "Set ALAA_INGEST_URL and ALAA_API_KEY in example-app/.env (see .env.example)."
    );
    process.exit(1);
  }

  console.log("Simulating a critical TypeError...");
  const fakeStackTrace = `TypeError: Cannot read properties of undefined (reading 'id')
    at UserService.getUserById (/app/src/services/UserService.js:${Math.floor(Math.random() * 1000)}:25)
    at runMicrotasks (<anonymous>)
    at processTicksAndRejections (node:internal/process/task_queues:96:5)
    at async UserController.getUser (/app/src/controllers/UserController.js:15:20)`;

  const contextLines = [
    "39:     } catch (err) {",
    "40:       logger.error('Failed to parse user query');",
    "41:     }",
    "42:     const userId = payload.user.id;",
    "43:     if (!userId) throw new Error('No user attached');",
  ];

  const payload = {
    source: "pm2://example-app",
    rawBlock: fakeStackTrace,
    timestamp: new Date().toISOString(),
    contextLines,
  };

  try {
    console.log("Sending log to ALAA Ingestion Gateway...");
    const req = await fetch(ingestUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify(payload),
    });

    if (req.status === 202) {
      console.log("✅ Log successfully ingested! (202 Accepted)");
    } else {
      console.log(`❌ Failed to ingest. Status: ${req.status}`);
      console.log(await req.text());
    }
  } catch (err) {
    console.error("Network error:", err.message);
  }
}

simulateCrash();
