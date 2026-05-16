import type { FastifyInstance } from 'fastify'
import { requireAuth } from '../../plugins/auth.js'
import { db } from '../../db/index.js'
import { backups, servers } from '../../db/schema.js'
import { eq, and, desc } from 'drizzle-orm'
import { z } from 'zod'

async function assertOwner(serverId: string, userId: string, isAdmin: boolean) {
  const [srv] = await db.select({ id: servers.id }).from(servers)
    .where(isAdmin ? eq(servers.id, serverId) : and(eq(servers.id, serverId), eq(servers.userId, userId)))
  return !!srv
}

const createSchema = z.object({ name: z.string().min(1).max(255) })

export async function serversBackupsRoutes(app: FastifyInstance) {
  app.get('/api/client/servers/:id/backups', { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const { userId, role } = req.session!
    if (!await assertOwner(id, userId, role === 'admin')) return reply.code(403).send({ error: 'Forbidden' })
    return db.select().from(backups).where(eq(backups.serverId, id)).orderBy(desc(backups.createdAt))
  })

  app.post('/api/client/servers/:id/backups', { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const { userId, role } = req.session!
    if (!await assertOwner(id, userId, role === 'admin')) return reply.code(403).send({ error: 'Forbidden' })
    const body = createSchema.parse(req.body)
    const [row] = await db.insert(backups).values({
      serverId: id, name: body.name, completed: true, successful: true,
    }).returning()
    // In a full implementation, this would trigger Wings to create a backup
    // and update the record with bytes/checksum once complete
    return reply.code(201).send(row)
  })

  app.delete('/api/client/servers/:id/backups/:backupId', { preHandler: requireAuth }, async (req, reply) => {
    const { id, backupId } = req.params as { id: string; backupId: string }
    const { userId, role } = req.session!
    if (!await assertOwner(id, userId, role === 'admin')) return reply.code(403).send({ error: 'Forbidden' })
    const [deleted] = await db.delete(backups)
      .where(and(eq(backups.id, backupId), eq(backups.serverId, id))).returning()
    if (!deleted) return reply.code(404).send({ error: 'Backup not found' })
    return reply.code(204).send()
  })
}
