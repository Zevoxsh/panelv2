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

      if (source === 'hangar') {
        type HangarProject = {
          name: string
          namespace: { owner: string; slug: string }
          stats: { downloads: number }
          description: string
          iconUrl?: string
          lastVersion?: string
        }
        type HangarSearch = { result: HangarProject[] }
        const data = await fetchJson<HangarSearch>(
          `https://hangar.papermc.io/api/v1/projects?q=${encodeURIComponent(q.trim())}&limit=20`,
        )
        const results: PluginResult[] = (data.result ?? []).map(p => ({
          id: `${p.namespace.owner}/${p.namespace.slug}`,
          name: p.name,
          description: p.description ?? '',
          downloads: p.stats?.downloads ?? 0,
          version: p.lastVersion ?? '',
          author: p.namespace.owner,
          iconUrl: p.iconUrl ?? '',
          source: 'hangar',
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
      source: 'spiget' | 'modrinth' | 'hangar'
      resourceId?: string
      projectId?: string
      loader?: string
      gameVersion?: string
      folder: 'plugins' | 'mods'
    }

    const ctx = await resolveCtx(id, req.session!.userId)
    if (!ctx) return reply.code(404).send({ error: 'Server not found' })

    try {
      let downloadUrl: string
      let fileName: string
      let extraInfo: { versionNumber?: string; gameVersions?: string[] } = {}

      if (body.source === 'spiget') {
        if (!body.resourceId) return reply.code(400).send({ error: 'resourceId required' })

        type SpigetResource = {
          name: string
          premium: boolean
          file: { type: string; externalUrl?: string }
        }
        const info = await fetchJson<SpigetResource>(
          `https://api.spiget.org/v2/resources/${body.resourceId}`,
        )
        if (info.premium) {
          return reply.code(422).send({ error: 'Plugin premium — achetez-le sur SpigotMC puis uploadez le JAR manuellement.' })
        }

        fileName = info.name
          ? `${info.name.replace(/[^a-zA-Z0-9._-]/g, '_')}.jar`
          : `spiget-${body.resourceId}.jar`

        // If externally hosted on GitHub, resolve the actual JAR asset via GitHub API
        const extUrl = info.file?.externalUrl ?? ''
        const ghMatch = extUrl.match(/github\.com\/([^/]+)\/([^/]+)/)
        if (ghMatch) {
          const [, owner, repo] = ghMatch
          try {
            type GhRelease = { assets: { name: string; browser_download_url: string }[] }
            const release = await fetchJson<GhRelease>(
              `https://api.github.com/repos/${owner}/${repo}/releases/latest`,
            )
            const jar = release.assets?.find(a => a.name.endsWith('.jar'))
            if (jar) {
              downloadUrl = jar.browser_download_url
              fileName = jar.name
            } else {
              downloadUrl = `https://api.spiget.org/v2/resources/${body.resourceId}/download`
            }
          } catch {
            downloadUrl = `https://api.spiget.org/v2/resources/${body.resourceId}/download`
          }
        } else {
          downloadUrl = `https://api.spiget.org/v2/resources/${body.resourceId}/download`
        }

      } else if (body.source === 'modrinth') {
        if (!body.projectId) return reply.code(400).send({ error: 'projectId required' })

        type MrVersion = {
          version_number: string
          game_versions: string[]
          files: { url: string; filename: string; primary: boolean }[]
        }

        // For plugins, accept all bukkit-compatible loaders so we don't miss versions
        // tagged as 'spigot' or 'bukkit' that work perfectly on Paper.
        // For mods, keep the exact loader (fabric ≠ forge).
        const loaders = body.folder === 'plugins'
          ? ['paper', 'purpur', 'spigot', 'bukkit']
          : body.loader ? [body.loader] : []

        const loaderParam = loaders.length
          ? `&loaders=${encodeURIComponent(JSON.stringify(loaders))}`
          : ''
        const gameParam = body.gameVersion
          ? `&game_versions=${encodeURIComponent(JSON.stringify([body.gameVersion]))}`
          : ''

        let versions = await fetchJson<MrVersion[]>(
          `https://api.modrinth.com/v2/project/${body.projectId}/version?limit=10${loaderParam}${gameParam}`,
        )

        // Fallback: if game version filter returned nothing, try without it
        if (body.gameVersion && Array.isArray(versions) && versions.length === 0) {
          versions = await fetchJson<MrVersion[]>(
            `https://api.modrinth.com/v2/project/${body.projectId}/version?limit=10${loaderParam}`,
          )
        }

        const latest = Array.isArray(versions) ? versions[0] : null
        if (!latest?.files?.length) return reply.code(404).send({ error: 'No downloadable version found. The project may not support your loader.' })
        const file = latest.files.find(f => f.primary) ?? latest.files[0]
        downloadUrl = file.url
        fileName = file.filename
        extraInfo = { versionNumber: latest.version_number, gameVersions: latest.game_versions ?? [] }

      } else if (body.source === 'hangar') {
        if (!body.projectId) return reply.code(400).send({ error: 'projectId required' })
        const parts = body.projectId.split('/')
        if (parts.length !== 2) return reply.code(400).send({ error: 'Invalid Hangar project ID' })
        const [owner, slug] = parts

        type HangarVersion = {
          name: string
          downloads: {
            PAPER?: { fileInfo?: { name: string }; externalUrl?: string }
          }
        }
        type HangarVersionList = { result: HangarVersion[] }

        const vdata = await fetchJson<HangarVersionList>(
          `https://hangar.papermc.io/api/v1/projects/${encodeURIComponent(owner)}/${encodeURIComponent(slug)}/versions?limit=1&platform=PAPER`,
        )
        const latest = vdata.result?.[0]
        if (!latest) return reply.code(404).send({ error: 'Aucune version PAPER trouvée sur Hangar.' })

        const paperInfo = latest.downloads?.PAPER
        downloadUrl = `https://hangar.papermc.io/api/v1/projects/${encodeURIComponent(owner)}/${encodeURIComponent(slug)}/versions/${encodeURIComponent(latest.name)}/PAPER/download`
        fileName = paperInfo?.fileInfo?.name ?? `${slug}-${latest.name}.jar`
        extraInfo = { versionNumber: latest.name }

      } else {
        return reply.code(400).send({ error: 'Unknown source' })
      }

      const fileData = await downloadBuffer(downloadUrl)

      // Validate the downloaded file is a JAR (ZIP magic bytes: PK\x03\x04)
      if (fileData.length < 4 || fileData[0] !== 0x50 || fileData[1] !== 0x4B) {
        return reply.code(422).send({ error: 'Downloaded file is not a valid JAR. The plugin may require a direct download — upload it manually via the Files tab.' })
      }

      const targetPath = `/${body.folder}/${fileName}`
      await writeBinaryToWings(ctx.node, id, targetPath, fileData)

      return { ok: true, fileName, path: targetPath, ...extraInfo }
    } catch (e: any) {
      return reply.code(502).send({ error: e.message })
    }
  })
}
