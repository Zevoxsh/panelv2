import type { FastifyInstance } from 'fastify'
import http from 'http'
import https from 'https'
import { requireAuth } from '../../plugins/auth.js'
import { getServer } from './servers.service.js'
import { db } from '../../db/index.js'
import { nodes } from '../../db/schema.js'
import { eq } from 'drizzle-orm'

type WingsNode = { scheme: string; fqdn: string; daemonPort: number; daemonToken: string }

async function resolveCtx(id: string, userId: string) {
  const server = await getServer(id)
  if (!server || server.userId !== userId) return null
  const [node] = await db.select().from(nodes).where(eq(nodes.id, server.nodeId))
  if (!node) return null
  return { server, node }
}

// Download a URL to a Buffer, following redirects
async function downloadBuffer(url: string, maxRedirects = 5): Promise<Buffer> {
  for (let i = 0; i <= maxRedirects; i++) {
    const parsed = new URL(url)
    const transport = parsed.protocol === 'https:' ? https : http
    const buffer = await new Promise<Buffer | string>((resolve, reject) => {
      const req = transport.request({
        hostname: parsed.hostname,
        port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
        path: parsed.pathname + parsed.search,
        method: 'GET',
        headers: { 'User-Agent': 'PaxciaPanel/1.0' },
        rejectUnauthorized: false,
        timeout: 30_000,
      }, (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          resolve(res.headers.location)
          res.resume()
          return
        }
        const chunks: Buffer[] = []
        res.on('data', (c: Buffer) => chunks.push(c))
        res.on('end', () => resolve(Buffer.concat(chunks)))
      })
      req.on('timeout', () => req.destroy(new Error('Download timeout')))
      req.on('error', reject)
      req.end()
    })
    if (typeof buffer === 'string') {
      url = buffer.startsWith('http') ? buffer : new URL(buffer, url).href
    } else {
      return buffer
    }
  }
  throw new Error('Too many redirects')
}

// Write a binary buffer to a Wings server file
function writeBinaryToWings(node: WingsNode, serverId: string, filePath: string, data: Buffer): Promise<void> {
  return new Promise((resolve, reject) => {
    const transport = node.scheme === 'https' ? https : http
    const req = transport.request({
      hostname: node.fqdn,
      port: node.daemonPort,
      path: `/api/servers/${serverId}/files/write?file=${encodeURIComponent(filePath)}`,
      method: 'POST',
      headers: {
        Authorization: `Bearer ${node.daemonToken}`,
        'Content-Type': 'application/octet-stream',
        'Content-Length': data.byteLength,
      } as Record<string, string | number>,
      rejectUnauthorized: false,
      timeout: 120_000,
    }, (res) => {
      res.resume()
      if ((res.statusCode ?? 0) >= 400) reject(new Error(`Wings ${res.statusCode}`))
      else resolve()
    })
    req.on('timeout', () => req.destroy(new Error('Wings timeout')))
    req.on('error', reject)
    req.write(data)
    req.end()
  })
}

// Simple external JSON fetch using native https
async function fetchJson<T = unknown>(url: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url)
    const transport = parsed.protocol === 'https:' ? https : http
    const req = transport.request({
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method: 'GET',
      headers: {
        'User-Agent': 'PaxciaPanel/1.0',
        Accept: 'application/json',
      },
      rejectUnauthorized: false,
      timeout: 10_000,
    }, (res) => {
      const chunks: Buffer[] = []
      res.on('data', (c: Buffer) => chunks.push(c))
      res.on('end', () => {
        try { resolve(JSON.parse(Buffer.concat(chunks).toString())) }
        catch (e) { reject(e) }
      })
    })
    req.on('timeout', () => req.destroy(new Error('Fetch timeout')))
    req.on('error', reject)
    req.end()
  })
}

interface PluginResult {
  id: string
  name: string
  description: string
  downloads: number
  version: string
  author: string
  iconUrl: string
  source: 'spiget' | 'modrinth'
}

export async function serversPluginsRoutes(app: FastifyInstance) {

  // ── Search ──────────────────────────────────────────────────────────────────
  app.get('/api/client/servers/:id/plugins/search', { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const { q = '', source = 'modrinth', type = 'plugin' } = req.query as {
      q?: string; source?: string; type?: string
    }
    if (!q.trim()) return reply.code(400).send({ error: 'Query required' })

    const ctx = await resolveCtx(id, req.session!.userId)
    if (!ctx) return reply.code(404).send({ error: 'Server not found' })

    try {
      if (source === 'spiget') {
        type SpigetResource = {
          id: number; name: string; tag: string; downloads: number
          version?: { id: string }; author?: { id: number; name?: string }
          icon?: { url: string; data: string }
        }
        const data = await fetchJson<SpigetResource[]>(
          `https://api.spiget.org/v2/search/resources/${encodeURIComponent(q.trim())}?field=name&size=20&sort=-downloads`,
        )
        const results: PluginResult[] = (Array.isArray(data) ? data : []).map(r => ({
          id: String(r.id),
          name: r.name,
          description: r.tag ?? '',
          downloads: r.downloads ?? 0,
          version: r.version?.id ?? '',
          author: '',
          iconUrl: r.icon?.data ? `data:image/png;base64,${r.icon.data}` : '',
          source: 'spiget',
        }))
        return results
      }

      if (source === 'modrinth') {
        const facet = type === 'mod' ? 'mod' : 'plugin'
        type ModrinthHit = {
          project_id: string; title: string; description: string; downloads: number
          versions: string[]; author: string; icon_url: string
        }
        type ModrinthSearch = { hits: ModrinthHit[] }
        const data = await fetchJson<ModrinthSearch>(
          `https://api.modrinth.com/v2/search?query=${encodeURIComponent(q.trim())}&facets=${encodeURIComponent(`[["project_type:${facet}"]]`)}&limit=20`,
        )
        const results: PluginResult[] = (data.hits ?? []).map(h => ({
          id: h.project_id,
          name: h.title,
          description: h.description ?? '',
          downloads: h.downloads ?? 0,
          version: h.versions?.[0] ?? '',
          author: h.author ?? '',
          iconUrl: h.icon_url ?? '',
          source: 'modrinth',
        }))
        return results
      }

      return reply.code(400).send({ error: 'Unknown source' })
    } catch (e: any) {
      return reply.code(502).send({ error: `External API error: ${e.message}` })
    }
  })

  // ── Install ──────────────────────────────────────────────────────────────────
  app.post('/api/client/servers/:id/plugins/install', { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const body = req.body as {
      source: 'spiget' | 'modrinth'
      resourceId?: string
      projectId?: string
      loader?: string
      folder: 'plugins' | 'mods'
    }

    const ctx = await resolveCtx(id, req.session!.userId)
    if (!ctx) return reply.code(404).send({ error: 'Server not found' })

    try {
      let downloadUrl: string
      let fileName: string

      if (body.source === 'spiget') {
        if (!body.resourceId) return reply.code(400).send({ error: 'resourceId required' })
        downloadUrl = `https://api.spiget.org/v2/resources/${body.resourceId}/download`
        fileName = `spiget-${body.resourceId}.jar`

        // Try to get the actual filename from resource info
        try {
          const info = await fetchJson<{ name: string }>(
            `https://api.spiget.org/v2/resources/${body.resourceId}`,
          )
          if (info?.name) fileName = `${info.name.replace(/[^a-zA-Z0-9._-]/g, '_')}.jar`
        } catch {}

      } else if (body.source === 'modrinth') {
        if (!body.projectId) return reply.code(400).send({ error: 'projectId required' })

        const loaderParam = body.loader ? `&loaders=${encodeURIComponent(JSON.stringify([body.loader]))}` : ''
        type MrVersion = { files: { url: string; filename: string; primary: boolean }[] }
        const versions = await fetchJson<MrVersion[]>(
          `https://api.modrinth.com/v2/project/${body.projectId}/version?limit=5${loaderParam}`,
        )
        const latest = Array.isArray(versions) ? versions[0] : null
        if (!latest?.files?.length) return reply.code(404).send({ error: 'No downloadable version found' })
        const file = latest.files.find(f => f.primary) ?? latest.files[0]
        downloadUrl = file.url
        fileName = file.filename

      } else {
        return reply.code(400).send({ error: 'Unknown source' })
      }

      const fileData = await downloadBuffer(downloadUrl)
      const targetPath = `/${body.folder}/${fileName}`
      await writeBinaryToWings(ctx.node, id, targetPath, fileData)

      return { ok: true, fileName, path: targetPath }
    } catch (e: any) {
      return reply.code(502).send({ error: e.message })
    }
  })
}
