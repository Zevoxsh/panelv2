import { db } from '../../db/index.js'
import { locations } from '../../db/schema.js'
import { eq } from 'drizzle-orm'
import type { CreateLocationDto } from './locations.schemas.js'

export async function listLocations() {
  return db.select().from(locations).orderBy(locations.name)
}

export async function createLocation(dto: CreateLocationDto) {
  const [location] = await db.insert(locations).values(dto).returning()
  return location
}

export async function deleteLocation(id: string) {
  const [deleted] = await db.delete(locations).where(eq(locations.id, id)).returning()
  return deleted ?? null
}
