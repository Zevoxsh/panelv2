import Fastify from 'fastify'
import cookie from '@fastify/cookie'
import redisPlugin from './plugins/redis.js'
import authPlugin from './plugins/auth.js'
import { authRoutes } from './modules/auth/auth.routes.js'
import { usersRoutes } from './modules/users/users.routes.js'

export function buildApp() {
  const app = Fastify({ logger: process.env.NODE_ENV !== 'test' })

  app.register(cookie)
  app.register(redisPlugin)
  app.register(authPlugin)
  app.register(authRoutes)
  app.register(usersRoutes)

  app.get('/health', async () => ({ status: 'ok' }))

  return app
}
