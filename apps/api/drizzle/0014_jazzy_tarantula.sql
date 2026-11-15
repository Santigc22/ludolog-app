CREATE TABLE "match_participants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"match_id" uuid NOT NULL,
	"user_id" uuid,
	"guest_name" varchar(160),
	"display_name_snapshot" varchar(160) NOT NULL,
	"seat_order" smallint NOT NULL,
	"outcome_type_code" varchar(30) DEFAULT 'NO_RESULT' NOT NULL,
	"score_numeric" numeric(18, 4),
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "match_participants_seat_unique" UNIQUE("match_id","seat_order"),
	CONSTRAINT "match_participants_single_identity" CHECK (("match_participants"."user_id" IS NOT NULL)::integer + ("match_participants"."guest_name" IS NOT NULL)::integer = 1),
	CONSTRAINT "match_participants_seat_valid" CHECK ("match_participants"."seat_order" >= 1),
	CONSTRAINT "match_participants_outcome_allowed" CHECK ("match_participants"."outcome_type_code" IN ('WIN', 'LOSS', 'DRAW', 'NO_RESULT'))
);
--> statement-breakpoint
CREATE TABLE "matches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" uuid NOT NULL,
	"game_edition_id" uuid,
	"copy_id" uuid,
	"collection_id" uuid,
	"created_by_user_id" uuid NOT NULL,
	"status_code" varchar(30) NOT NULL,
	"visibility_code" varchar(30) NOT NULL,
	"started_at" timestamp (3) with time zone NOT NULL,
	"duration_minutes" integer,
	"location_text" varchar(220),
	"notes" text,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "matches_status_allowed" CHECK ("matches"."status_code" IN ('COMPLETED', 'INCOMPLETE', 'CANCELLED')),
	CONSTRAINT "matches_visibility_allowed" CHECK ("matches"."visibility_code" IN ('PRIVATE', 'PUBLIC')),
	CONSTRAINT "matches_duration_valid" CHECK ("matches"."duration_minutes" IS NULL OR "matches"."duration_minutes" >= 0)
);
--> statement-breakpoint
ALTER TABLE "match_participants" ADD CONSTRAINT "match_participants_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_participants" ADD CONSTRAINT "match_participants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_participants" ADD CONSTRAINT "match_participants_outcome_type_code_outcome_types_code_fk" FOREIGN KEY ("outcome_type_code") REFERENCES "public"."outcome_types"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_collection_id_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."collections"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_status_code_match_statuses_code_fk" FOREIGN KEY ("status_code") REFERENCES "public"."match_statuses"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_visibility_code_visibility_levels_code_fk" FOREIGN KEY ("visibility_code") REFERENCES "public"."visibility_levels"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_edition_belongs_to_game_fk" FOREIGN KEY ("game_edition_id","game_id") REFERENCES "public"."game_editions"("id","game_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "copies" ADD CONSTRAINT "copies_id_game_id_unique" UNIQUE("id","game_id");--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_copy_belongs_to_game_fk" FOREIGN KEY ("copy_id","game_id") REFERENCES "public"."copies"("id","game_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "match_participants_match_id_idx" ON "match_participants" USING btree ("match_id");--> statement-breakpoint
CREATE INDEX "match_participants_user_id_idx" ON "match_participants" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "match_participants_registered_user_unique" ON "match_participants" USING btree ("match_id","user_id") WHERE "match_participants"."user_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "matches_creator_started_idx" ON "matches" USING btree ("created_by_user_id","started_at");--> statement-breakpoint
CREATE INDEX "matches_game_started_idx" ON "matches" USING btree ("game_id","started_at");--> statement-breakpoint
CREATE INDEX "matches_copy_id_idx" ON "matches" USING btree ("copy_id");--> statement-breakpoint
CREATE INDEX "matches_collection_id_idx" ON "matches" USING btree ("collection_id");
