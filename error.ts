import type { ErrorRequestHandler } from 'express';
import HttpError from '../utils/httpError';
import { isProduction } from '../config/env';

const errorMiddleware: ErrorRequestHandler = (err, _req, res, _next) => {
  const statusCode = err instanceof HttpError ? err.statusCode : 500;
  const message = err instanceof HttpError && err.expose ? err.message : statusCode === 500 ? 'Internal server error' : err.message;

  if (!isProduction) {
    console.error(err);
  }

  res.status(statusCode).json({
    ok: false,
    error: message,
    ...(isProduction ? {} : { stack: err.stack })
  });
};

export default errorMiddleware;
