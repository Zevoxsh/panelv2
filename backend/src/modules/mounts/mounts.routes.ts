import type { FastifyInstance } from 'fastify'
import { requireAdmin } from '../../plugins/auth.js'
import { db } from '../../db/index.js'
import { mounts } from '../../db/schema.js'
import { eq } from 'drizzle-orm'
import { z } from 'zod'

const mountSchema = z.object({
  name:          z.string().min(1).max(100),
  description:   z.string().max(500).optional(),
  source:        z.string().min(1).max(255),
  target:        z.string().min(1).max(255),
  readOnly:      z.boolean().default(false),
  userMountable: z.boolean().default(false),
})

export async function mountsRoutes(app: FastifyInstance) {
  app.get('/api/admin/mounts', { preHandler: requireAdmin }, async () => {
    return db.select().from(mounts)
  })

  app.post('/api/admin/mounts', { preHandler: requireAdmin }, async (req, reply) => {
    const body = mountSchema.parse(req.body)
    const [row] = await db.insert(mounts).values(body).returning()
    return reply.code(201).send(row)
  })

  app.patch('/api/admin/mounts/:id', { preHandler: requireAdmin }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const body = mountSchema.partial().parse(req.body)
    const [row] = await db.update(mounts).set(body).where(eq(mounts.id, id)).returning()
    if (!row) return reply.code(404).send({ error: 'Mount not found' })
    return row
  })

  app.delete('/api/admin/mounts/:id', { preHandler: requireAdmin }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const [deleted] = await db.delete(mounts).where(eq(mounts.id, id)).returning()
    if (!deleted) return reply.code(404).send({ error: 'Mount not found' })
    return reply.code(204).send()
  })
}
