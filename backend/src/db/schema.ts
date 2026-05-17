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

// ── Server databases ──────────────────────────────────────────────────────────
export const serverDatabases = pgTable('server_databases', {
  id:        uuid('id').primaryKey().defaultRandom(),
  serverId:  uuid('server_id').notNull().references(() => servers.id, { onDelete: 'cascade' }),
  name:      varchar('name', { length: 100 }).notNull(),
  username:  varchar('username', { length: 100 }).notNull(),
  password:  varchar('password', { length: 255 }).notNull(),
  remote:    varchar('remote', { length: 100 }).notNull().default('%'),
  host:      varchar('host', { length: 255 }).notNull().default('127.0.0.1'),
  port:      integer('port').notNull().default(3306),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// ── Backups ───────────────────────────────────────────────────────────────────
export const backups = pgTable('backups', {
  id:         uuid('id').primaryKey().defaultRandom(),
  serverId:   uuid('server_id').notNull().references(() => servers.id, { onDelete: 'cascade' }),
  name:       varchar('name', { length: 255 }).notNull(),
  bytes:      integer('bytes').notNull().default(0),
  completed:  boolean('completed').notNull().default(false),
  successful: boolean('successful').notNull().default(true),
  checksum:   varchar('checksum', { length: 255 }),
  createdAt:  timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// ── Schedules ─────────────────────────────────────────────────────────────────
export const schedules = pgTable('schedules', {
  id:              uuid('id').primaryKey().defaultRandom(),
  serverId:        uuid('server_id').notNull().references(() => servers.id, { onDelete: 'cascade' }),
  name:            varchar('name', { length: 255 }).notNull(),
  cronMinute:      varchar('cron_minute', { length: 20 }).notNull().default('*/5'),
  cronHour:        varchar('cron_hour', { length: 20 }).notNull().default('*'),
  cronDayOfMonth:  varchar('cron_day_of_month', { length: 20 }).notNull().default('*'),
  cronMonth:       varchar('cron_month', { length: 20 }).notNull().default('*'),
  cronDayOfWeek:   varchar('cron_day_of_week', { length: 20 }).notNull().default('*'),
  isActive:        boolean('is_active').notNull().default(true),
  lastRunAt:       timestamp('last_run_at', { withTimezone: true }),
  createdAt:       timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const scheduleTaskActionEnum = pgEnum('schedule_task_action', ['command', 'power', 'backup'])
export const scheduleTasks = pgTable('schedule_tasks', {
  id:          uuid('id').primaryKey().defaultRandom(),
  scheduleId:  uuid('schedule_id').notNull().references(() => schedules.id, { onDelete: 'cascade' }),
  sequence:    integer('sequence').notNull().default(1),
  action:      scheduleTaskActionEnum('action').notNull(),
  payload:     varchar('payload', { length: 255 }).notNull().default(''),
  timeOffset:  integer('time_offset').notNull().default(0),
  createdAt:   timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// ── Server sub-users ──────────────────────────────────────────────────────────
export const serverSubusers = pgTable('server_subusers', {
  id:          uuid('id').primaryKey().defaultRandom(),
  serverId:    uuid('server_id').notNull().references(() => servers.id, { onDelete: 'cascade' }),
  userId:      uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  permissions: text('permissions').array().notNull().default([]),
  createdAt:   timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [unique().on(t.serverId, t.userId)])

// ── Secondary allocations per server ─────────────────────────────────────────
export const serverAllocations = pgTable('server_allocations', {
  serverId:     uuid('server_id').notNull().references(() => servers.id, { onDelete: 'cascade' }),
  allocationId: uuid('allocation_id').notNull().references(() => allocations.id, { onDelete: 'cascade' }),
})

// ── Activity logs ─────────────────────────────────────────────────────────────
export const activityLogs = pgTable('activity_logs', {
  id:        uuid('id').primaryKey().defaultRandom(),
  serverId:  uuid('server_id').references(() => servers.id, { onDelete: 'cascade' }),
  userId:    uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  event:     varchar('event', { length: 100 }).notNull(),
  metadata:  jsonb('metadata').$type<Record<string, unknown>>(),
  ip:        varchar('ip', { length: 45 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// ── Admin mounts ──────────────────────────────────────────────────────────────
export const mounts = pgTable('mounts', {
  id:            uuid('id').primaryKey().defaultRandom(),
  name:          varchar('name', { length: 100 }).notNull().unique(),
  description:   varchar('description', { length: 500 }),
  source:        varchar('source', { length: 255 }).notNull(),
  target:        varchar('target', { length: 255 }).notNull(),
  readOnly:      boolean('read_only').notNull().default(false),
  userMountable: boolean('user_mountable').notNull().default(false),
  createdAt:     timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// ── MCJars ────────────────────────────────────────────────────────────────────
export const mcjarsSettings = pgTable('mcjars_settings', {
  id:        integer('id').primaryKey().default(1),
  orgKey:    varchar('org_key', { length: 255 }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const mcjarsTypeConfig = pgTable('mcjars_type_config', {
  type:      varchar('type', { length: 50 }).primaryKey(),
  category:  varchar('category', { length: 100 }),
  sortOrder: integer('sort_order').notNull().default(0),
  hidden:    boolean('hidden').notNull().default(false),
  eggId:     uuid('egg_id').references(() => eggs.id, { onDelete: 'set null' }),
})

export const mcjarsInstalls = pgTable('mcjars_installs', {
  id:          uuid('id').primaryKey().defaultRandom(),
  serverId:    uuid('server_id').references(() => servers.id, { onDelete: 'set null' }),
  type:        varchar('type', { length: 50 }).notNull(),
  version:     varchar('version', { length: 50 }).notNull(),
  build:       varchar('build', { length: 50 }).notNull(),
  installedAt: timestamp('installed_at', { withTimezone: true }).notNull().defaultNow(),
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
