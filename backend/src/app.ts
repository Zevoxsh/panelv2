import Fastify from 'fastify'
import cookie from '@fastify/cookie'
import redisPlugin from './plugins/redis.js'
import authPlugin from './plugins/auth.js'

export function buildApp() {
  const app = Fastify({ logger: process.env.NODE_ENV !== 'test' })

  app.register(cookie)
  app.register(redisPlugin)
  app.register(authPlugin)

  app.get('/health', async () => ({ status: 'ok' }))

  return app
}
