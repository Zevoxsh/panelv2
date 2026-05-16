import type { FastifyInstance } from 'fastify'
import { requireAuth } from '../../plugins/auth.js'
import { db } from '../../db/index.js'
import { activityLogs, servers, users } from '../../db/schema.js'
import { eq, and, desc } from 'drizzle-orm'

async function assertOwner(serverId: string, userId: string, isAdmin: boolean) {
  const [srv] = await db.select({ id: servers.id }).from(servers)
    .where(isAdmin ? eq(servers.id, serverId) : and(eq(servers.id, serverId), eq(servers.userId, userId)))
  return !!srv
}

export async function serversActivityRoutes(app: FastifyInstance) {
  app.get('/api/client/servers/:id/activity', { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const { userId, role } = req.session!
    if (!await assertOwner(id, userId, role === 'admin')) return reply.code(403).send({ error: 'Forbidden' })
    const rows = await db.select({
      id: activityLogs.id,
      event: activityLogs.event,
      metadata: activityLogs.metadata,
      ip: activityLogs.ip,
      createdAt: activityLogs.createdAt,
      username: users.username,
    }).from(activityLogs)
      .leftJoin(users, eq(activityLogs.userId, users.id))
      .where(eq(activityLogs.serverId, id))
      .orderBy(desc(activityLogs.createdAt))
      .limit(100)
    return rows
  })
}

// Helper to log an activity (used internally by other routes)
export async function logActivity(
  serverId: string | null,
  userId: string | null,
  event: string,
  metadata?: Record<string, unknown>,
  ip?: string,
) {
  await db.insert(activityLogs).values({ serverId, userId, event, metadata, ip }).catch(() => {})
}
