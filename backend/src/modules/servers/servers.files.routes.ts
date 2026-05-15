import type { FastifyInstance } from 'fastify'
import http from 'http'
import https from 'https'
import { requireAuth } from '../../plugins/auth.js'
import { getServer } from './servers.service.js'
import { db } from '../../db/index.js'
import { nodes } from '../../db/schema.js'
import { eq } from 'drizzle-orm'
import type { IncomingMessage } from 'http'

type WingsNode = { scheme: string; fqdn: string; daemonPort: number; daemonToken: string }

function wingsRaw(
  node: WingsNode,
  path: string,
  method = 'GET',
  body?: unknown,
): Promise<{ status: number; ok: boolean; text: string }> {
  return new Promise((resolve, reject) => {
    const payload = body !== undefined ? JSON.stringify(body) : undefined
    const options = {
      hostname: node.fqdn,
      port: node.daemonPort,
      path,
      method,
      headers: {
        Authorization: `Bearer ${node.daemonToken}`,
        'Content-Type': 'application/json',
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
      } as Record<string, string | number>,
      rejectUnauthorized: false,
      timeout: 15_000,
    }
    const transport = node.scheme === 'https' ? https : http
    const req = transport.request(options, (res) => {
      const chunks: Buffer[] = []
      res.on('data', (c: Buffer) => chunks.push(c))
      res.on('end', () => resolve({
        status: res.statusCode ?? 0,
        ok: (res.statusCode ?? 0) < 400,
        text: Buffer.concat(chunks).toString(),
      }))
    })
    req.on('timeout', () => req.destroy(new Error('Wings timeout')))
    req.on('error', reject)
    if (payload) req.write(payload)
    req.end()
  })
}

// Stream a Wings response directly to the Fastify reply (for file downloads)
function wingsStream(
  node: WingsNode,
  path: string,
): Promise<IncomingMessage> {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: node.fqdn,
      port: node.daemonPort,
      path,
      method: 'GET',
      headers: { Authorization: `Bearer ${node.daemonToken}` },
      rejectUnauthorized: false,
      timeout: 30_000,
    }
    const transport = node.scheme === 'https' ? https : http
    const req = transport.request(options, resolve)
    req.on('timeout', () => req.destroy(new Error('Wings timeout')))
    req.on('error', reject)
    req.end()
  })
}

async function resolveServerNode(id: string, userId: string) {
  const server = await getServer(id)
  if (!server || server.userId !== userId) return null
  const [node] = await db.select().from(nodes).where(eq(nodes.id, server.nodeId))
  if (!node) return null
  return { server, node }
}

export async function serversFilesRoutes(app: FastifyInstance) {
  // ── List directory ──────────────────────────────────────────────────────────
  app.get('/api/client/servers/:id/files/list', { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const { directory = '/' } = req.query as { directory?: string }

    const ctx = await resolveServerNode(id, req.session!.userId)
    if (!ctx) return reply.code(404).send({ error: 'Serveur introuvable' })

    const res = await wingsRaw(ctx.node, `/api/servers/${id}/files/list-directory?directory=${encodeURIComponent(directory)}`)
    if (!res.ok) return reply.code(res.status).send({ error: 'Wings error' })
    return reply.type('application/json').send(res.text)
  })

  // ── Get file contents ───────────────────────────────────────────────────────
  app.get('/api/client/servers/:id/files/contents', { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const { file } = req.query as { file: string }
    if (!file) return reply.code(400).send({ error: 'Missing file parameter' })

    const ctx = await resolveServerNode(id, req.session!.userId)
    if (!ctx) return reply.code(404).send({ error: 'Serveur introuvable' })

    const res = await wingsRaw(ctx.node, `/api/servers/${id}/files/contents?file=${encodeURIComponent(file)}`)
    if (!res.ok) return reply.code(res.status).send({ error: 'Wings error' })
    return reply.type('text/plain').send(res.text)
  })

  // ── Write file contents ─────────────────────────────────────────────────────
  app.post('/api/client/servers/:id/files/write', { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const { file } = req.query as { file: string }
    if (!file) return reply.code(400).send({ error: 'Missing file parameter' })

    const ctx = await resolveServerNode(id, req.session!.userId)
    if (!ctx) return reply.code(404).send({ error: 'Serveur introuvable' })

    // Forward raw body text directly to Wings
    const body = req.body as string
    const payload = typeof body === 'string' ? body : JSON.stringify(body)

    await new Promise<void>((resolve, reject) => {
      const buf = Buffer.from(payload)
      const options = {
        hostname: ctx.node.fqdn,
        port: ctx.node.daemonPort,
        path: `/api/servers/${id}/files/write?file=${encodeURIComponent(file)}`,
        method: 'POST',
        headers: {
          Authorization: `Bearer ${ctx.node.daemonToken}`,
          'Content-Type': 'text/plain',
          'Content-Length': buf.byteLength,
        } as Record<string, string | number>,
        rejectUnauthorized: false,
        timeout: 15_000,
      }
      const transport = ctx.node.scheme === 'https' ? https : http
      const wReq = transport.request(options, (res) => {
        res.resume()
        if ((res.statusCode ?? 0) >= 400) reject(new Error(`Wings ${res.statusCode}`))
        else resolve()
      })
      wReq.on('timeout', () => wReq.destroy(new Error('timeout')))
      wReq.on('error', reject)
      wReq.write(buf)
      wReq.end()
    })

    return reply.code(204).send()
  })

  // ── Rename ──────────────────────────────────────────────────────────────────
  app.put('/api/client/servers/:id/files/rename', { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const { root, files } = req.body as { root: string; files: { from: string; to: string }[] }

    const ctx = await resolveServerNode(id, req.session!.userId)
    if (!ctx) return reply.code(404).send({ error: 'Serveur introuvable' })

    const res = await wingsRaw(ctx.node, `/api/servers/${id}/files/rename`, 'PUT', { root, files })
    if (!res.ok) return reply.code(res.status).send({ error: 'Wings error' })
    return reply.code(204).send()
  })

  // ── Delete ──────────────────────────────────────────────────────────────────
  app.post('/api/client/servers/:id/files/delete', { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const { root, files } = req.body as { root: string; files: string[] }

    const ctx = await resolveServerNode(id, req.session!.userId)
    if (!ctx) return reply.code(404).send({ error: 'Serveur introuvable' })

    const res = await wingsRaw(ctx.node, `/api/servers/${id}/files/delete`, 'POST', { root, files })
    if (!res.ok) return reply.code(res.status).send({ error: 'Wings error' })
    return reply.code(204).send()
  })

  // ── Create directory ────────────────────────────────────────────────────────
  app.post('/api/client/servers/:id/files/mkdir', { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const { root, name } = req.body as { root: string; name: string }

    const ctx = await resolveServerNode(id, req.session!.userId)
    if (!ctx) return reply.code(404).send({ error: 'Serveur introuvable' })

    const res = await wingsRaw(ctx.node, `/api/servers/${id}/files/create-directory`, 'POST', { root, name })
    if (!res.ok) return reply.code(res.status).send({ error: 'Wings error' })
    return reply.code(204).send()
  })

  // ── Download file (stream proxy) ────────────────────────────────────────────
  app.get('/api/client/servers/:id/files/download', { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const { file } = req.query as { file: string }
    if (!file) return reply.code(400).send({ error: 'Missing file parameter' })

    const ctx = await resolveServerNode(id, req.session!.userId)
    if (!ctx) return reply.code(404).send({ error: 'Serveur introuvable' })

    const wRes = await wingsStream(ctx.node, `/api/servers/${id}/files/contents?file=${encodeURIComponent(file)}`)
    if ((wRes.statusCode ?? 0) >= 400) return reply.code(wRes.statusCode ?? 500).send({ error: 'Wings error' })

    const filename = file.split('/').pop() ?? 'download'
    reply.header('Content-Disposition', `attachment; filename="${filename}"`)
    reply.header('Content-Type', wRes.headers['content-type'] ?? 'application/octet-stream')
    return reply.send(wRes)
  })

  // ── Upload file(s) ──────────────────────────────────────────────────────────
  app.post('/api/client/servers/:id/files/upload', { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const { directory = '/' } = req.query as { directory?: string }

    const ctx = await resolveServerNode(id, req.session!.userId)
    if (!ctx) return reply.code(404).send({ error: 'Serveur introuvable' })

    // Receive files from multipart upload and forward each to Wings
    const parts = (req as any).parts()
    const uploads: Promise<void>[] = []

    for await (const part of parts) {
      if (part.type !== 'file') continue
      const filename = part.filename
      const dir = directory.endsWith('/') ? directory : directory + '/'
      const filePath = `${dir}${filename}`

      const chunks: Buffer[] = []
      for await (const chunk of part.file) chunks.push(chunk)
      const fileBuffer = Buffer.concat(chunks)

      uploads.push(new Promise<void>((resolve, reject) => {
        const options = {
          hostname: ctx.node.fqdn,
          port: ctx.node.daemonPort,
          path: `/api/servers/${id}/files/write?file=${encodeURIComponent(filePath)}`,
          method: 'POST',
          headers: {
            Authorization: `Bearer ${ctx.node.daemonToken}`,
            'Content-Type': 'application/octet-stream',
            'Content-Length': fileBuffer.byteLength,
          } as Record<string, string | number>,
          rejectUnauthorized: false,
          timeout: 60_000,
        }
        const transport = ctx.node.scheme === 'https' ? https : http
        const wReq = transport.request(options, (res) => {
          res.resume()
          if ((res.statusCode ?? 0) >= 400) reject(new Error(`Wings ${res.statusCode}`))
          else resolve()
        })
        wReq.on('timeout', () => wReq.destroy(new Error('timeout')))
        wReq.on('error', reject)
        wReq.write(fileBuffer)
        wReq.end()
      }))
    }

    await Promise.all(uploads)
    return reply.code(204).send()
  })

  // ── SFTP credentials (for external SFTP clients) ────────────────────────────
  app.get('/api/client/servers/:id/sftp', { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const ctx = await resolveServerNode(id, req.session!.userId)
    if (!ctx) return reply.code(404).send({ error: 'Serveur introuvable' })

    return {
      host: ctx.node.fqdn,
      port: (ctx.node as any).daemonSftp,
      username: `${req.session!.userId}.${id}`,
      // User must use their panel password
    }
  })
}
