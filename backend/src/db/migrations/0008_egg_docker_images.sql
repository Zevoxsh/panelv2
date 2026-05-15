ALTER TABLE "eggs" ADD COLUMN IF NOT EXISTS "docker_images" jsonb NOT NULL DEFAULT '{}';
