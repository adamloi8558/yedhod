CREATE TYPE "public"."ad_slot" AS ENUM('header_top', 'header_bottom', 'sidebar_top', 'sidebar_mid', 'sidebar_bot', 'in_feed_1', 'in_feed_2', 'in_feed_3', 'before_video', 'after_video', 'under_title', 'popunder', 'footer_top', 'footer_bottom', 'sticky_bottom');--> statement-breakpoint
CREATE TYPE "public"."ad_type" AS ENUM('embed', 'banner', 'galaksion', 'aads');--> statement-breakpoint
CREATE TABLE "tenants" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"primary_domain" text NOT NULL,
	"logo_r2_key" text,
	"favicon_r2_key" text,
	"tagline" text,
	"footer_text" text,
	"primary_color" text DEFAULT '#3b82f6' NOT NULL,
	"accent_color" text DEFAULT '#60a5fa' NOT NULL,
	"background_color" text DEFAULT '#0b0d13' NOT NULL,
	"fg_color" text DEFAULT '#e6e9f2' NOT NULL,
	"meta_title" text,
	"meta_description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tenants_slug_unique" UNIQUE("slug"),
	CONSTRAINT "tenants_primary_domain_unique" UNIQUE("primary_domain")
);
--> statement-breakpoint
CREATE TABLE "tenant_categories" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"category_id" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenant_ads" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"slot" "ad_slot" NOT NULL,
	"type" "ad_type" NOT NULL,
	"embed_code" text,
	"image_r2_key" text,
	"link_url" text,
	"alt_text" text,
	"network_zone_id" text,
	"network_width" integer,
	"network_height" integer,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tenant_categories" ADD CONSTRAINT "tenant_categories_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_categories" ADD CONSTRAINT "tenant_categories_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_ads" ADD CONSTRAINT "tenant_ads_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tenants_domain_idx" ON "tenants" USING btree ("primary_domain");--> statement-breakpoint
CREATE INDEX "tenants_slug_idx" ON "tenants" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "tenant_categories_unique" ON "tenant_categories" USING btree ("tenant_id","category_id");--> statement-breakpoint
CREATE INDEX "tenant_categories_tenant_idx" ON "tenant_categories" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "tenant_ads_tenant_slot_idx" ON "tenant_ads" USING btree ("tenant_id","slot");