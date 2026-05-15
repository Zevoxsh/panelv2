CREATE TYPE "public"."node_scheme" AS ENUM('https', 'http');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "locations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" varchar(500),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "locations_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "nodes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" varchar(500),
	"location_id" uuid NOT NULL,
	"fqdn" varchar(255) NOT NULL,
	"scheme" "node_scheme" DEFAULT 'https' NOT NULL,
	"behind_proxy" boolean DEFAULT false NOT NULL,
	"is_public" boolean DEFAULT true NOT NULL,
	"daemon_dir" varchar(500) DEFAULT '/var/lib/pterodactyl/volumes' NOT NULL,
	"memory" integer NOT NULL,
	"memory_overallocate" integer DEFAULT 0 NOT NULL,
	"disk" integer NOT NULL,
	"disk_overallocate" integer DEFAULT 0 NOT NULL,
	"daemon_port" integer DEFAULT 8080 NOT NULL,
	"daemon_sftp" integer DEFAULT 2022 NOT NULL,
	"daemon_token" varchar(255) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "nodes_name_unique" UNIQUE("name")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "nodes" ADD CONSTRAINT "nodes_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
