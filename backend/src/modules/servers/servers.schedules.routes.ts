import type { FastifyInstance } from 'fastify'
import { requireAuth } from '../../plugins/auth.js'
import { db } from '../../db/index.js'
import { schedules, scheduleTasks, servers } from '../../db/schema.js'
import { eq, and, asc } from 'drizzle-orm'
import { z } from 'zod'

async function assertOwner(serverId: string, userId: string, isAdmin: boolean) {
  const [srv] = await db.select({ id: servers.id }).from(servers)
    .where(isAdmin ? eq(servers.id, serverId) : and(eq(servers.id, serverId), eq(servers.userId, userId)))
  return !!srv
}

const scheduleSchema = z.object({
  name: z.string().min(1).max(255),
  cronMinute: z.string().default('*/5'),
  cronHour: z.string().default('*'),
  cronDayOfMonth: z.string().default('*'),
  cronMonth: z.string().default('*'),
  cronDayOfWeek: z.string().default('*'),
  isActive: z.boolean().default(true),
})

const taskSchema = z.object({
  action: z.enum(['command', 'power', 'backup']),
  payload: z.string().max(255).default(''),
  timeOffset: z.number().int().min(0).default(0),
  sequence: z.number().int().min(1).default(1),
})

export async function serversSchedulesRoutes(app: FastifyInstance) {
  // List schedules with their tasks
  app.get('/api/client/servers/:id/schedules', { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const { userId, role } = req.session!
    if (!await assertOwner(id, userId, role === 'admin')) return reply.code(403).send({ error: 'Forbidden' })
    const rows = await db.select().from(schedules).where(eq(schedules.serverId, id)).orderBy(asc(schedules.createdAt))
    const tasks = await db.select().from(scheduleTasks)
      .where(eq(scheduleTasks.scheduleId, rows[0]?.id ?? '00000000-0000-0000-0000-000000000000'))
    // For each schedule, load its tasks
    const tasksBySchedule = new Map<string, typeof tasks>()
    if (rows.length > 0) {
      const allTasks = await db.select().from(scheduleTasks)
        .orderBy(asc(scheduleTasks.sequence))
      for (const t of allTasks) tasksBySchedule.set(t.scheduleId, [...(tasksBySchedule.get(t.scheduleId) ?? []), t])
    }
    return rows.map(s => ({ ...s, tasks: tasksBySchedule.get(s.id) ?? [] }))
  })

  app.post('/api/client/servers/:id/schedules', { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const { userId, role } = req.session!
    if (!await assertOwner(id, userId, role === 'admin')) return reply.code(403).send({ error: 'Forbidden' })
    const body = scheduleSchema.parse(req.body)
    const [row] = await db.insert(schedules).values({ serverId: id, ...body }).returning()
    return reply.code(201).send({ ...row, tasks: [] })
  })

  app.patch('/api/client/servers/:id/schedules/:scheduleId', { preHandler: requireAuth }, async (req, reply) => {
    const { id, scheduleId } = req.params as { id: string; scheduleId: string }
    const { userId, role } = req.session!
    if (!await assertOwner(id, userId, role === 'admin')) return reply.code(403).send({ error: 'Forbidden' })
    const body = scheduleSchema.partial().parse(req.body)
    const [row] = await db.update(schedules).set(body)
      .where(and(eq(schedules.id, scheduleId), eq(schedules.serverId, id))).returning()
    if (!row) return reply.code(404).send({ error: 'Schedule not found' })
    const tasks = await db.select().from(scheduleTasks).where(eq(scheduleTasks.scheduleId, scheduleId)).orderBy(asc(scheduleTasks.sequence))
    return { ...row, tasks }
  })

  app.delete('/api/client/servers/:id/schedules/:scheduleId', { preHandler: requireAuth }, async (req, reply) => {
    const { id, scheduleId } = req.params as { id: string; scheduleId: string }
    const { userId, role } = req.session!
    if (!await assertOwner(id, userId, role === 'admin')) return reply.code(403).send({ error: 'Forbidden' })
    await db.delete(schedules).where(and(eq(schedules.id, scheduleId), eq(schedules.serverId, id)))
    return reply.code(204).send()
  })

  // Tasks
  app.post('/api/client/servers/:id/schedules/:scheduleId/tasks', { preHandler: requireAuth }, async (req, reply) => {
    const { id, scheduleId } = req.params as { id: string; scheduleId: string }
    const { userId, role } = req.session!
    if (!await assertOwner(id, userId, role === 'admin')) return reply.code(403).send({ error: 'Forbidden' })
    const body = taskSchema.parse(req.body)
    const [row] = await db.insert(scheduleTasks).values({ scheduleId, ...body }).returning()
    return reply.code(201).send(row)
  })

  app.delete('/api/client/servers/:id/schedules/:scheduleId/tasks/:taskId', { preHandler: requireAuth }, async (req, reply) => {
    const { id, scheduleId, taskId } = req.params as { id: string; scheduleId: string; taskId: string }
    const { userId, role } = req.session!
    if (!await assertOwner(id, userId, role === 'admin')) return reply.code(403).send({ error: 'Forbidden' })
    await db.delete(scheduleTasks)
      .where(and(eq(scheduleTasks.id, taskId), eq(scheduleTasks.scheduleId, scheduleId)))
    return reply.code(204).send()
  })

  // Run a schedule now
  app.post('/api/client/servers/:id/schedules/:scheduleId/run', { preHandler: requireAuth }, async (req, reply) => {
    const { id, scheduleId } = req.params as { id: string; scheduleId: string }
    const { userId, role } = req.session!
    if (!await assertOwner(id, userId, role === 'admin')) return reply.code(403).send({ error: 'Forbidden' })
    const [sched] = await db.select().from(schedules)
      .where(and(eq(schedules.id, scheduleId), eq(schedules.serverId, id)))
    if (!sched) return reply.code(404).send({ error: 'Schedule not found' })
    await db.update(schedules).set({ lastRunAt: new Date() }).where(eq(schedules.id, scheduleId))
    return { ok: true }
  })
}
