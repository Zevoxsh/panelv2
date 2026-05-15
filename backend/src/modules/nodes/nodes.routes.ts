import type { FastifyInstance } from 'fastify'
import { requireAdmin } from '../../plugins/auth.js'
import { createNodeSchema, updateNodeSchema } from './nodes.schemas.js'
import {
  listNodes, getNode, createNode, updateNode, deleteNode,
  checkNodeStatus, getNodeConfig, resetNodeKey, getNodeSystemInfo,
} from './nodes.service.js'
import { db } from '../../db/index.js'
import { allocations } from '../../db/schema.js'
import { eq, and } from 'drizzle-orm'
import { z } from 'zod'

const createAllocationsSchema = z.object({
  ip: z.string().min(1),
  ipAlias: z.string().optional(),
  ports: z.string().min(1),
})

function parsePorts(raw: string): number[] {
  const ports: number[] = []
  for (const part of raw.split(/[\s,]+/)) {
    const range = part.match(/^(\d+)-(\d+)$/)
    if (range) {
      for (let p = Number(range[1]); p <= Number(range[2]); p++) ports.push(p)
    } else if (/^\d+$/.test(part)) {
      ports.push(Number(part))
    }
  }
  return [...new Set(ports)].sort((a, b) => a - b)
}

export async function nodesRoutes(app: FastifyInstance) {
  app.get('/api/admin/nodes', { preHandler: requireAdmin }, async () => listNodes())

  app.post('/api/admin/nodes', { preHandler: requireAdmin }, async (req, reply) => {
    const body = createNodeSchema.parse(req.body)
    const node = await createNode(body)
    return reply.code(201).send(node)
  })

  app.get('/api/admin/nodes/:id', { preHandler: requireAdmin }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const node = await getNode(id)
    if (!node) return reply.code(404).send({ error: 'Node introuvable' })
    return node
  })

  app.patch('/api/admin/nodes/:id', { preHandler: requireAdmin }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const body = updateNodeSchema.parse(req.body)
    const node = await updateNode(id, body)
    if (!node) return reply.code(404).send({ error: 'Node introuvable' })
    return node
  })

  app.post('/api/admin/nodes/:id/reset-key', { preHandler: requireAdmin }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const node = await resetNodeKey(id)
    if (!node) return reply.code(404).send({ error: 'Node introuvable' })
    return node
  })

  app.get('/api/admin/nodes/:id/config', { preHandler: requireAdmin }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const config = await getNodeConfig(id)
    if (!config) return reply.code(404).send({ error: 'Node introuvable' })
    return reply.type('text/plain').send(config)
  })

  app.get('/api/admin/nodes/:id/status', { preHandler: requireAdmin }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const status = await checkNodeStatus(id)
    if (!status) return reply.code(404).send({ error: 'Node introuvable' })
    return status
  })

  app.get('/api/admin/nodes/:id/system', { preHandler: requireAdmin }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const info = await getNodeSystemInfo(id)
    if (!info) return reply.code(404).send({ error: 'Node introuvable' })
    return info
  })

  app.delete('/api/admin/nodes/:id', { preHandler: requireAdmin }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const deleted = await deleteNode(id)
    if (!deleted) return reply.code(404).send({ error: 'Node introuvable' })
    return reply.code(204).send()
  })

  // Allocations
  app.get('/api/admin/nodes/:id/allocations', { preHandler: requireAdmin }, async (req) => {
    const { id } = req.params as { id: string }
    return db.select().from(allocations).where(eq(allocations.nodeId, id)).orderBy(allocations.ip, allocations.port)
  })

  app.post('/api/admin/nodes/:id/allocations', { preHandler: requireAdmin }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const { ip, ipAlias, ports: rawPorts } = createAllocationsSchema.parse(req.body)
    const ports = parsePorts(rawPorts)
    if (ports.length === 0) return reply.code(400).send({ error: 'Aucun port valide' })
    if (ports.length > 200) return reply.code(400).send({ error: 'Maximum 200 ports à la fois' })

    const rows = ports.map((port) => ({ nodeId: id, ip, ipAlias: ipAlias || null, port }))
    await db.insert(allocations).values(rows).onConflictDoNothing()
    return reply.code(201).send({ created: rows.length })
  })

  app.delete('/api/admin/allocations/:allocId', { preHandler: requireAdmin }, async (req, reply) => {
    const { allocId } = req.params as { allocId: string }
    await db.delete(allocations).where(eq(allocations.id, allocId))
    return reply.code(204).send()
  })
}
