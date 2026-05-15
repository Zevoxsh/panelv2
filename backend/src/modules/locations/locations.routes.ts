import type { FastifyInstance } from 'fastify'
import { requireAdmin } from '../../plugins/auth.js'
import { createLocationSchema } from './locations.schemas.js'
import { listLocations, createLocation, deleteLocation } from './locations.service.js'

export async function locationsRoutes(app: FastifyInstance) {
  app.get('/api/admin/locations', { preHandler: requireAdmin }, async () => listLocations())

  app.post('/api/admin/locations', { preHandler: requireAdmin }, async (req, reply) => {
    const body = createLocationSchema.parse(req.body)
    const location = await createLocation(body)
    return reply.code(201).send(location)
  })

  app.delete('/api/admin/locations/:id', { preHandler: requireAdmin }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const deleted = await deleteLocation(id)
    if (!deleted) return reply.code(404).send({ error: 'Location introuvable' })
    return reply.code(204).send()
  })
}
