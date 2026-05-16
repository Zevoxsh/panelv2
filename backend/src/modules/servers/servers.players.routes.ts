import type { FastifyInstance } from 'fastify'
import { requireAuth } from '../../plugins/auth.js'
import { getServer, sendToWings } from './servers.service.js'
import { db } from '../../db/index.js'
import { nodes } from '../../db/schema.js'
import { eq } from 'drizzle-orm'

async function resolveCtx(id: string, userId: string) {
  const server = await getServer(id)
  if (!server || server.userId !== userId) return null
  const [node] = await db.select().from(nodes).where(eq(nodes.id, server.nodeId))
  if (!node) return null
  return { server, node }
}

export async function serversPlayersRoutes(app: FastifyInstance) {
  app.post('/api/client/servers/:id/players/command', { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const { command } = req.body as { command?: string }
    if (!command?.trim()) return reply.code(400).send({ error: 'Command required' })

    const ctx = await resolveCtx(id, req.session!.userId)
    if (!ctx) return reply.code(404).send({ error: 'Server not found' })

    const res = await sendToWings(ctx.node, `/api/servers/${id}/command`, 'POST', { command: command.trim() })
    if (!res.ok) return reply.code(502).send({ error: 'Wings error' })
    return { ok: true }
  })
}
