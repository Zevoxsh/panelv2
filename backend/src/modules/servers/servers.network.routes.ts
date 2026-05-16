import type { FastifyInstance } from 'fastify'
import { requireAuth } from '../../plugins/auth.js'
import { db } from '../../db/index.js'
import { serverAllocations, allocations, servers } from '../../db/schema.js'
import { eq, and, notInArray } from 'drizzle-orm'

async function assertOwner(serverId: string, userId: string, isAdmin: boolean) {
  const [srv] = await db.select({ id: servers.id, userId: servers.userId, nodeId: servers.nodeId, allocationId: servers.allocationId })
    .from(servers).where(eq(servers.id, serverId))
  if (!srv) return null
  if (!isAdmin && srv.userId !== userId) return null
  return srv
}

export async function serversNetworkRoutes(app: FastifyInstance) {
  // List all allocations for this server (primary + secondary)
  app.get('/api/client/servers/:id/network', { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const { userId, role } = req.session!
    const srv = await assertOwner(id, userId, role === 'admin')
    if (!srv) return reply.code(403).send({ error: 'Forbidden' })

    // Primary allocation
    const [primary] = await db.select().from(allocations).where(eq(allocations.id, srv.allocationId))

    // Secondary allocations
    const secondaryLinks = await db.select({ allocationId: serverAllocations.allocationId })
      .from(serverAllocations).where(eq(serverAllocations.serverId, id))
    const secondaryIds = secondaryLinks.map(l => l.allocationId)
    const secondary = secondaryIds.length > 0
      ? await db.select().from(allocations).where(eq(allocations.nodeId, srv.nodeId))
          .then(rows => rows.filter(r => secondaryIds.includes(r.id)))
      : []

    return {
      primary: { ...primary, isPrimary: true },
      secondary: secondary.map(a => ({ ...a, isPrimary: false })),
    }
  })

  // List available (free) allocations on same node
  app.get('/api/client/servers/:id/network/available', { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const { userId, role } = req.session!
    const srv = await assertOwner(id, userId, role === 'admin')
    if (!srv) return reply.code(403).send({ error: 'Forbidden' })

    // Get all allocations on this node that aren't already used as primary
    const usedPrimaries = await db.select({ allocationId: servers.allocationId }).from(servers)
    const usedIds = usedPrimaries.map(u => u.allocationId)

    // Get secondary allocations for this server
    const secondaryLinks = await db.select({ allocationId: serverAllocations.allocationId })
      .from(serverAllocations).where(eq(serverAllocations.serverId, id))
    const secondaryIds = secondaryLinks.map(l => l.allocationId)

    const allNodeAllocs = await db.select().from(allocations).where(eq(allocations.nodeId, srv.nodeId))
    return allNodeAllocs.filter(a =>
      a.id !== srv.allocationId &&
      !secondaryIds.includes(a.id) &&
      !usedIds.includes(a.id)
    )
  })

  // Add a secondary allocation
  app.post('/api/client/servers/:id/network', { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const { userId, role } = req.session!
    const srv = await assertOwner(id, userId, role === 'admin')
    if (!srv) return reply.code(403).send({ error: 'Forbidden' })
    const { allocationId } = req.body as { allocationId: string }
    // Verify this allocation is on the same node and free
    const [alloc] = await db.select().from(allocations)
      .where(and(eq(allocations.id, allocationId), eq(allocations.nodeId, srv.nodeId)))
    if (!alloc) return reply.code(404).send({ error: 'Allocation not found on this node' })
    await db.insert(serverAllocations).values({ serverId: id, allocationId }).onConflictDoNothing()
    return reply.code(204).send()
  })

  // Remove a secondary allocation
  app.delete('/api/client/servers/:id/network/:allocationId', { preHandler: requireAuth }, async (req, reply) => {
    const { id, allocationId } = req.params as { id: string; allocationId: string }
    const { userId, role } = req.session!
    const srv = await assertOwner(id, userId, role === 'admin')
    if (!srv) return reply.code(403).send({ error: 'Forbidden' })
    if (allocationId === srv.allocationId) return reply.code(400).send({ error: 'Cannot remove primary allocation' })
    await db.delete(serverAllocations)
      .where(and(eq(serverAllocations.serverId, id), eq(serverAllocations.allocationId, allocationId)))
    return reply.code(204).send()
  })
}
