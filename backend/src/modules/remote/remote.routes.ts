import type { FastifyInstance } from 'fastify'
import { db } from '../../db/index.js'
import { nodes, servers, allocations, eggs } from '../../db/schema.js'
import { eq, and } from 'drizzle-orm'
import { buildWingsServerPayload, markInstalled, getServerVariables } from '../servers/servers.service.js'

function buildProcessConfiguration(stopCommand: string, startupDoneString: string) {
  const stopType = stopCommand === '^C' ? 'signal' : 'command'
  const stopValue = stopCommand === '^C' ? 'SIGINT' : stopCommand

  return {
    startup: {
      done: [startupDoneString],
      user_interaction: [],
      strip_ansi: false,
    },
    stop: { type: stopType, value: stopValue },
    configs: [],
    logs: [],
  }
}

function wingsError(reply: any, status: number, code: string, detail: string) {
  return reply.code(status).send({
    errors: [{ code, status: String(status), detail }],
  })
}

async function requireNodeToken(req: any, reply: any) {
  const auth = req.headers['authorization'] ?? ''
  const raw = auth.startsWith('Bearer ') ? auth.slice(7) : null
  if (!raw) return wingsError(reply, 401, 'NotAuthenticated', 'No token provided')

  const dotIdx = raw.indexOf('.')
  let node
  if (dotIdx !== -1) {
    const tokenId = raw.slice(0, dotIdx)
    const daemonToken = raw.slice(dotIdx + 1)
    const [found] = await db.select().from(nodes)
      .where(and(eq(nodes.tokenId, tokenId), eq(nodes.daemonToken, daemonToken)))
    node = found
  } else {
    const [found] = await db.select().from(nodes).where(eq(nodes.daemonToken, raw))
    node = found
  }

  if (!node) return wingsError(reply, 403, 'AccessDenied', 'Invalid token')
  req.wingNode = node
}

export async function remoteRoutes(app: FastifyInstance) {
  app.get('/api/remote/servers', { preHandler: requireNodeToken }, async (req, reply) => {
    const node = (req as any).wingNode
    const nodeServers = await db.select().from(servers).where(eq(servers.nodeId, node.id))

    const data = await Promise.all(
      nodeServers.map(async (s) => {
        const payload = await buildWingsServerPayload(s.id)
        return payload ? { uuid: s.id, settings: payload.settings } : null
      })
    )

    const items = data.filter(Boolean)
    return reply.send({
      data: items,
      meta: {
        current_page: 1,
        from: items.length > 0 ? 1 : null,
        last_page: 1,
        links: [],
        path: '/api/remote/servers',
        per_page: 50,
        to: items.length > 0 ? items.length : null,
        total: items.length,
      },
    })
  })

  app.get('/api/remote/servers/:uuid/install', { preHandler: requireNodeToken }, async (req, reply) => {
    const { uuid } = req.params as { uuid: string }
    const [server] = await db.select().from(servers).where(eq(servers.id, uuid))
    if (!server) return wingsError(reply, 404, 'NotFound', 'Server not found')

    const [egg] = await db.select().from(eggs).where(eq(eggs.id, server.eggId))
    if (!egg) return wingsError(reply, 404, 'NotFound', 'Egg not found')

    return reply.send({
      container_image: egg.installContainer || 'ghcr.io/ptero-eggs/installers:alpine',
      entrypoint: egg.installEntrypoint || 'ash',
      script: egg.installScript || '#!/bin/ash\necho "No install script configured"',
    })
  })

  app.get('/api/remote/servers/:uuid', { preHandler: requireNodeToken }, async (req, reply) => {
    const { uuid } = req.params as { uuid: string }

    const payload = await buildWingsServerPayload(uuid)
    if (!payload) return wingsError(reply, 404, 'NotFound', 'Server not found')

    // Fetch stop command and startup done string from egg
    const [server] = await db.select().from(servers).where(eq(servers.id, uuid))
    if (!server) return wingsError(reply, 404, 'NotFound', 'Server not found')

    const [egg] = await db.select().from(eggs).where(eq(eggs.id, server.eggId))
    const stopCommand = egg?.stopCommand ?? 'stop'
    const startupDoneString = egg?.startupDoneString ?? ']'

    return reply.send({
      settings: payload.settings,
      process_configuration: buildProcessConfiguration(stopCommand, startupDoneString),
    })
  })

  app.post('/api/remote/servers/reset', { preHandler: requireNodeToken }, async (_req, reply) => {
    return reply.code(204).send()
  })

  app.post('/api/remote/servers/:uuid/install', { preHandler: requireNodeToken }, async (req, reply) => {
    const { uuid } = req.params as { uuid: string }
    const body = req.body as { successful?: boolean }
    if (body.successful !== false) {
      await markInstalled(uuid)
    }
    return reply.code(204).send()
  })

  app.post('/api/remote/sftp/auth', { preHandler: requireNodeToken }, async (_req, reply) => {
    return wingsError(reply, 403, 'AccessDenied', 'No matching server')
  })
}
