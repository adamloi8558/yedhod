ALTER TABLE "clips" ALTER COLUMN "file_size" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "clips" ADD COLUMN "source_url" text;--> statement-breakpoint
ALTER TABLE "clips" ADD CONSTRAINT "clips_source_url_unique" UNIQUE("source_url");