import { z } from 'zod'

export const createLocationSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(500).optional(),
})

export type CreateLocationDto = z.infer<typeof createLocationSchema>
