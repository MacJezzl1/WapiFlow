import { Request, Response, NextFunction } from 'express';
import { APIError } from '@/utils/errors';

export function errorHandler(err: Error, req: Request, res: Response, next: NextFunction) {
  console.error('Error:', err);

  if (err instanceof APIError) {
    return res.status(err.statusCode).json(err.toJSON());
  }

  if (err instanceof SyntaxError && 'body' in err) {
    return res.status(400).json({
      statusCode: 400,
      message: 'Invalid JSON',
      details: { error: err.message },
    });
  }

  // Default error response
  res.status(500).json({
    statusCode: 500,
    message: 'Internal Server Error',
    details: process.env.NODE_ENV === 'development' ? { error: err.message } : undefined,
  });
}

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({
    statusCode: 404,
    message: `Route not found: ${req.method} ${req.path}`,
  });
}
