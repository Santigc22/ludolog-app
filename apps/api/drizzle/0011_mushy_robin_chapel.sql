CREATE TABLE "media_assets" (
	"id" uuid PRIMARY KEY NOT NULL,
	"purpose_code" varchar(30) NOT NULL,
	"primary_object_key" text NOT NULL,
	"thumbnail_object_key" text NOT NULL,
	"mime_type" varchar(100) NOT NULL,
	"byte_size" integer NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"checksum_sha256" varchar(64) NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "media_assets_primary_object_key_unique" UNIQUE("primary_object_key"),
	CONSTRAINT "media_assets_thumbnail_object_key_unique" UNIQUE("thumbnail_object_key"),
	CONSTRAINT "media_assets_purpose_allowed" CHECK ("media_assets"."purpose_code" IN ('USER_AVATAR', 'GAME_COVER')),
	CONSTRAINT "media_assets_byte_size_valid" CHECK ("media_assets"."byte_size" > 0),
	CONSTRAINT "media_assets_dimensions_valid" CHECK ("media_assets"."width" > 0 AND "media_assets"."height" > 0)
);
--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "cover_media_id" uuid;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "avatar_media_id" uuid;--> statement-breakpoint
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "media_assets_created_by_user_id_idx" ON "media_assets" USING btree ("created_by_user_id");--> statement-breakpoint
ALTER TABLE "games" ADD CONSTRAINT "games_cover_media_id_media_assets_id_fk" FOREIGN KEY ("cover_media_id") REFERENCES "public"."media_assets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_avatar_media_id_media_assets_id_fk" FOREIGN KEY ("avatar_media_id") REFERENCES "public"."media_assets"("id") ON DELETE set null ON UPDATE no action;