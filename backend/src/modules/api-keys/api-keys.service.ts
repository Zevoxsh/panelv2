import { createHash, randomBytes } from 'crypto'
import { eq, and } from 'drizzle-orm'
import { apiKeys } from '../../db/schema.js'
import { db } from '../../db/index.js'

const publicKeyFields = {
  id: apiKeys.id,
  userId: apiKeys.userId,
  name: apiKeys.name,
  type: apiKeys.type,
  lastUsedAt: apiKeys.lastUsedAt,
  expiresAt: apiKeys.expiresAt,
  createdAt: apiKeys.createdAt,
}

export function generateToken(): string {
  return randomBytes(32).toString('hex')
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export async function getApiKeys(userId: string, isAdmin: boolean) {
  if (isAdmin) return db.select(publicKeyFields).from(apiKeys)
  return db.select(publicKeyFields).from(apiKeys).where(eq(apiKeys.userId, userId))
}

export async function createApiKey(
  userId: string,
  data: { name: string; type: 'admin' | 'user'; expiresAt?: string | null }
) {
  const token = generateToken()
  const keyHash = hashToken(token)

  const [key] = await db
    .insert(apiKeys)
    .values({
      userId,
      keyHash,
      name: data.name,
      type: data.type,
      expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
    })
    .returning({ id: apiKeys.id, name: apiKeys.name, type: apiKeys.type, createdAt: apiKeys.createdAt })

  return { ...key, token }
}

export async function revokeApiKey(id: string, userId: string, isAdmin: boolean) {
  const condition = isAdmin
    ? eq(apiKeys.id, id)
    : and(eq(apiKeys.id, id), eq(apiKeys.userId, userId))
  await db.delete(apiKeys).where(condition)
}
