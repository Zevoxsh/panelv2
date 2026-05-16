import type { FastifyInstance } from 'fastify'
import { WebSocket as WsClient } from 'ws'
import https from 'https'
import { requireAdmin, requireAuth } from '../../plugins/auth.js'
import { createServerSchema, updateServerSchema } from './servers.schemas.js'
import {
  listServers, getServer, createServer, updateServer, deleteServer,
  buildWingsServerPayload, sendToWings, markInstalled, getServerVariables,
} from './servers.service.js'
import { db } from '../../db/index.js'
import { nodes, allocations, servers, serverVariables, users, eggs, locations } from '../../db/schema.js'
import { eq, count, sql } from 'drizzle-orm'
import { createHmac, randomBytes } from 'crypto'

function b64url(buf: Buffer) {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

function createWingsJwt(serverUuid: string, userId: string, daemonToken: string, panelUrl: string) {
  const now = Math.floor(Date.now() / 1000)
  const header = b64url(Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })))
  const payload = b64url(Buffer.from(JSON.stringify({
    iss: panelUrl,
    sub: userId,
    server_uuid: serverUuid,
    user_uuid: userId,
    permissions: [
      'websocket.connect',
      'control.start', 'control.stop', 'control.restart', 'control.kill',
      'send.command',
      'receive.connect', 'receive.status', 'receive.console', 'receive.stats', 'receive.install',
    ],
    jti: randomBytes(8).toString('hex'),
    iat: now, nbf: now - 30, exp: now + 600,
  })))
  const sig = b64url(createHmac('sha256', daemonToken).update(`${header}.${payload}`).digest())
  return `${header}.${payload}.${sig}`
}

export async function serversRoutes(app: FastifyInstance) {
  // ── Dashboard ────────────────────────────────────────────────────────────────
  app.get('/api/admin/dashboard', { preHandler: requireAdmin }, async () => {
    const [[serverStats], [userCount], [nodeCount], [eggCount], [locationCount]] = await Promise.all([
      db.select({
        total: count(),
        installed: sql<number>`cast(sum(case when ${servers.installed} then 1 else 0 end) as int)`,
        suspended: sql<number>`cast(sum(case when ${servers.suspended} then 1 else 0 end) as int)`,
      }).from(servers),
      db.select({ total: count() }).from(users),
      db.select({ total: count() }).from(nodes),
      db.select({ total: count() }).from(eggs),
      db.select({ total: count() }).from(locations),
    ])
    return {
      servers: { total: serverStats.total, installed: serverStats.installed, suspended: serverStats.suspended },
      users: userCount.total,
      nodes: nodeCount.total,
      eggs: eggCount.total,
      locations: locationCount.total,
    }
  })

  // ── Admin routes ────────────────────────────────────────────────────────────
  app.get('/api/admin/servers', { preHandler: requireAdmin }, async () => listServers())

  app.post('/api/admin/servers', { preHandler: requireAdmin }, async (req, reply) => {
    const body = createServerSchema.parse(req.body)

    // Verify allocation not already in use
    const [existing] = await db.select().from(servers).where(eq(servers.allocationId, body.allocationId))
    if (existing) return reply.code(409).send({ error: 'Cette allocation est déjà utilisée' })

    const server = await createServer(body)

    // Push to Wings fire-and-forget — DB record is the source of truth
    setImmediate(async () => {
      try {
        const [node] = await db.select().from(nodes).where(eq(nodes.id, body.nodeId))
        if (node) {
          const payload = await buildWingsServerPayload(server.id)
          if (payload) {
            const res = await sendToWings(node, '/api/servers', 'POST', payload)
            if (!res.ok) {
              app.log.warn({ status: res.status, serverId: server.id }, 'Wings rejected server creation')
            } else {
              app.log.info({ serverId: server.id }, 'Server pushed to Wings')
            }
          }
        }
      } catch (err) {
        app.log.warn({ err }, 'Wings offline during server creation — server will sync on next Wings startup')
      }
    })

    return reply.code(201).send(server)
  })

  app.get('/api/admin/servers/:id', { preHandler: requireAdmin }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const server = await getServer(id)
    if (!server) return reply.code(404).send({ error: 'Serveur introuvable' })
    return server
  })

  app.patch('/api/admin/servers/:id', { preHandler: requireAdmin }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const body = updateServerSchema.parse(req.body)
    const server = await updateServer(id, body)
    if (!server) return reply.code(404).send({ error: 'Serveur introuvable' })
    return server
  })

  app.delete('/api/admin/servers/:id', { preHandler: requireAdmin }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const server = await getServer(id)
    if (!server) return reply.code(404).send({ error: 'Serveur introuvable' })

    // Remove from Wings first
    try {
      const [node] = await db.select().from(nodes).where(eq(nodes.id, server.nodeId))
      if (node) {
        await sendToWings(node, `/api/servers/${server.id}`, 'DELETE')
      }
    } catch { /* Wings offline */ }

    await deleteServer(id)
    return reply.code(204).send()
  })

  app.post('/api/admin/servers/:id/power', { preHandler: requireAdmin }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const { action } = req.body as { action: string }
    const server = await getServer(id)
    if (!server) return reply.code(404).send({ error: 'Serveur introuvable' })

    try {
      const [node] = await db.select().from(nodes).where(eq(nodes.id, server.nodeId))
      if (node) {
        await sendToWings(node, `/api/servers/${server.id}/power`, 'POST', { action })
      }
    } catch { /* Wings offline */ }

    return reply.code(204).send()
  })

  app.get('/api/admin/servers/:id/variables', { preHandler: requireAdmin }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const vars = await getServerVariables(id)
    return vars
  })

  app.patch('/api/admin/servers/:id/variables/:varId', { preHandler: requireAdmin }, async (req, reply) => {
    const { varId } = req.params as { id: string; varId: string }
    const { value } = req.body as { value: string }
    await db.update(serverVariables).set({ value }).where(eq(serverVariables.id, varId))
    return reply.code(204).send()
  })

  // Re-push server configuration to Wings without triggering reinstall
  app.post('/api/admin/servers/:id/sync', { preHandler: requireAdmin }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const server = await getServer(id)
    if (!server) return reply.code(404).send({ error: 'Serveur introuvable' })

    const [node] = await db.select().from(nodes).where(eq(nodes.id, server.nodeId))
    if (!node) return reply.code(404).send({ error: 'Node introuvable' })

    const payload = await buildWingsServerPayload(id)
    if (!payload) return reply.code(500).send({ error: 'Impossible de construire le payload Wings' })

    // Check if Wings already knows the server (GET returns 200 = registered).
    // If yes: Wings already syncs config on each start — no action needed.
    // If no (404): POST to register + install.
    const check = await sendToWings(node, `/api/servers/${id}`, 'GET').catch(() => null)
    if (!check) return reply.code(502).send({ error: 'Impossible de joindre Wings' })

    if (check.status === 404) {
      const res = await sendToWings(node, '/api/servers', 'POST', payload).catch(() => null)
      if (!res) return reply.code(502).send({ error: 'Impossible de joindre Wings' })
      app.log.info({ serverId: id, status: res.status }, 'Server registered on Wings (was unknown)')
    } else {
      app.log.info({ serverId: id }, 'Server already known to Wings — config will sync on next start')
    }

    return reply.code(204).send()
  })

  app.post('/api/admin/servers/:id/reinstall', { preHandler: requireAdmin }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const server = await getServer(id)
    if (!server) return reply.code(404).send({ error: 'Serveur introuvable' })

    await db.update(servers).set({ installed: false, updatedAt: new Date() }).where(eq(servers.id, id))

    try {
      const [node] = await db.select().from(nodes).where(eq(nodes.id, server.nodeId))
      if (node) {
        await sendToWings(node, `/api/servers/${server.id}/reinstall`, 'POST')
      }
    } catch { /* Wings offline */ }

    return reply.code(204).send()
  })

  // ── Client routes ───────────────────────────────────────────────────────────
  app.get('/api/client/servers', { preHandler: requireAuth }, async (req) => {
    return listServers(req.session!.userId)
  })

  app.get('/api/client/servers/:id', { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const server = await getServer(id)
    if (!server || server.userId !== req.session!.userId) return reply.code(404).send({ error: 'Serveur introuvable' })
    return server
  })

  app.post('/api/client/servers/:id/power', { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const { action } = req.body as { action: string }
    const server = await getServer(id)
    if (!server || server.userId !== req.session!.userId) return reply.code(404).send({ error: 'Serveur introuvable' })
    if (server.suspended) return reply.code(403).send({ error: 'Serveur suspendu' })

    try {
      const [node] = await db.select().from(nodes).where(eq(nodes.id, server.nodeId))
      if (node) {
        await sendToWings(node, `/api/servers/${server.id}/power`, 'POST', { action })
      }
    } catch { /* Wings offline */ }

    return reply.code(204).send()
  })

  // ── Client startup / variables ──────────────────────────────────────────────
  app.get('/api/client/servers/:id/startup', { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const server = await getServer(id)
    if (!server || server.userId !== req.session!.userId) return reply.code(404).send({ error: 'Serveur introuvable' })

    const allVars = await getServerVariables(id)
    const vars = allVars.filter(v => v.userViewable)

    // Substitute variable values into startup command for display
    let startupPreview = server.startupCommand
    for (const v of allVars) {
      if (v.envVariable) {
        startupPreview = startupPreview.replace(
          new RegExp(`\\{\\{${v.envVariable}\\}\\}`, 'g'),
          v.value || v.defaultValue || '',
        )
      }
    }

    // Fetch available docker images from the egg
    const [egg] = await db.select({ dockerImages: eggs.dockerImages })
      .from(eggs).where(eq(eggs.id, server.eggId))

    return {
      startupCommand: server.startupCommand,
      startupPreview,
      dockerImage: server.dockerImage,
      dockerImages: egg?.dockerImages ?? {},
      variables: vars,
    }
  })

  app.patch('/api/client/servers/:id/docker-image', { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const { dockerImage } = req.body as { dockerImage: string }

    const server = await getServer(id)
    if (!server || server.userId !== req.session!.userId) return reply.code(404).send({ error: 'Serveur introuvable' })

    // Validate that the image is in the egg's allowed list
    const [egg] = await db.select({ dockerImages: eggs.dockerImages })
      .from(eggs).where(eq(eggs.id, server.eggId))
    const allowed = Object.values(egg?.dockerImages ?? {})
    if (allowed.length > 0 && !allowed.includes(dockerImage)) {
      return reply.code(400).send({ error: 'Image Docker non autorisée pour cet egg' })
    }

    await db.update(servers).set({ dockerImage, updatedAt: new Date() }).where(eq(servers.id, id))
    return reply.code(204).send()
  })

  app.patch('/api/client/servers/:id/variables/:varId', { preHandler: requireAuth }, async (req, reply) => {
    const { id, varId } = req.params as { id: string; varId: string }
    const { value } = req.body as { value: string }

    const server = await getServer(id)
    if (!server || server.userId !== req.session!.userId) return reply.code(404).send({ error: 'Serveur introuvable' })

    // Ensure the variable belongs to this server and is user-editable
    const allVars = await getServerVariables(id)
    const variable = allVars.find(v => v.id === varId)
    if (!variable) return reply.code(404).send({ error: 'Variable introuvable' })
    if (!variable.userEditable) return reply.code(403).send({ error: 'Variable non modifiable' })

    await db.update(serverVariables).set({ value }).where(eq(serverVariables.id, varId))
    return reply.code(204).send()
  })

  // WebSocket proxy: browser → panel → Wings (avoids CORS/mixed-content issues)
  app.get('/api/client/servers/:id/ws', { websocket: true }, (connection, req) => {
    const socket = connection.socket

    function closeSocket(code: number, reason?: string) {
      try {
        if (socket.readyState === WsClient.OPEN || socket.readyState === WsClient.CONNECTING) {
          socket.close(code, reason)
        }
      } catch { socket.terminate() }
    }

    if (!req.session) { closeSocket(4001, 'Unauthorized'); return }

    const { id } = req.params as { id: string }
    const userId = req.session.userId

    Promise.resolve().then(async () => {
      const server = await getServer(id)
      if (!server || server.userId !== userId) { closeSocket(4003, 'Forbidden'); return }

      const [node] = await db.select().from(nodes).where(eq(nodes.id, server.nodeId))
      if (!node) { closeSocket(4004, 'Node not found'); return }

      const makeToken = () => createWingsJwt(server.id, userId, node.daemonToken, node.panelUrl)
      const wingsScheme = node.scheme === 'https' ? 'wss' : 'ws'

      // Include JWT in URL query param — required by Wings ≥ 1.7 which validates the
      // token at upgrade time rather than waiting for the event-based auth flow.
      // We also send it via the auth event for older Wings compatibility.
      const initialToken = makeToken()
      const wingsUrl = `${wingsScheme}://${node.fqdn}:${node.daemonPort}/api/servers/${server.id}/ws?token=${encodeURIComponent(initialToken)}`

      app.log.info({ wingsUrl: `${wingsScheme}://${node.fqdn}:${node.daemonPort}/api/servers/${server.id}/ws`, serverId: server.id }, 'Opening Wings WS proxy')

      // Self-signed certs are common in self-hosted Wings deployments
      const tlsAgent = node.scheme === 'https'
        ? new https.Agent({ rejectUnauthorized: false })
        : undefined

      const wings = new WsClient(wingsUrl, {
        headers: { Origin: node.panelUrl },
        agent: tlsAgent,
      })

      // Cleanup both sides together
      let closed = false
      function teardown(clientCode: number) {
        if (closed) return
        closed = true
        if (wings.readyState !== WsClient.CLOSED && wings.readyState !== WsClient.CLOSING) wings.terminate()
        closeSocket(clientCode)
      }

      wings.on('open', () => {
        app.log.info({ serverId: server.id }, 'Wings WS connected, sending auth')
        wings.send(JSON.stringify({ event: 'auth', args: [makeToken()] }))
      })

      wings.on('message', (data) => {
        const raw = data.toString()
        try {
          const msg = JSON.parse(raw)
          if (msg.event === 'token expiring') {
            wings.send(JSON.stringify({ event: 'auth', args: [makeToken()] }))
            return
          }
          if (msg.event === 'auth success') {
            app.log.info({ serverId: server.id }, 'Wings auth success')
            wings.send(JSON.stringify({ event: 'send logs', args: [] }))
            wings.send(JSON.stringify({ event: 'send stats', args: [] }))
            if (socket.readyState === WsClient.OPEN) {
              socket.send(JSON.stringify({ event: 'connected', args: [] }))
            }
            return
          }
        } catch { /* malformed frame */ }
        if (socket.readyState === WsClient.OPEN) socket.send(raw)
      })

      socket.on('message', (data: Buffer) => {
        try {
          const msg = JSON.parse(data.toString())
          if (msg.event === 'auth') return
        } catch {}
        if (wings.readyState === WsClient.OPEN) wings.send(data.toString())
      })

      socket.on('close', () => teardown(1000))

      wings.on('close', (wingsCode) => {
        app.log.info({ serverId: server.id, wingsCode }, 'Wings WS closed')
        // Map Wings close codes to meaningful client-side codes:
        // 4003 / 4009 → Wings rejected our JWT → tell client it's an auth error
        // anything else → treat as daemon unreachable
        if (wingsCode === 4003 || wingsCode === 4009) {
          teardown(4005) // 4005 = Wings auth rejected
        } else {
          teardown(1011)
        }
      })

      wings.on('error', (err) => {
        app.log.error({ err, wingsUrl }, 'Wings WS error')
        // Wings returns HTTP 404 when it has no record of this server (server was never
        // pushed to Wings, or Wings was restarted and couldn't reach the remote sync endpoint)
        if ((err as any).message?.includes('404')) {
          teardown(4404)
        } else {
          teardown(1011)
        }
      })
    }).catch((err) => {
      app.log.error({ err }, 'WS proxy setup error')
      closeSocket(1011, 'Internal error')
    })
  })
}
