import { describe, it, expect, vi } from 'vitest'
import { buildApp } from '../src/app.js'

vi.mock('../src/plugins/redis.js', () => ({
  default: async (fastify: any) => {
    fastify.decorate('redis', {
      get: vi.fn().mockResolvedValue(null),
      setex: vi.fn().mockResolvedValue('OK'),
      del: vi.fn().mockResolvedValue(1),
      expire: vi.fn().mockResolvedValue(1),
    })
  },
}))

vi.mock('../src/db/index.js', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
  },
}))

describe('GET /health', () => {
  it('returns ok', async () => {
    const app = buildApp()
    const response = await app.inject({ method: 'GET', url: '/health' })
    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({ status: 'ok' })
  })
})
