import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import db from "../config/db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Creates all tables if they do not exist yet.
 * Runs automatically on server start, so a fresh database needs no manual SQL step.
 */
export async function initSchema() {
  const schema = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8");
  await db.exec(schema);
  console.log("[db] Schema ready");
}
