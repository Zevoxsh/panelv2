ALTER TABLE "eggs" ADD COLUMN "install_script" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "eggs" ADD COLUMN "install_container" varchar(255) DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "eggs" ADD COLUMN "install_entrypoint" varchar(100) DEFAULT 'ash' NOT NULL;