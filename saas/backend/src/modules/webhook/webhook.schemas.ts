import { z } from 'zod';

export const ingestErrorSchema = z.object({
  source: z.string().optional(),
  rawBlock: z.string().min(1, 'rawBlock cannot be empty'),
  timestamp: z.string().optional(),
  contextLines: z.array(z.string()).optional(),
});

export type IngestErrorInput = z.infer<typeof ingestErrorSchema>;
