import path from "node:path";
import dotenv from "dotenv";

/** Must be imported before any module that reads `process.env` (see `server.ts` import order). */
dotenv.config({
  path: path.join(__dirname, "..", "..", ".env"),
  override: true,
});
