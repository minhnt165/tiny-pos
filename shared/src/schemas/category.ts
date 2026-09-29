import { z } from 'zod';

export const categoryInputSchema = z.object({
  name: z.string().trim().min(1).max(100),
  sortOrder: z.number().int().min(0).default(0),
});
export type CategoryInput = z.infer<typeof categoryInputSchema>;
