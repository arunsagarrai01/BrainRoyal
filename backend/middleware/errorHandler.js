import { ApiError } from '../utils/ApiError.js';
import { isProd } from '../config/env.js';

// 404 handler for unmatched routes.
export function notFoundHandler(req, res) {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.originalUrl}` });
}

// Central error handler. Normalizes ApiError and Prisma errors.
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      error: err.message,
      ...(err.details ? { details: err.details } : {}),
    });
  }

  // Prisma known errors
  if (err.code === 'P2002') {
    return res.status(409).json({ error: 'A record with that value already exists' });
  }
  if (err.code === 'P2025') {
    return res.status(404).json({ error: 'Record not found' });
  }

  if (!isProd) {
    // eslint-disable-next-line no-console
    console.error(err);
  }

  res.status(500).json({
    error: 'Internal server error',
    ...(isProd ? {} : { message: err.message }),
  });
}
