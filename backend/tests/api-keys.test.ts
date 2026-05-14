import { describe, it, expect, vi } from 'vitest'
import { buildApp } from '../src/app.js'

vi.mock('../src/db/index.js', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([{ id: 'k1', name: 'test', type: 'user', createdAt: new Date() }]),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
  },
}))

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

describe('GET /api/api-keys', () => {
  it('retourne 401 si non authentifié', async () => {
    const app = buildApp()
    const res = await app.inject({ method: 'GET', url: '/api/api-keys' })
    expect(res.statusCode).toBe(401)
  })
})

describe('POST /api/api-keys', () => {
  it('retourne 400 si body invalide', async () => {
    const app = buildApp()
    const res = await app.inject({ method: 'POST', url: '/api/api-keys', payload: {} })
    expect(res.statusCode).toBe(400)
  })
})

describe('DELETE /api/api-keys/:id', () => {
  it('retourne 401 si non authentifié', async () => {
    const app = buildApp()
    const res = await app.inject({ method: 'DELETE', url: '/api/api-keys/some-id' })
    expect(res.statusCode).toBe(401)
  })
})
