import { describe, it, expect, vi } from 'vitest'
import { buildApp } from '../src/app.js'

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

describe('POST /api/auth/login', () => {
  it('retourne 400 si email manquant', async () => {
    const app = buildApp()
    const res = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { password: 'secret' } })
    expect(res.statusCode).toBe(400)
  })

  it('retourne 401 si utilisateur introuvable', async () => {
    const app = buildApp()
    const res = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: 'nope@x.com', password: 'secret' } })
    expect(res.statusCode).toBe(401)
  })
})

describe('POST /api/auth/logout', () => {
  it('retourne 200 même sans session', async () => {
    const app = buildApp()
    const res = await app.inject({ method: 'POST', url: '/api/auth/logout' })
    expect(res.statusCode).toBe(200)
  })
})

describe('GET /api/auth/me', () => {
  it('retourne 401 si non authentifié', async () => {
    const app = buildApp()
    const res = await app.inject({ method: 'GET', url: '/api/auth/me' })
    expect(res.statusCode).toBe(401)
  })
})
