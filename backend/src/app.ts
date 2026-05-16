import Fastify from 'fastify'
import cookie from '@fastify/cookie'
import websocket from '@fastify/websocket'
import multipart from '@fastify/multipart'
import { ZodError } from 'zod'
import redisPlugin from './plugins/redis.js'
import authPlugin from './plugins/auth.js'
import { authRoutes } from './modules/auth/auth.routes.js'
import { usersRoutes } from './modules/users/users.routes.js'
import { apiKeysRoutes } from './modules/api-keys/api-keys.routes.js'
import { locationsRoutes } from './modules/locations/locations.routes.js'
import { nodesRoutes } from './modules/nodes/nodes.routes.js'
import { eggsRoutes } from './modules/eggs/eggs.routes.js'
import { serversRoutes } from './modules/servers/servers.routes.js'
import { serversFilesRoutes } from './modules/servers/servers.files.routes.js'
import { serversDatabasesRoutes } from './modules/servers/servers.databases.routes.js'
import { serversBackupsRoutes } from './modules/servers/servers.backups.routes.js'
import { serversSchedulesRoutes } from './modules/servers/servers.schedules.routes.js'
import { serversSubusersRoutes } from './modules/servers/servers.subusers.routes.js'
import { serversNetworkRoutes } from './modules/servers/servers.network.routes.js'
import { serversActivityRoutes } from './modules/servers/servers.activity.routes.js'
import { mountsRoutes } from './modules/mounts/mounts.routes.js'
import { remoteRoutes } from './modules/remote/remote.routes.js'

export function buildApp() {
  const app = Fastify({ logger: process.env.NODE_ENV !== 'test' })

  app.setErrorHandler((error, _req, reply) => {
    if (error instanceof ZodError) {
      const first = error.issues?.[0] ?? (error as any).errors?.[0]
      if (first) {
        const path = first.path?.join('.') ?? ''
        return reply.code(400).send({ error: path ? `${path}: ${first.message}` : first.message })
      }
    }
    app.log.error(error)
    return reply.code(error.statusCode ?? 500).send({ error: error.message ?? 'Internal Server Error' })
  })

  app.register(cookie)
  app.register(websocket)
  app.register(multipart, { limits: { fileSize: 100 * 1024 * 1024 } }) // 100 MiB
  app.register(redisPlugin)
  app.register(authPlugin)
  app.register(authRoutes)
  app.register(usersRoutes)
  app.register(apiKeysRoutes)
  app.register(locationsRoutes)
  app.register(nodesRoutes)
  app.register(eggsRoutes)
  app.register(serversRoutes)
  app.register(serversFilesRoutes)
  app.register(serversDatabasesRoutes)
  app.register(serversBackupsRoutes)
  app.register(serversSchedulesRoutes)
  app.register(serversSubusersRoutes)
  app.register(serversNetworkRoutes)
  app.register(serversActivityRoutes)
  app.register(mountsRoutes)
  app.register(remoteRoutes)

  app.get('/health', async () => ({ status: 'ok' }))

  return app
}
