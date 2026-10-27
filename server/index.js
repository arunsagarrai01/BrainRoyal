import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import authRoutes from "./routes/auth.js";
import gameRoutes from "./routes/game.js";
import db, { getDb, getDriverName, closeDb } from "./config/db.js";
import { initSchema } from "./db/init.js";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 5000;

const allowedOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:4173",
];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow non-browser clients (curl, tests) and configured dev origins.
      if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
      return callback(null, true);
    },
  })
);
app.use(express.json({ limit: "100kb" }));

// Simple request log so events are visible while developing.
app.use((req, _res, next) => {
  console.log(`[api] ${req.method} ${req.originalUrl}`);
  next();
});

app.get("/", (_req, res) => {
  res.json({
    message: "BrainRoyale API is running",
    driver: getDriverName(),
    endpoints: [
      "POST /api/auth/register",
      "POST /api/auth/login",
      "GET  /api/auth/me",
      "GET  /api/game/question",
      "POST /api/game/answer",
      "POST /api/game/score",
      "GET  /api/game/leaderboard",
      "GET  /api/game/stats",
      "GET  /api/health",
    ],
  });
});

app.get("/api/health", async (_req, res) => {
  try {
    await db.query("SELECT 1");
    res.json({ status: "ok", database: getDriverName(), uptime: process.uptime() });
  } catch (err) {
    res.status(503).json({ status: "degraded", database: getDriverName(), error: err.message });
  }
});

app.use("/api/auth", authRoutes);
app.use("/api/game", gameRoutes);

app.use((req, res) => {
  res.status(404).json({ message: `Route ${req.method} ${req.originalUrl} not found` });
});

app.use((err, _req, res, _next) => {
  console.error("[api] unhandled error:", err);
  res.status(500).json({ message: "Internal server error" });
});

async function start() {
  try {
    await getDb();
    await initSchema();

    if (!process.env.JWT_SECRET) {
      process.env.JWT_SECRET = "dev-only-insecure-secret";
      console.warn("[auth] JWT_SECRET not set - using an insecure development secret");
    }

    const server = app.listen(PORT, () => {
      console.log(`[api] BrainRoyale API on http://localhost:${PORT}`);
      console.log(`[api] Database driver: ${getDriverName()}`);
    });

    const shutdown = async (signal) => {
      console.log(`\n[api] ${signal} received, shutting down`);
      server.close(async () => {
        await closeDb();
        process.exit(0);
      });
    };

    process.on("SIGINT", () => shutdown("SIGINT"));
    process.on("SIGTERM", () => shutdown("SIGTERM"));
  } catch (err) {
    console.error("[api] Failed to start:", err);
    process.exit(1);
  }
}

start();
