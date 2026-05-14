import type { FastifyInstance } from 'fastify'
import { requireAuth } from '../../plugins/auth.js'
import { createApiKeyBodySchema } from './api-keys.schemas.js'
import { getApiKeys, createApiKey, revokeApiKey } from './api-keys.service.js'

export async function apiKeysRoutes(app: FastifyInstance) {
  app.get('/api/api-keys', { preHandler: requireAuth }, async (req) => {
    const { userId, role } = req.session!
    return getApiKeys(userId, role === 'admin')
  })

  app.post('/api/api-keys', { preHandler: requireAuth, schema: { body: createApiKeyBodySchema } }, async (req, reply) => {
    const { userId, role } = req.session!
    const body = req.body as { name: string; type: 'admin' | 'user'; expiresAt?: string }
    if (body.type === 'admin' && role !== 'admin') return reply.status(403).send({ error: 'Only admins can create admin keys' })
    const result = await createApiKey(userId, body)
    return reply.status(201).send(result)
  })

  app.delete('/api/api-keys/:id', { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const { userId, role } = req.session!
    await revokeApiKey(id, userId, role === 'admin')
    return reply.status(204).send()
  })
}
