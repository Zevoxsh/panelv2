import type { FastifyInstance } from 'fastify'
import { requireAuth } from '../../plugins/auth.js'
import { db } from '../../db/index.js'
import { serverSubusers, servers, users } from '../../db/schema.js'
import { eq, and } from 'drizzle-orm'
import { z } from 'zod'

async function assertOwner(serverId: string, userId: string, isAdmin: boolean) {
  const [srv] = await db.select({ id: servers.id, userId: servers.userId }).from(servers)
    .where(eq(servers.id, serverId))
  if (!srv) return false
  return isAdmin || srv.userId === userId
}

const ALL_PERMISSIONS = [
  'control.console', 'control.start', 'control.stop', 'control.restart',
  'user.create', 'user.delete', 'user.update',
  'file.create', 'file.read', 'file.update', 'file.delete',
  'backup.create', 'backup.delete',
  'database.create', 'database.delete', 'database.view',
  'schedule.create', 'schedule.delete', 'schedule.update',
  'settings.rename', 'settings.reinstall',
]

const addSchema = z.object({
  email: z.string().email(),
  permissions: z.array(z.string()).default([]),
})

const updateSchema = z.object({
  permissions: z.array(z.string()),
})

export async function serversSubusersRoutes(app: FastifyInstance) {
  app.get('/api/client/servers/:id/users', { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const { userId, role } = req.session!
    if (!await assertOwner(id, userId, role === 'admin')) return reply.code(403).send({ error: 'Forbidden' })
    const rows = await db.select({
      id: serverSubusers.id,
      serverId: serverSubusers.serverId,
      userId: serverSubusers.userId,
      permissions: serverSubusers.permissions,
      createdAt: serverSubusers.createdAt,
      username: users.username,
      email: users.email,
    }).from(serverSubusers)
      .leftJoin(users, eq(serverSubusers.userId, users.id))
      .where(eq(serverSubusers.serverId, id))
    return rows
  })

  app.post('/api/client/servers/:id/users', { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const { userId, role } = req.session!
    if (!await assertOwner(id, userId, role === 'admin')) return reply.code(403).send({ error: 'Forbidden' })
    const body = addSchema.parse(req.body)
    const [target] = await db.select().from(users).where(eq(users.email, body.email))
    if (!target) return reply.code(404).send({ error: 'User not found' })
    if (target.id === userId) return reply.code(400).send({ error: 'Cannot add yourself as a sub-user' })
    const [existing] = await db.select().from(serverSubusers)
      .where(and(eq(serverSubusers.serverId, id), eq(serverSubusers.userId, target.id)))
    if (existing) return reply.code(409).send({ error: 'User already has access' })
    const [row] = await db.insert(serverSubusers).values({
      serverId: id, userId: target.id, permissions: body.permissions,
    }).returning()
    return reply.code(201).send({ ...row, username: target.username, email: target.email })
  })

  app.patch('/api/client/servers/:id/users/:subuserId', { preHandler: requireAuth }, async (req, reply) => {
    const { id, subuserId } = req.params as { id: string; subuserId: string }
    const { userId, role } = req.session!
    if (!await assertOwner(id, userId, role === 'admin')) return reply.code(403).send({ error: 'Forbidden' })
    const body = updateSchema.parse(req.body)
    const [row] = await db.update(serverSubusers).set({ permissions: body.permissions })
      .where(and(eq(serverSubusers.id, subuserId), eq(serverSubusers.serverId, id))).returning()
    if (!row) return reply.code(404).send({ error: 'Sub-user not found' })
    return row
  })

  app.delete('/api/client/servers/:id/users/:subuserId', { preHandler: requireAuth }, async (req, reply) => {
    const { id, subuserId } = req.params as { id: string; subuserId: string }
    const { userId, role } = req.session!
    if (!await assertOwner(id, userId, role === 'admin')) return reply.code(403).send({ error: 'Forbidden' })
    await db.delete(serverSubusers)
      .where(and(eq(serverSubusers.id, subuserId), eq(serverSubusers.serverId, id)))
    return reply.code(204).send()
  })

  // Return available permissions list
  app.get('/api/client/servers/:id/users/permissions', { preHandler: requireAuth }, async () => {
    return ALL_PERMISSIONS
  })
}
