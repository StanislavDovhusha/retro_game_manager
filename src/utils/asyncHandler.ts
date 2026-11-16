import type { NextFunction, Request, RequestHandler, Response } from 'express';

/** Wraps an async handler: a rejected promise is passed to the central error middleware (Express 4 does not do it). */
export const asyncHandler =
  (handler: (req: Request, res: Response, next: NextFunction) => Promise<unknown> | unknown): RequestHandler =>
  (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
