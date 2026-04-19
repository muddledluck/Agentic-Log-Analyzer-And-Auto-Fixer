import { z } from 'zod';

export const createProjectSchema = z.object({
  name: z.string().min(2, 'Project name must be at least 2 characters').max(50, 'Project name must be at most 50 characters'),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;

export const listEventsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

export type ListEventsQuery = z.infer<typeof listEventsQuerySchema>;
