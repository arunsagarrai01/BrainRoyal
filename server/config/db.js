import pg from "pg";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

dotenv.config();

const { Pool } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Database strategy
 * -----------------
 * 1. If DB_DRIVER=postgres (or unset) and DATABASE_URL is reachable -> use real PostgreSQL.
 * 2. If that fails and DB_FALLBACK is not "false" -> use PGlite, an embedded PostgreSQL
 *    (real Postgres compiled to WASM) persisted to server/.pgdata.
 *
 * This keeps `npm run dev` working even when a local Postgres server is unavailable,
 * while production still uses the real PostgreSQL connection from DATABASE_URL.
 */

let dbPromise = null;
let activeDriver = null;
let activeName = "unknown";

async function connectPostgres() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }

  const pool = new Pool({
    connectionString,
    connectionTimeoutMillis: 2500,
    max: 10,
  });

  // Fail fast if the server is not reachable / broken.
  const client = await pool.connect();
  client.release();

  return {
    name: "postgres",
    query: (text, params) => pool.query(text, params),
    exec: (sql) => pool.query(sql),
    close: () => pool.end(),
  };
}

async function connectPglite() {
  const { PGlite } = await import("@electric-sql/pglite");
  const dataDir =
    process.env.PGLITE_DIR || path.join(__dirname, "..", ".pgdata");

  const lite = await PGlite.create(dataDir);

  return {
    name: "pglite",
    query: (text, params) => lite.query(text, params),
    exec: (sql) => lite.exec(sql),
    close: () => lite.close(),
  };
}

export async function getDb() {
  if (!dbPromise) {
    dbPromise = (async () => {
      const preferred = (process.env.DB_DRIVER || "auto").toLowerCase();
      const allowFallback = process.env.DB_FALLBACK !== "false";

      if (preferred !== "pglite") {
        try {
          const pgDb = await connectPostgres();
          activeDriver = pgDb;
          activeName = "postgres";
          console.log("[db] Using PostgreSQL via DATABASE_URL");
          return pgDb;
        } catch (err) {
          const reason = err.message || err.code || "connection failed";
          console.warn(`[db] PostgreSQL unavailable: ${reason}`);
          if (!allowFallback) {
            throw err;
          }
        }
      }

      const lite = await connectPglite();
      activeDriver = lite;
      activeName = "pglite";
      console.log(
        `[db] Using embedded PostgreSQL (PGlite) at ${process.env.PGLITE_DIR || "server/.pgdata"}`
      );
      return lite;
    })();
  }

  return dbPromise;
}

export function getDriverName() {
  return activeName;
}

export async function closeDb() {
  if (activeDriver) {
    await activeDriver.close();
    activeDriver = null;
    dbPromise = null;
  }
}

/**
 * `pg`-compatible facade so controllers can simply call `db.query(sql, params)`.
 */
const db = {
  query: async (text, params) => {
    const driver = await getDb();
    return driver.query(text, params);
  },
  exec: async (sql) => {
    const driver = await getDb();
    return driver.exec(sql);
  },
  end: closeDb,
};

export default db;
