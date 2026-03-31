ALTER TABLE "app"."artworks" ADD COLUMN "drawing_document" text;--> statement-breakpoint
ALTER TABLE "app"."artworks" ADD COLUMN "drawing_version" integer;--> statement-breakpoint
ALTER TABLE "app"."users" ADD COLUMN "avatar_document" text;--> statement-breakpoint
ALTER TABLE "app"."users" ADD COLUMN "avatar_document_version" integer;