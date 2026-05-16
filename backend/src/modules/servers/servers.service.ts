import http from 'http'
import https from 'https'
import { db } from '../../db/index.js'
import { servers, serverVariables, eggVariables, allocations, nodes, eggs, users } from '../../db/schema.js'
import { eq, and, inArray } from 'drizzle-orm'
import type { CreateServerDto, UpdateServerDto } from './servers.schemas.js'

const serverSelect = {
  id: servers.id, name: servers.name, description: servers.description,
  userId: servers.userId, nodeId: servers.nodeId, allocationId: servers.allocationId,
  eggId: servers.eggId, dockerImage: servers.dockerImage, startupCommand: servers.startupCommand,
  memory: servers.memory, disk: servers.disk, cpu: servers.cpu,
  installed: servers.installed, suspended: servers.suspended,
  createdAt: servers.createdAt, updatedAt: servers.updatedAt,
  userName: users.username, userEmail: users.email,
  nodeId2: nodes.id, nodeName: nodes.name, nodeFqdn: nodes.fqdn,
  allocationIp: allocations.ip, allocationIpAlias: allocations.ipAlias, allocationPort: allocations.port,
  eggName: eggs.name,
}

export async function listServers(userId?: string) {
  const q = db.select({
    id: servers.id, name: servers.name, description: servers.description,
    userId: servers.userId, nodeId: servers.nodeId, allocationId: servers.allocationId,
    eggId: servers.eggId, dockerImage: servers.dockerImage, startupCommand: servers.startupCommand,
    memory: servers.memory, disk: servers.disk, cpu: servers.cpu,
    installed: servers.installed, suspended: servers.suspended,
    createdAt: servers.createdAt,
    userName: users.username, userEmail: users.email,
    nodeName: nodes.name, nodeFqdn: nodes.fqdn,
    allocationIp: allocations.ip, allocationIpAlias: allocations.ipAlias, allocationPort: allocations.port,
    eggName: eggs.name,
  })
    .from(servers)
    .leftJoin(users, eq(servers.userId, users.id))
    .leftJoin(nodes, eq(servers.nodeId, nodes.id))
    .leftJoin(allocations, eq(servers.allocationId, allocations.id))
    .leftJoin(eggs, eq(servers.eggId, eggs.id))
    .orderBy(servers.name)

  if (userId) {
    return q.where(eq(servers.userId, userId))
  }
  return q
}

export async function getServer(id: string) {
  const [row] = await db.select({
    id: servers.id, name: servers.name, description: servers.description,
    userId: servers.userId, nodeId: servers.nodeId, allocationId: servers.allocationId,
    eggId: servers.eggId, dockerImage: servers.dockerImage, startupCommand: servers.startupCommand,
    memory: servers.memory, disk: servers.disk, cpu: servers.cpu,
    installed: servers.installed, suspended: servers.suspended,
    createdAt: servers.createdAt,
    userName: users.username, userEmail: users.email,
    nodeName: nodes.name, nodeFqdn: nodes.fqdn,
    nodeScheme: nodes.scheme, nodeDaemonPort: nodes.daemonPort, nodeDaemonToken: nodes.daemonToken,
    allocationIp: allocations.ip, allocationIpAlias: allocations.ipAlias, allocationPort: allocations.port,
    eggName: eggs.name, eggStopCommand: eggs.stopCommand,
  })
    .from(servers)
    .leftJoin(users, eq(servers.userId, users.id))
    .leftJoin(nodes, eq(servers.nodeId, nodes.id))
    .leftJoin(allocations, eq(servers.allocationId, allocations.id))
    .leftJoin(eggs, eq(servers.eggId, eggs.id))
    .where(eq(servers.id, id))

  return row ?? null
}

export async function getServerWithNode(id: string) {
  const [row] = await db.select()
    .from(servers)
    .leftJoin(nodes, eq(servers.nodeId, nodes.id))
    .leftJoin(allocations, eq(servers.allocationId, allocations.id))
    .where(eq(servers.id, id))

  return row ?? null
}

export async function getServerVariables(serverId: string) {
  return db.select({
    id: serverVariables.id,
    serverId: serverVariables.serverId,
    variableId: serverVariables.variableId,
    value: serverVariables.value,
    name: eggVariables.name,
    envVariable: eggVariables.envVariable,
    description: eggVariables.description,
    defaultValue: eggVariables.defaultValue,
    userViewable: eggVariables.userViewable,
    userEditable: eggVariables.userEditable,
    rules: eggVariables.rules,
  })
    .from(serverVariables)
    .leftJoin(eggVariables, eq(serverVariables.variableId, eggVariables.id))
    .where(eq(serverVariables.serverId, serverId))
}

export async function createServer(dto: CreateServerDto) {
  const { variables, ...serverData } = dto
  const egg = await db.select().from(eggs).where(eq(eggs.id, dto.eggId)).then(r => r[0])
  if (!egg) throw new Error('Egg introuvable')

  const eggVars = await db.select().from(eggVariables).where(eq(eggVariables.eggId, dto.eggId))

  const [server] = await db.insert(servers).values(serverData).returning()

  if (eggVars.length > 0) {
    const varRows = eggVars.map((v) => ({
      serverId: server.id,
      variableId: v.id,
      value: variables[v.envVariable] ?? v.defaultValue,
    }))
    await db.insert(serverVariables).values(varRows)
  }

  return server
}

export async function updateServer(id: string, dto: UpdateServerDto) {
  const [server] = await db.update(servers).set({ ...dto, updatedAt: new Date() })
    .where(eq(servers.id, id)).returning()
  return server ?? null
}

export async function markInstalled(id: string) {
  await db.update(servers).set({ installed: true, updatedAt: new Date() }).where(eq(servers.id, id))
}

export async function deleteServer(id: string) {
  const [deleted] = await db.delete(servers).where(eq(servers.id, id)).returning()
  return deleted ?? null
}

export async function buildWingsServerPayload(serverId: string) {
  const row = await getServerWithNode(serverId)
  if (!row) return null

  const { servers: server, nodes: node, allocations: alloc } = row
  if (!node || !alloc) return null

  const vars = await getServerVariables(serverId)
  const environment: Record<string, string> = {}
  for (const v of vars) {
    if (v.envVariable) environment[v.envVariable] = v.value
  }

  return {
    uuid: server.id,
    start_on_completion: false,
    settings: {
      uuid: server.id,
      meta: { name: server.name, description: server.description ?? '' },
      suspended: server.suspended,
      environment,
      invocation: server.startupCommand,
      skip_egg_scripts: false,
      build: {
        memory_limit: server.memory,
        swap: 0,
        io_weight: 500,
        cpu_limit: server.cpu,
        disk_space: server.disk,
        oom_disabled: false,
        threads: null,
      },
      container: {
        image: server.dockerImage,
        oom_disabled: false,
        requires_rebuild: false,
      },
      allocations: {
        force_outgoing_ip: false,
        default: { ip: alloc.ip, port: alloc.port },
        // mappings tells Wings which ports to publish in Docker for this server
        mappings: { [alloc.ip]: [alloc.port] },
      },
    },
  }
}

export function sendToWings(
  node: { scheme: string; fqdn: string; daemonPort: number; daemonToken: string },
  path: string,
  method: string,
  body?: unknown,
): Promise<{ status: number; ok: boolean }> {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : undefined
    const options = {
      hostname: node.fqdn,
      port: node.daemonPort,
      path,
      method,
      headers: {
        Authorization: `Bearer ${node.daemonToken}`,
        'Content-Type': 'application/json',
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
      },
      // Accept self-signed certs — common in self-hosted Wings deployments
      rejectUnauthorized: false,
      timeout: 10_000,
    }

    const transport = node.scheme === 'https' ? https : http
    const req = transport.request(options, (res) => {
      res.resume() // drain body
      resolve({ status: res.statusCode ?? 0, ok: (res.statusCode ?? 0) < 400 })
    })

    req.on('timeout', () => { req.destroy(new Error('Wings request timeout')) })
    req.on('error', reject)

    if (payload) req.write(payload)
    req.end()
  })
}
