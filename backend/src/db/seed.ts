import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import bcrypt from 'bcrypt'
import * as schema from './schema.js'

const client = postgres(process.env.DATABASE_URL!)
const db = drizzle(client, { schema })

async function seed() {
  const hash = await bcrypt.hash('admin123', 12)
  await db
    .insert(schema.users)
    .values({ username: 'admin', email: 'admin@panel.local', passwordHash: hash, role: 'admin' })
    .onConflictDoNothing()
  console.log('Seed OK — admin@panel.local / admin123')
  await client.end()
}

seed()
