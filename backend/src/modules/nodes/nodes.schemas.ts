import { z } from 'zod'

export const createNodeSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  locationId: z.string().uuid(),
  fqdn: z.string().min(1),
  scheme: z.enum(['https', 'http']).default('https'),
  behindProxy: z.boolean().default(false),
  isPublic: z.boolean().default(true),
  daemonDir: z.string().default('/var/lib/pterodactyl/volumes'),
  memory: z.number().int().positive(),
  memoryOverallocate: z.number().int().default(0),
  disk: z.number().int().positive(),
  diskOverallocate: z.number().int().default(0),
  daemonPort: z.number().int().default(8080),
  daemonSftp: z.number().int().default(2022),
  panelUrl: z.string().url(),
})

export const updateNodeSchema = createNodeSchema.partial()

export type CreateNodeDto = z.infer<typeof createNodeSchema>
export type UpdateNodeDto = z.infer<typeof updateNodeSchema>
