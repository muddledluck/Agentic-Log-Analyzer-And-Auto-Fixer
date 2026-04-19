import { Request, Response, NextFunction } from 'express';
import { Schema, z } from 'zod';
import { BadRequestError } from '../errors/AppError';

export const validateRequest = (schema: Schema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      // Parse request body against schema
      schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        // Format the Zod errors into a single string for simplicity or keep it structured.
        const zodErr = error as any;
        const errorMessage = zodErr.errors.map((e: any) => `${e.path.join('.')}: ${e.message}`).join(', ');
        next(new BadRequestError(`Validation failed: ${errorMessage}`));
      } else {
        next(error);
      }
    }
  };
};
