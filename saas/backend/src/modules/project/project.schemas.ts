import { z } from 'zod';

export const createProjectSchema = z.object({
  name: z.string().min(2, 'Project name must be at least 2 characters').max(50, 'Project name must be at most 50 characters'),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
