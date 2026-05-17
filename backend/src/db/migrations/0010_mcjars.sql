CREATE TABLE IF NOT EXISTS "mcjars_settings" (
  "id" integer PRIMARY KEY DEFAULT 1,
  "org_key" varchar(255),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "mcjars_type_config" (
  "type" varchar(50) PRIMARY KEY,
  "category" varchar(100),
  "sort_order" integer NOT NULL DEFAULT 0,
  "hidden" boolean NOT NULL DEFAULT false,
  "egg_id" uuid REFERENCES "eggs"("id") ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS "mcjars_installs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "server_id" uuid REFERENCES "servers"("id") ON DELETE SET NULL,
  "type" varchar(50) NOT NULL,
  "version" varchar(50) NOT NULL,
  "build" varchar(50) NOT NULL,
  "installed_at" timestamp with time zone NOT NULL DEFAULT now()
);

INSERT INTO "mcjars_settings" ("id") VALUES (1) ON CONFLICT DO NOTHING;
