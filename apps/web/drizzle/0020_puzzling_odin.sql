ALTER TYPE "app"."engagement_rate_limit_kind" ADD VALUE 'wish';--> statement-breakpoint
CREATE TABLE "app"."wishes" (
	"id" text PRIMARY KEY NOT NULL,
	"author_id" text NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "app"."artworks" ADD COLUMN "wish_id" text;--> statement-breakpoint
ALTER TABLE "app"."wishes" ADD CONSTRAINT "wishes_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "app"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "wishes_author_id_idx" ON "app"."wishes" USING btree ("author_id");--> statement-breakpoint
ALTER TABLE "app"."artworks" ADD CONSTRAINT "artworks_wish_id_wishes_id_fk" FOREIGN KEY ("wish_id") REFERENCES "app"."wishes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "artworks_wish_id_idx" ON "app"."artworks" USING btree ("wish_id");