CREATE TABLE "clip_reactions" (
	"clip_id" text NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "clip_reactions_clip_id_user_id_pk" PRIMARY KEY("clip_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "clip_stats" (
	"clip_id" text PRIMARY KEY NOT NULL,
	"view_count" integer DEFAULT 0 NOT NULL,
	"recent_views" integer DEFAULT 0 NOT NULL,
	"recent_decayed_at" timestamp DEFAULT now() NOT NULL,
	"like_count" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "watch_progress" (
	"user_id" text NOT NULL,
	"clip_id" text NOT NULL,
	"position_sec" real DEFAULT 0 NOT NULL,
	"duration_sec" real,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "watch_progress_user_id_clip_id_pk" PRIMARY KEY("user_id","clip_id")
);
--> statement-breakpoint
ALTER TABLE "clip_reactions" ADD CONSTRAINT "clip_reactions_clip_id_clips_id_fk" FOREIGN KEY ("clip_id") REFERENCES "public"."clips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clip_reactions" ADD CONSTRAINT "clip_reactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clip_stats" ADD CONSTRAINT "clip_stats_clip_id_clips_id_fk" FOREIGN KEY ("clip_id") REFERENCES "public"."clips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watch_progress" ADD CONSTRAINT "watch_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watch_progress" ADD CONSTRAINT "watch_progress_clip_id_clips_id_fk" FOREIGN KEY ("clip_id") REFERENCES "public"."clips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "clip_reactions_user_idx" ON "clip_reactions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "clip_stats_recent_idx" ON "clip_stats" USING btree ("recent_views");--> statement-breakpoint
CREATE INDEX "clip_stats_view_idx" ON "clip_stats" USING btree ("view_count");--> statement-breakpoint
CREATE INDEX "watch_progress_user_recent_idx" ON "watch_progress" USING btree ("user_id","updated_at");