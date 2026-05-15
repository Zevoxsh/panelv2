import http from 'http'
import https from 'https'
import { randomBytes } from 'crypto'
import { db } from '../../db/index.js'
import { nodes, locations } from '../../db/schema.js'
import { eq } from 'drizzle-orm'
import type { CreateNodeDto, UpdateNodeDto } from './nodes.schemas.js'

const nodeSelect = {
  id: nodes.id, name: nodes.name, description: nodes.description,
  fqdn: nodes.fqdn, scheme: nodes.scheme, isPublic: nodes.isPublic,
  behindProxy: nodes.behindProxy, daemonDir: nodes.daemonDir,
  memory: nodes.memory, memoryOverallocate: nodes.memoryOverallocate,
  disk: nodes.disk, diskOverallocate: nodes.diskOverallocate,
  daemonPort: nodes.daemonPort, daemonSftp: nodes.daemonSftp,
  panelUrl: nodes.panelUrl, locationId: nodes.locationId,
  tokenId: nodes.tokenId, daemonToken: nodes.daemonToken,
  locationName: locations.name, createdAt: nodes.createdAt,
}

export async function listNodes() {
  return db.select(nodeSelect).from(nodes)
    .leftJoin(locations, eq(nodes.locationId, locations.id))
    .orderBy(nodes.name)
}

export async function getNode(id: string) {
  const [node] = await db.select(nodeSelect).from(nodes)
    .leftJoin(locations, eq(nodes.locationId, locations.id))
    .where(eq(nodes.id, id))
  return node ?? null
}

export async function createNode(dto: CreateNodeDto) {
  const tokenId = randomBytes(8).toString('hex')
  const daemonToken = randomBytes(48).toString('base64url')
  const [node] = await db.insert(nodes).values({ ...dto, tokenId, daemonToken }).returning()
  return node
}

export async function updateNode(id: string, dto: UpdateNodeDto) {
  const [node] = await db.update(nodes).set({ ...dto, updatedAt: new Date() })
    .where(eq(nodes.id, id)).returning()
  return node ?? null
}

export async function resetNodeKey(id: string) {
  const tokenId = randomBytes(8).toString('hex')
  const daemonToken = randomBytes(48).toString('base64url')
  const [node] = await db.update(nodes).set({ tokenId, daemonToken, updatedAt: new Date() })
    .where(eq(nodes.id, id)).returning()
  return node ?? null
}

export async function deleteNode(id: string) {
  const [deleted] = await db.delete(nodes).where(eq(nodes.id, id)).returning()
  return deleted ?? null
}

export async function getNodeConfig(id: string): Promise<string | null> {
  const [node] = await db.select().from(nodes).where(eq(nodes.id, id))
  if (!node) return null

  const sslEnabled = node.scheme === 'https'
  const lines = [
    `debug: false`,
    `uuid: ${node.id}`,
    `token_id: ${node.tokenId}`,
    `token: ${node.daemonToken}`,
    `api:`,
    `  host: 0.0.0.0`,
    `  port: ${node.daemonPort}`,
    `  ssl:`,
    `    enabled: ${sslEnabled}`,
    ...(sslEnabled ? [
      `    cert: /etc/letsencrypt/live/${node.fqdn}/fullchain.pem`,
      `    key: /etc/letsencrypt/live/${node.fqdn}/privkey.pem`,
    ] : []),
    `  upload_limit: 1024`,
    `system:`,
    `  data: ${node.daemonDir}`,
    `  sftp:`,
    `    bind_port: ${node.daemonSftp}`,
    `allowed_mounts: []`,
    `remote: '${node.panelUrl}'`,
  ]
  return lines.join('\n')
}

async function wingsRequest(node: { scheme: string; fqdn: string; daemonPort: number; daemonToken: string }, path: string) {
  return new Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>((resolve, reject) => {
    const options = {
      hostname: node.fqdn,
      port: node.daemonPort,
      path,
      method: 'GET',
      headers: { Authorization: `Bearer ${node.daemonToken}` },
      rejectUnauthorized: false,
      timeout: 5000,
    }
    const transport = node.scheme === 'https' ? https : http
    const req = transport.request(options, (res) => {
      const chunks: Buffer[] = []
      res.on('data', (c: Buffer) => chunks.push(c))
      res.on('end', () => {
        const body = Buffer.concat(chunks).toString()
        resolve({
          ok: (res.statusCode ?? 0) < 400,
          status: res.statusCode ?? 0,
          json: () => Promise.resolve(JSON.parse(body)),
        })
      })
    })
    req.on('timeout', () => req.destroy(new Error('timeout')))
    req.on('error', reject)
    req.end()
  })
}

export async function checkNodeStatus(id: string) {
  const [node] = await db.select().from(nodes).where(eq(nodes.id, id))
  if (!node) return null
  try {
    const res = await wingsRequest(node, '/api/system')
    return { online: res.ok, statusCode: res.status }
  } catch {
    return { online: false, statusCode: null }
  }
}

export async function getNodeSystemInfo(id: string) {
  const [node] = await db.select().from(nodes).where(eq(nodes.id, id))
  if (!node) return null
  try {
    const res = await wingsRequest(node, '/api/system')
    if (!res.ok) return { online: false }
    const data = await res.json() as Record<string, unknown>
    return { online: true, ...data }
  } catch {
    return { online: false }
  }
}
