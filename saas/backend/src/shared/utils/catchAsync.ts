import { Request, Response, NextFunction } from 'express';

// Wraps an async route handler to automatically catch rejections and pass them to next()
export const catchAsync = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) => 
  (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
