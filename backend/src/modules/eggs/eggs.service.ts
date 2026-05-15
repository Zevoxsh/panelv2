import { db } from '../../db/index.js'
import { eggs, eggVariables } from '../../db/schema.js'
import { eq } from 'drizzle-orm'
import type { CreateEggDto, UpdateEggDto, CreateVariableDto, UpdateVariableDto } from './eggs.schemas.js'

export async function listEggs() {
  return db.select().from(eggs).orderBy(eggs.name)
}

export async function getEgg(id: string) {
  const [egg] = await db.select().from(eggs).where(eq(eggs.id, id))
  return egg ?? null
}

export async function createEgg(dto: CreateEggDto) {
  const [egg] = await db.insert(eggs).values(dto).returning()
  return egg
}

export async function updateEgg(id: string, dto: UpdateEggDto) {
  const [egg] = await db.update(eggs).set({ ...dto, updatedAt: new Date() })
    .where(eq(eggs.id, id)).returning()
  return egg ?? null
}

export async function deleteEgg(id: string) {
  const [deleted] = await db.delete(eggs).where(eq(eggs.id, id)).returning()
  return deleted ?? null
}

export async function listVariables(eggId: string) {
  return db.select().from(eggVariables).where(eq(eggVariables.eggId, eggId)).orderBy(eggVariables.name)
}

export async function createVariable(eggId: string, dto: CreateVariableDto) {
  const [v] = await db.insert(eggVariables).values({ ...dto, eggId }).returning()
  return v
}

export async function updateVariable(variableId: string, dto: UpdateVariableDto) {
  const [v] = await db.update(eggVariables).set(dto).where(eq(eggVariables.id, variableId)).returning()
  return v ?? null
}

export async function deleteVariable(variableId: string) {
  const [deleted] = await db.delete(eggVariables).where(eq(eggVariables.id, variableId)).returning()
  return deleted ?? null
}
