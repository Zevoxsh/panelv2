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
    returning: vi.fn().mockResolvedValue([]),
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

describe('GET /api/admin/users', () => {
  it('retourne 403 si non admin', async () => {
    const app = buildApp()
    const res = await app.inject({ method: 'GET', url: '/api/admin/users' })
    expect(res.statusCode).toBe(403)
  })
})

describe('POST /api/admin/users', () => {
  it('retourne 400 si body invalide', async () => {
    const app = buildApp()
    const res = await app.inject({ method: 'POST', url: '/api/admin/users', payload: { email: 'bad' } })
    expect(res.statusCode).toBe(400)
  })
})

describe('DELETE /api/admin/users/:id', () => {
  it('retourne 403 si non admin', async () => {
    const app = buildApp()
    const res = await app.inject({ method: 'DELETE', url: '/api/admin/users/some-id' })
    expect(res.statusCode).toBe(403)
  })
})
