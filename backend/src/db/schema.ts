import { pgTable, uuid, varchar, boolean, timestamp, pgEnum, integer, text, unique, jsonb } from 'drizzle-orm/pg-core'

export const roleEnum = pgEnum('role', ['admin', 'user'])
export const keyTypeEnum = pgEnum('key_type', ['admin', 'user'])

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  username: varchar('username', { length: 255 }).unique().notNull(),
  email: varchar('email', { length: 255 }).unique().notNull(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  role: roleEnum('role').notNull().default('user'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const apiKeys = pgTable('api_keys', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  keyHash: varchar('key_hash', { length: 255 }).unique().notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  type: keyTypeEnum('type').notNull(),
  lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const nodeSchemeEnum = pgEnum('node_scheme', ['https', 'http'])

export const locations = pgTable('locations', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).unique().notNull(),
  description: varchar('description', { length: 500 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const nodes = pgTable('nodes', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).unique().notNull(),
  description: varchar('description', { length: 500 }),
  locationId: uuid('location_id').notNull().references(() => locations.id),
  fqdn: varchar('fqdn', { length: 255 }).notNull(),
  scheme: nodeSchemeEnum('scheme').notNull().default('https'),
  behindProxy: boolean('behind_proxy').notNull().default(false),
  isPublic: boolean('is_public').notNull().default(true),
  daemonDir: varchar('daemon_dir', { length: 500 }).notNull().default('/var/lib/pterodactyl/volumes'),
  memory: integer('memory').notNull(),
  memoryOverallocate: integer('memory_overallocate').notNull().default(0),
  disk: integer('disk').notNull(),
  diskOverallocate: integer('disk_overallocate').notNull().default(0),
  daemonPort: integer('daemon_port').notNull().default(8080),
  daemonSftp: integer('daemon_sftp').notNull().default(2022),
  panelUrl: varchar('panel_url', { length: 255 }).notNull(),
  tokenId: varchar('token_id', { length: 32 }).notNull(),
  daemonToken: varchar('daemon_token', { length: 255 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const allocations = pgTable('allocations', {
  id: uuid('id').primaryKey().defaultRandom(),
  nodeId: uuid('node_id').notNull().references(() => nodes.id, { onDelete: 'cascade' }),
  ip: varchar('ip', { length: 45 }).notNull(),
  ipAlias: varchar('ip_alias', { length: 255 }),
  port: integer('port').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const eggs = pgTable('eggs', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 100 }).notNull(),
  description: varchar('description', { length: 500 }),
  dockerImage: varchar('docker_image', { length: 255 }).notNull(),
  // JSON map of { "Label": "image:tag" } — all available images for this egg
  dockerImages: jsonb('docker_images').$type<Record<string, string>>().notNull().default({}),
  startupCommand: text('startup_command').notNull(),
  stopCommand: varchar('stop_command', { length: 100 }).notNull().default('^C'),
  startupDoneString: varchar('startup_done_string', { length: 255 }).notNull().default(']'),
  installScript: text('install_script').notNull().default(''),
  installContainer: varchar('install_container', { length: 255 }).notNull().default(''),
  installEntrypoint: varchar('install_entrypoint', { length: 100 }).notNull().default('ash'),
  configFiles: text('config_files').notNull().default(''),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const eggVariables = pgTable('egg_variables', {
  id: uuid('id').primaryKey().defaultRandom(),
  eggId: uuid('egg_id').notNull().references(() => eggs.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 100 }).notNull(),
  description: varchar('description', { length: 500 }),
  envVariable: varchar('env_variable', { length: 100 }).notNull(),
  defaultValue: varchar('default_value', { length: 255 }).notNull().default(''),
  userViewable: boolean('user_viewable').notNull().default(true),
  userEditable: boolean('user_editable').notNull().default(true),
  rules: varchar('rules', { length: 255 }).notNull().default(''),
})

export const servers = pgTable('servers', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 100 }).notNull(),
  description: varchar('description', { length: 500 }),
  userId: uuid('user_id').notNull().references(() => users.id),
  nodeId: uuid('node_id').notNull().references(() => nodes.id),
  allocationId: uuid('allocation_id').notNull().references(() => allocations.id),
  eggId: uuid('egg_id').notNull().references(() => eggs.id),
  dockerImage: varchar('docker_image', { length: 255 }).notNull(),
  startupCommand: text('startup_command').notNull(),
  memory: integer('memory').notNull(),
  disk: integer('disk').notNull(),
  cpu: integer('cpu').notNull().default(0),
  installed: boolean('installed').notNull().default(false),
  suspended: boolean('suspended').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [unique().on(t.allocationId)])

export const serverVariables = pgTable('server_variables', {
  id: uuid('id').primaryKey().defaultRandom(),
  serverId: uuid('server_id').notNull().references(() => servers.id, { onDelete: 'cascade' }),
  variableId: uuid('variable_id').notNull().references(() => eggVariables.id, { onDelete: 'cascade' }),
  value: varchar('value', { length: 255 }).notNull().default(''),
})

export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
export type ApiKey = typeof apiKeys.$inferSelect
export type NewApiKey = typeof apiKeys.$inferInsert
export type Location = typeof locations.$inferSelect
export type NewLocation = typeof locations.$inferInsert
export type Node = typeof nodes.$inferSelect
export type NewNode = typeof nodes.$inferInsert
export type Egg = typeof eggs.$inferSelect
export type Server = typeof servers.$inferSelect
