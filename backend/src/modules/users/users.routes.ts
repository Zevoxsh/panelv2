import type { FastifyInstance } from 'fastify'
import { requireAdmin } from '../../plugins/auth.js'
import { createUserBodySchema, updateUserBodySchema } from './users.schemas.js'
import { getAllUsers, getUserById, createUser, updateUser, deleteUser } from './users.service.js'

export async function usersRoutes(app: FastifyInstance) {
  app.get('/api/admin/users', { preHandler: requireAdmin }, async () => getAllUsers())

  app.post('/api/admin/users', { preHandler: requireAdmin, schema: { body: createUserBodySchema } }, async (req, reply) => {
    const body = req.body as { username: string; email: string; password: string; role: 'admin' | 'user' }
    const user = await createUser(body)
    return reply.status(201).send(user)
  })

  app.get('/api/admin/users/:id', { preHandler: requireAdmin }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const user = await getUserById(id)
    if (!user) return reply.status(404).send({ error: 'User not found' })
    return user
  })

  app.patch('/api/admin/users/:id', { preHandler: requireAdmin, schema: { body: updateUserBodySchema } }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const body = req.body as Parameters<typeof updateUser>[1]
    const user = await updateUser(id, body)
    if (!user) return reply.status(404).send({ error: 'User not found' })
    return user
  })

  app.delete('/api/admin/users/:id', { preHandler: requireAdmin }, async (req, reply) => {
    const { id } = req.params as { id: string }
    await deleteUser(id)
    return reply.status(204).send()
  })
}
