import fp from 'fastify-plugin'
import type { FastifyRequest, FastifyReply } from 'fastify'
import { createHash } from 'crypto'
import { eq } from 'drizzle-orm'
import { apiKeys, users } from '../db/schema.js'
import { db } from '../db/index.js'

export interface SessionData {
  userId: string
  role: 'admin' | 'user'
}

declare module 'fastify' {
  interface FastifyRequest {
    session: SessionData | null
  }
}

export default fp(async (fastify) => {
  fastify.decorateRequest('session', null)

  fastify.addHook('preHandler', async (request: FastifyRequest) => {
    // Priorité 1 : cookie de session
    const sessionId = request.cookies['session_id']
    if (sessionId) {
      const raw = await fastify.redis.get(`session:${sessionId}`)
      if (raw) {
        try {
          request.session = JSON.parse(raw) as SessionData
          await fastify.redis.expire(`session:${sessionId}`, 86400)
        } catch {
          // malformed session — treat as no session
        }
        return
      }
    }

    // Priorité 2 : clé API Bearer
    const authHeader = request.headers['authorization']
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7)
      const hash = createHash('sha256').update(token).digest('hex')
      const [key] = await db
        .select({ id: apiKeys.id, userId: apiKeys.userId, expiresAt: apiKeys.expiresAt })
        .from(apiKeys)
        .where(eq(apiKeys.keyHash, hash))
        .limit(1)

      if (key && (!key.expiresAt || key.expiresAt > new Date())) {
        const [user] = await db
          .select({ id: users.id, role: users.role, isActive: users.isActive })
          .from(users)
          .where(eq(users.id, key.userId))
          .limit(1)

        if (user?.isActive) {
          request.session = { userId: user.id, role: user.role }
          await db.update(apiKeys).set({ lastUsedAt: new Date() }).where(eq(apiKeys.id, key.id))
        }
      }
    }
  })
})

export async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
  if (!request.session) {
    return reply.status(401).send({ error: 'Unauthorized' })
  }
}

export async function requireAdmin(request: FastifyRequest, reply: FastifyReply) {
  if (!request.session || request.session.role !== 'admin') {
    return reply.status(403).send({ error: 'Forbidden' })
  }
}
