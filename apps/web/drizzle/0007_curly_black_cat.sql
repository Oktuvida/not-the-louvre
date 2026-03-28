CREATE TABLE "app"."artwork_comment_realtime" (
	"id" text PRIMARY KEY NOT NULL,
	"artwork_id" text NOT NULL,
	"author_id" text NOT NULL,
	"body" text,
	"is_visible" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."artwork_vote_realtime" (
	"id" text PRIMARY KEY NOT NULL,
	"artwork_id" text NOT NULL,
	"value" "app"."artwork_vote_value" NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "app"."artwork_comment_realtime" ADD CONSTRAINT "artwork_comment_realtime_artwork_id_artworks_id_fk" FOREIGN KEY ("artwork_id") REFERENCES "app"."artworks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."artwork_comment_realtime" ADD CONSTRAINT "artwork_comment_realtime_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "app"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."artwork_vote_realtime" ADD CONSTRAINT "artwork_vote_realtime_artwork_id_artworks_id_fk" FOREIGN KEY ("artwork_id") REFERENCES "app"."artworks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "artwork_comment_realtime_artwork_id_idx" ON "app"."artwork_comment_realtime" USING btree ("artwork_id");--> statement-breakpoint
CREATE INDEX "artwork_vote_realtime_artwork_id_idx" ON "app"."artwork_vote_realtime" USING btree ("artwork_id");