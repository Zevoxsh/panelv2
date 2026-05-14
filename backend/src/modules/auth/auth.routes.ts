import type { FastifyInstance } from 'fastify'
import { loginBodySchema } from './auth.schemas.js'
import { findUserByEmail, verifyPassword, createSession, destroySession } from './auth.service.js'
import { requireAuth } from '../../plugins/auth.js'
import { eq } from 'drizzle-orm'
import { users } from '../../db/schema.js'
import { db } from '../../db/index.js'

export async function authRoutes(app: FastifyInstance) {
  app.post('/api/auth/login', { schema: { body: loginBodySchema } }, async (request, reply) => {
    const { email, password } = request.body as { email: string; password: string }

    const user = await findUserByEmail(email)
    if (!user || !user.isActive) return reply.status(401).send({ error: 'Invalid credentials' })

    const valid = await verifyPassword(password, user.passwordHash)
    if (!valid) return reply.status(401).send({ error: 'Invalid credentials' })

    const sessionId = await createSession(app.redis, user.id, user.role)
    reply.setCookie('session_id', sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: 86400,
    })

    return { id: user.id, username: user.username, email: user.email, role: user.role }
  })

  app.post('/api/auth/logout', async (request, reply) => {
    const sessionId = request.cookies['session_id']
    if (sessionId) await destroySession(app.redis, sessionId)
    reply.clearCookie('session_id', { path: '/' })
    return { success: true }
  })

  app.get('/api/auth/me', { preHandler: requireAuth }, async (request, reply) => {
    const [user] = await db
      .select({ id: users.id, username: users.username, email: users.email, role: users.role })
      .from(users)
      .where(eq(users.id, request.session!.userId))
      .limit(1)

    if (!user) return reply.status(404).send({ error: 'User not found' })
    return user
  })
}
