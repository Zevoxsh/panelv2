import type { FastifyInstance } from 'fastify'
import { requireAuth, requireAdmin } from '../../plugins/auth.js'
import { db } from '../../db/index.js'
import { serverDatabases, servers } from '../../db/schema.js'
import { eq, and } from 'drizzle-orm'
import { randomBytes } from 'crypto'
import { z } from 'zod'

async function assertOwner(serverId: string, userId: string, isAdmin: boolean) {
  const [srv] = await db.select({ id: servers.id }).from(servers)
    .where(isAdmin ? eq(servers.id, serverId) : and(eq(servers.id, serverId), eq(servers.userId, userId)))
  return !!srv
}

const createSchema = z.object({
  name: z.string().min(1).max(100),
  host: z.string().min(1).max(255).default('127.0.0.1'),
  port: z.number().int().min(1).max(65535).default(3306),
  remote: z.string().max(100).default('%'),
})

export async function serversDatabasesRoutes(app: FastifyInstance) {
  app.get('/api/admin/databases', { preHandler: requireAdmin }, async () => {
    return db.select().from(serverDatabases).orderBy(serverDatabases.createdAt)
  })

  app.get('/api/client/servers/:id/databases', { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const { userId, role } = req.session!
    if (!await assertOwner(id, userId, role === 'admin')) return reply.code(403).send({ error: 'Forbidden' })
    return db.select().from(serverDatabases).where(eq(serverDatabases.serverId, id)).orderBy(serverDatabases.createdAt)
  })

  app.post('/api/client/servers/:id/databases', { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const { userId, role } = req.session!
    if (!await assertOwner(id, userId, role === 'admin')) return reply.code(403).send({ error: 'Forbidden' })
    const body = createSchema.parse(req.body)
    const username = `u_${randomBytes(4).toString('hex')}`
    const password = randomBytes(16).toString('hex')
    const [row] = await db.insert(serverDatabases).values({
      serverId: id, name: body.name, username,
      password, host: body.host, port: body.port, remote: body.remote,
    }).returning()
    return reply.code(201).send(row)
  })

  app.patch('/api/client/servers/:id/databases/:dbId/rotate', { preHandler: requireAuth }, async (req, reply) => {
    const { id, dbId } = req.params as { id: string; dbId: string }
    const { userId, role } = req.session!
    if (!await assertOwner(id, userId, role === 'admin')) return reply.code(403).send({ error: 'Forbidden' })
    const password = randomBytes(16).toString('hex')
    const [row] = await db.update(serverDatabases)
      .set({ password }).where(and(eq(serverDatabases.id, dbId), eq(serverDatabases.serverId, id))).returning()
    if (!row) return reply.code(404).send({ error: 'Not found' })
    return row
  })

  app.delete('/api/client/servers/:id/databases/:dbId', { preHandler: requireAuth }, async (req, reply) => {
    const { id, dbId } = req.params as { id: string; dbId: string }
    const { userId, role } = req.session!
    if (!await assertOwner(id, userId, role === 'admin')) return reply.code(403).send({ error: 'Forbidden' })
    await db.delete(serverDatabases).where(and(eq(serverDatabases.id, dbId), eq(serverDatabases.serverId, id)))
    return reply.code(204).send()
  })
}
