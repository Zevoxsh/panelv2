import type { FastifyInstance } from 'fastify'
import http from 'http'
import https from 'https'
import { requireAuth } from '../../plugins/auth.js'
import { getServer } from './servers.service.js'
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

type WingsNode = { scheme: string; fqdn: string; daemonPort: number; daemonToken: string }

function wingsCommand(node: WingsNode, serverId: string, command: string): Promise<{ ok: boolean; status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({ command })
    const transport = node.scheme === 'https' ? https : http
    const req = transport.request({
      hostname: node.fqdn,
      port: node.daemonPort,
      path: `/api/servers/${serverId}/command`,
      method: 'POST',
      headers: {
        Authorization: `Bearer ${node.daemonToken}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
      rejectUnauthorized: false,
      timeout: 10_000,
    }, (res) => {
      const chunks: Buffer[] = []
      res.on('data', (c: Buffer) => chunks.push(c))
      res.on('end', () => {
        const body = Buffer.concat(chunks).toString()
        resolve({ ok: (res.statusCode ?? 0) < 400, status: res.statusCode ?? 0, body })
      })
    })
    req.on('timeout', () => req.destroy(new Error('Wings timeout')))
    req.on('error', reject)
    req.write(payload)
    req.end()
  })
}

export async function serversPlayersRoutes(app: FastifyInstance) {
  app.post('/api/client/servers/:id/players/command', { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const { command } = req.body as { command?: string }
    if (!command?.trim()) return reply.code(400).send({ error: 'Command required' })

    const ctx = await resolveCtx(id, req.session!.userId)
    if (!ctx) return reply.code(404).send({ error: 'Server not found' })

    try {
      const result = await wingsCommand(ctx.node, id, command.trim())
      if (!result.ok) {
        let msg = `Wings returned ${result.status}`
        try { const parsed = JSON.parse(result.body); if (parsed.error) msg = parsed.error } catch {}
        return reply.code(502).send({ error: msg })
      }
      return { ok: true }
    } catch (e: any) {
      return reply.code(502).send({ error: e.message ?? 'Wings unreachable' })
    }
  })
}
