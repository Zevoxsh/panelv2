import { eq } from 'drizzle-orm'
import { users, type NewUser } from '../../db/schema.js'
import { db } from '../../db/index.js'
import { hashPassword } from '../auth/auth.service.js'

const publicFields = {
  id: users.id,
  username: users.username,
  email: users.email,
  role: users.role,
  isActive: users.isActive,
  createdAt: users.createdAt,
}

export async function getAllUsers() {
  return db.select(publicFields).from(users)
}

export async function getUserById(id: string) {
  const [user] = await db.select(publicFields).from(users).where(eq(users.id, id)).limit(1)
  return user ?? null
}

export async function createUser(data: { username: string; email: string; password: string; role: 'admin' | 'user' }) {
  const passwordHash = await hashPassword(data.password)
  const [user] = await db
    .insert(users)
    .values({ username: data.username, email: data.email, passwordHash, role: data.role })
    .returning(publicFields)
  return user
}

export async function updateUser(
  id: string,
  data: { username?: string; email?: string; password?: string; role?: 'admin' | 'user'; isActive?: boolean }
) {
  const update: Partial<NewUser> = { updatedAt: new Date() }
  if (data.username !== undefined) update.username = data.username
  if (data.email !== undefined) update.email = data.email
  if (data.password !== undefined) update.passwordHash = await hashPassword(data.password)
  if (data.role !== undefined) update.role = data.role
  if (data.isActive !== undefined) update.isActive = data.isActive

  const [user] = await db.update(users).set(update).where(eq(users.id, id)).returning(publicFields)
  return user ?? null
}

export async function deleteUser(id: string) {
  await db.delete(users).where(eq(users.id, id))
}
