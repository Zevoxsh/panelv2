import { z } from 'zod'

export const createServerSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  userId: z.string().uuid(),
  nodeId: z.string().uuid(),
  allocationId: z.string().uuid(),
  eggId: z.string().uuid(),
  dockerImage: z.string().min(1).max(255),
  startupCommand: z.string().min(1),
  memory: z.number().int().positive(),
  disk: z.number().int().positive(),
  cpu: z.number().int().min(0).default(0),
  variables: z.record(z.string(), z.string()).default({}),
})

export const updateServerSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  suspended: z.boolean().optional(),
  memory: z.number().int().positive().optional(),
  disk: z.number().int().positive().optional(),
  cpu: z.number().int().min(0).optional(),
  dockerImage: z.string().min(1).max(255).optional(),
  startupCommand: z.string().min(1).optional(),
})

export type CreateServerDto = z.infer<typeof createServerSchema>
export type UpdateServerDto = z.infer<typeof updateServerSchema>
