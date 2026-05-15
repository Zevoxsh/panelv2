ALTER TABLE "nodes" ADD COLUMN "panel_url" varchar(255) NOT NULL DEFAULT '';
ALTER TABLE "nodes" ALTER COLUMN "panel_url" DROP DEFAULT;
