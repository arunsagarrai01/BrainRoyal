import http from 'http';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { Server as SocketServer } from 'socket.io';

import { env } from './config/env.js';
import apiRoutes from './routes/index.js';
import { notFoundHandler, errorHandler } from './middleware/errorHandler.js';
import { initSockets } from './sockets/index.js';

const app = express();

// Security & parsing middleware.
app.use(
  cors({
    origin: env.clientOrigin.split(',').map((o) => o.trim()),
    credentials: true,
  })
);
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

// Basic rate limiting on the API surface.
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', limiter);

app.get('/', (req, res) => res.json({ name: 'Quiz Battle Arena API', status: 'running' }));
app.use('/api', apiRoutes);

// 404 + error handling (must be last).
app.use(notFoundHandler);
app.use(errorHandler);

const server = http.createServer(app);

const io = new SocketServer(server, {
  cors: {
    origin: env.clientOrigin.split(',').map((o) => o.trim()),
    credentials: true,
  },
});
initSockets(io);

server.listen(env.port, () => {
  // eslint-disable-next-line no-console
  console.log(`Quiz Battle Arena API running on http://localhost:${env.port}`);
});

export { app, server, io };
