import Fastify from 'fastify'
import cookie from '@fastify/cookie'

export function buildApp() {
  const app = Fastify({ logger: process.env.NODE_ENV !== 'test' })
  app.register(cookie)
  app.get('/health', async () => ({ status: 'ok' }))
  return app
}
