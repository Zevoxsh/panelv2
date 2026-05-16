import type { FastifyInstance } from 'fastify'
import { requireAdmin } from '../../plugins/auth.js'
import { createEggSchema, updateEggSchema, createVariableSchema, updateVariableSchema } from './eggs.schemas.js'
import {
  listEggs, getEgg, createEgg, updateEgg, deleteEgg,
  listVariables, createVariable, updateVariable, deleteVariable,
} from './eggs.service.js'
import { z } from 'zod'

const ptdlVariableSchema = z.object({
  name: z.string(),
  description: z.string().default(''),
  env_variable: z.string(),
  default_value: z.string().default(''),
  user_viewable: z.boolean(),
  user_editable: z.boolean(),
  rules: z.string().default(''),
})

const ptdlImportSchema = z.object({
  dockerImage: z.string().min(1),
  data: z.object({
    name: z.string().min(1),
    description: z.string().default(''),
    startup: z.string().min(1),
    config: z.object({
      stop: z.string().default('^C'),
      startup: z.string().default('{}'),
      files: z.any().optional(),
    }).passthrough(),
    scripts: z.object({
      installation: z.object({
        script: z.string().default(''),
        container: z.string().default('ghcr.io/ptero-eggs/installers:alpine'),
        entrypoint: z.string().default('ash'),
      }).optional(),
    }).optional(),
    variables: z.array(ptdlVariableSchema).default([]),
  }).passthrough(),
})

export async function eggsRoutes(app: FastifyInstance) {
  app.get('/api/admin/eggs', { preHandler: requireAdmin }, async () => listEggs())

  app.post('/api/admin/eggs/import', { preHandler: requireAdmin }, async (req, reply) => {
    const { dockerImage, data } = ptdlImportSchema.parse(req.body)

    // Extract startup done string from config.startup JSON field if present
    let startupDoneString = ']'
    try {
      const startupCfg = JSON.parse(data.config.startup)
      if (typeof startupCfg.done === 'string') startupDoneString = startupCfg.done
    } catch { /* use default */ }

    const install = data.scripts?.installation
    // docker_images map from egg JSON — use as-is, fall back to the selected image
    const dockerImages: Record<string, string> = (data as any).docker_images ?? { Default: dockerImage }

    // config.files is stored as raw JSON string (Wings format)
    const configFiles = typeof data.config.files === 'string'
      ? data.config.files
      : (data.config.files ? JSON.stringify(data.config.files) : '')

    const egg = await createEgg({
      name: data.name,
      description: data.description || undefined,
      dockerImage,
      dockerImages,
      startupCommand: data.startup,
      stopCommand: data.config.stop || '^C',
      startupDoneString,
      installScript: install?.script ?? '',
      installContainer: install?.container ?? 'ghcr.io/ptero-eggs/installers:alpine',
      installEntrypoint: install?.entrypoint ?? 'ash',
      configFiles,
    })

    for (const v of data.variables) {
      await createVariable(egg.id, {
        name: v.name,
        description: v.description || undefined,
        envVariable: v.env_variable,
        defaultValue: v.default_value,
        userViewable: v.user_viewable,
        userEditable: v.user_editable,
        rules: v.rules,
      })
    }

    return reply.code(201).send(egg)
  })

  app.post('/api/admin/eggs', { preHandler: requireAdmin }, async (req, reply) => {
    const body = createEggSchema.parse(req.body)
    const egg = await createEgg(body)
    return reply.code(201).send(egg)
  })

  app.get('/api/admin/eggs/:id', { preHandler: requireAdmin }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const egg = await getEgg(id)
    if (!egg) return reply.code(404).send({ error: 'Egg introuvable' })
    return egg
  })

  app.patch('/api/admin/eggs/:id', { preHandler: requireAdmin }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const body = updateEggSchema.parse(req.body)
    const egg = await updateEgg(id, body)
    if (!egg) return reply.code(404).send({ error: 'Egg introuvable' })
    return egg
  })

  app.delete('/api/admin/eggs/:id', { preHandler: requireAdmin }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const deleted = await deleteEgg(id)
    if (!deleted) return reply.code(404).send({ error: 'Egg introuvable' })
    return reply.code(204).send()
  })

  // Variables
  app.get('/api/admin/eggs/:id/variables', { preHandler: requireAdmin }, async (req) => {
    const { id } = req.params as { id: string }
    return listVariables(id)
  })

  app.post('/api/admin/eggs/:id/variables', { preHandler: requireAdmin }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const body = createVariableSchema.parse(req.body)
    const v = await createVariable(id, body)
    return reply.code(201).send(v)
  })

  app.patch('/api/admin/eggs/:eggId/variables/:varId', { preHandler: requireAdmin }, async (req, reply) => {
    const { varId } = req.params as { varId: string }
    const body = updateVariableSchema.parse(req.body)
    const v = await updateVariable(varId, body)
    if (!v) return reply.code(404).send({ error: 'Variable introuvable' })
    return v
  })

  app.delete('/api/admin/eggs/:eggId/variables/:varId', { preHandler: requireAdmin }, async (req, reply) => {
    const { varId } = req.params as { varId: string }
    const deleted = await deleteVariable(varId)
    if (!deleted) return reply.code(404).send({ error: 'Variable introuvable' })
    return reply.code(204).send()
  })
}
