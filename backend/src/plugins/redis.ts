import fp from 'fastify-plugin'
import fastifyRedis from '@fastify/redis'

export default fp(async (fastify) => {
  await fastify.register(fastifyRedis, {
    url: process.env.REDIS_URL ?? 'redis://localhost:6379',
  })
})
