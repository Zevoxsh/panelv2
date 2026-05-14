import bcrypt from 'bcrypt'
import { eq } from 'drizzle-orm'
import { randomUUID } from 'crypto'
import { users } from '../../db/schema.js'
import { db } from '../../db/index.js'

export async function findUserByEmail(email: string) {
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1)
  return user ?? null
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash)
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, Number(process.env.BCRYPT_ROUNDS ?? 12))
}

export async function createSession(
  redis: { setex: (key: string, ttl: number, value: string) => Promise<unknown> },
  userId: string,
  role: string
): Promise<string> {
  const sessionId = randomUUID()
  await redis.setex(`session:${sessionId}`, 86400, JSON.stringify({ userId, role }))
  return sessionId
}

export async function destroySession(
  redis: { del: (key: string) => Promise<unknown> },
  sessionId: string
): Promise<void> {
  await redis.del(`session:${sessionId}`)
}
