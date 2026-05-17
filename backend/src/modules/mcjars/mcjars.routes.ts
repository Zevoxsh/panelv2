import type { FastifyInstance } from 'fastify'
import https from 'https'
import { db } from '../../db/index.js'
import { mcjarsSettings, mcjarsTypeConfig, mcjarsInstalls, servers, nodes, eggs } from '../../db/schema.js'
import { eq, desc, sql } from 'drizzle-orm'
import { requireAuth, requireAdmin } from '../../plugins/auth.js'
import { buildWingsServerPayload, sendToWings } from '../servers/servers.service.js'

const MCJARS_BASE = 'https://versions.mcjars.app'

async function fetchMcJars<T>(path: string, orgKey?: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const url = new URL(MCJARS_BASE + path)
    const req = https.request({
      hostname: url.hostname,
      port: 443,
      path: url.pathname + url.search,
      method: 'GET',
      headers: {
        'User-Agent': 'PaxciaPanel/1.0',
        Accept: 'application/json',
        ...(orgKey ? { Authorization: orgKey } : {}),
      },
      timeout: 15_000,
    }, (res) => {
      const chunks: Buffer[] = []
      res.on('data', (c: Buffer) => chunks.push(c))
      res.on('end', () => {
        try { resolve(JSON.parse(Buffer.concat(chunks).toString())) }
        catch { reject(new Error('Invalid JSON from MCJars')) }
      })
    })
    req.on('timeout', () => req.destroy(new Error('MCJars timeout')))
    req.on('error', reject)
    req.end()
  })
}

async function ensureSettings() {
  const [row] = await db.select().from(mcjarsSettings).where(eq(mcjarsSettings.id, 1))
  if (row) return row
  const [created] = await db.insert(mcjarsSettings).values({ id: 1 }).returning()
  return created
}

export async function mcjarsRoutes(app: FastifyInstance) {

  // ── Types list (with local config merged) ────────────────────────────────────
  app.get('/api/admin/mcjars/types', { preHandler: [requireAuth, requireAdmin] }, async (_req, reply) => {
    try {
      const settings = await ensureSettings()
      const raw = await fetchMcJars<any>('/api/v2/types', settings.orgKey ?? undefined)
      const configs = await db.select().from(mcjarsTypeConfig)
      const configMap = Object.fromEntries(configs.map(c => [c.type, c]))
      const availableEggs = await db.select({ id: eggs.id, name: eggs.name }).from(eggs).orderBy(eggs.name)

      const typesMap: Record<string, any> = raw.types ?? raw ?? {}
      const types = Object.entries(typesMap).map(([key, info]: [string, any]) => ({
        type: key,
        name: info.name ?? key,
        category: configMap[key]?.category ?? info.category ?? 'Other',
        icon: `${MCJARS_BASE}/icons/${key}`,
        homepage: info.homepage ?? null,
        deprecated: info.deprecated ?? false,
        experimental: info.experimental ?? false,
        environment: info.environment ?? 'SERVER',
        hidden: configMap[key]?.hidden ?? false,
        sortOrder: configMap[key]?.sortOrder ?? 0,
        eggId: configMap[key]?.eggId ?? null,
      }))

      return { types, availableEggs }
    } catch (e: any) {
      return reply.code(502).send({ error: `MCJars API: ${e.message}` })
    }
  })

  // ── Versions for a type ───────────────────────────────────────────────────────
  app.get('/api/admin/mcjars/builds/:type', { preHandler: requireAuth }, async (req, reply) => {
    const { type } = req.params as { type: string }
    try {
      const settings = await ensureSettings()
      return await fetchMcJars<any>(`/api/v2/builds/${type.toUpperCase()}`, settings.orgKey ?? undefined)
    } catch (e: any) {
      return reply.code(502).send({ error: `MCJars API: ${e.message}` })
    }
  })

  // ── Builds for type + version ─────────────────────────────────────────────────
  app.get('/api/admin/mcjars/builds/:type/:version', { preHandler: requireAuth }, async (req, reply) => {
    const { type, version } = req.params as { type: string; version: string }
    try {
      const settings = await ensureSettings()
      return await fetchMcJars<any>(`/api/v2/builds/${type.toUpperCase()}/${version}`, settings.orgKey ?? undefined)
    } catch (e: any) {
      return reply.code(502).send({ error: `MCJars API: ${e.message}` })
    }
  })

  // ── Config get ────────────────────────────────────────────────────────────────
  app.get('/api/admin/mcjars/config', { preHandler: [requireAuth, requireAdmin] }, async () => {
    const settings = await ensureSettings()
    return { orgKey: settings.orgKey ?? '' }
  })

  // ── Config save ───────────────────────────────────────────────────────────────
  app.patch('/api/admin/mcjars/config', { preHandler: [requireAuth, requireAdmin] }, async (req) => {
    const { orgKey } = req.body as { orgKey?: string }
    await db.update(mcjarsSettings)
      .set({ orgKey: orgKey?.trim() || null, updatedAt: new Date() })
      .where(eq(mcjarsSettings.id, 1))
    return { ok: true }
  })

  // ── Per-type config save ──────────────────────────────────────────────────────
  app.patch('/api/admin/mcjars/types/:type', { preHandler: [requireAuth, requireAdmin] }, async (req) => {
    const { type } = req.params as { type: string }
    const { category, hidden, sortOrder, eggId } = req.body as {
      category?: string; hidden?: boolean; sortOrder?: number; eggId?: string | null
    }
    await db.insert(mcjarsTypeConfig)
      .values({ type: type.toUpperCase(), category: category ?? null, hidden: hidden ?? false, sortOrder: sortOrder ?? 0, eggId: eggId ?? null })
      .onConflictDoUpdate({
        target: mcjarsTypeConfig.type,
        set: { category: category ?? null, hidden, sortOrder, eggId: eggId ?? null },
      })
    return { ok: true }
  })

  // ── Stats ─────────────────────────────────────────────────────────────────────
  app.get('/api/admin/mcjars/stats', { preHandler: [requireAuth, requireAdmin] }, async () => {
    const byType = await db.select({
      type: mcjarsInstalls.type,
      count: sql<number>`count(*)::int`,
    }).from(mcjarsInstalls).groupBy(mcjarsInstalls.type).orderBy(desc(sql`count(*)`)).limit(10)

    const byVersion = await db.select({
      type: mcjarsInstalls.type,
      version: mcjarsInstalls.version,
      count: sql<number>`count(*)::int`,
    }).from(mcjarsInstalls).groupBy(mcjarsInstalls.type, mcjarsInstalls.version).orderBy(desc(sql`count(*)`)).limit(10)

    const recent = await db.select({
      id: mcjarsInstalls.id,
      type: mcjarsInstalls.type,
      version: mcjarsInstalls.version,
      build: mcjarsInstalls.build,
      serverId: mcjarsInstalls.serverId,
      installedAt: mcjarsInstalls.installedAt,
    }).from(mcjarsInstalls).orderBy(desc(mcjarsInstalls.installedAt)).limit(20)

    return { byType, byVersion, recent }
  })

  // ── Install MCJars build on a server ──────────────────────────────────────────
  app.post('/api/admin/servers/:id/mcjars/install', { preHandler: [requireAuth, requireAdmin] }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const { type, version, build, eula, wipe } = req.body as {
      type: string; version: string; build: string
      eula?: boolean; wipe?: boolean
    }

    const [server] = await db.select().from(servers).where(eq(servers.id, id))
    if (!server) return reply.code(404).send({ error: 'Server not found' })

    const [node] = await db.select().from(nodes).where(eq(nodes.id, server.nodeId))
    if (!node) return reply.code(404).send({ error: 'Node not found' })

    const downloadUrl = `${MCJARS_BASE}/api/v2/builds/${type.toUpperCase()}/${version}/${build}/download`

    const installScript = [
      '#!/bin/ash',
      'cd /mnt/server',
      ...(wipe ? [
        'echo "Wiping server files..."',
        'find . -mindepth 1 -not -name ".gitkeep" -delete',
      ] : []),
      'JAR_FILE=${SERVER_JARFILE:-server.jar}',
      `echo "Downloading ${type.toUpperCase()} ${version} build ${build} from MCJars..."`,
      `curl -sSLo "\${JAR_FILE}" "${downloadUrl}"`,
      'if [ $? -ne 0 ]; then echo "Download failed!"; exit 1; fi',
      ...(eula ? [
        'echo "eula=true" > eula.txt',
        'echo "EULA accepted."',
      ] : []),
      'echo "Done!"',
    ].join('\n')

    // Sync server to Wings with new MCJars install script, then reinstall
    const payload = await buildWingsServerPayload(id)
    if (!payload) return reply.code(500).send({ error: 'Could not build Wings payload' })

    payload.scripts = {
      install: {
        script: installScript,
        container: 'ghcr.io/pterodactyl/installers:alpine',
        entry_point: 'ash',
      },
    }
    payload.start_on_completion = false

    // Register/update server config on Wings
    await sendToWings(node, '/api/servers', 'POST', payload)

    // Trigger reinstall
    const res = await sendToWings(node, `/api/servers/${id}/reinstall`, 'POST')
    if (!res.ok) return reply.code(502).send({ error: `Wings reinstall error: ${res.status}` })

    await db.update(servers).set({ installed: false, updatedAt: new Date() }).where(eq(servers.id, id))
    await db.insert(mcjarsInstalls).values({ serverId: id, type: type.toUpperCase(), version, build })

    return { ok: true }
  })
}
