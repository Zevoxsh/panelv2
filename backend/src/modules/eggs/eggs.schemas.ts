import { z } from 'zod'

export const createEggSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  dockerImage: z.string().min(1).max(255),
  dockerImages: z.record(z.string(), z.string()).default({}),
  startupCommand: z.string().min(1),
  stopCommand: z.string().max(100).default('^C'),
  startupDoneString: z.string().max(255).default(']'),
  installScript: z.string().default(''),
  installContainer: z.string().max(255).default('ghcr.io/ptero-eggs/installers:alpine'),
  installEntrypoint: z.string().max(100).default('ash'),
  configFiles: z.string().default(''),
})

export const updateEggSchema = createEggSchema.partial()

export const createVariableSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  envVariable: z.string().min(1).max(100).regex(/^[A-Z0-9_]+$/, 'Majuscules, chiffres et _ uniquement'),
  defaultValue: z.string().max(255).default(''),
  userViewable: z.boolean().default(true),
  userEditable: z.boolean().default(true),
  rules: z.string().max(255).default(''),
})

export const updateVariableSchema = createVariableSchema.partial()

export type CreateEggDto = z.infer<typeof createEggSchema>
export type UpdateEggDto = z.infer<typeof updateEggSchema>
export type CreateVariableDto = z.infer<typeof createVariableSchema>
export type UpdateVariableDto = z.infer<typeof updateVariableSchema>
