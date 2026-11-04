CREATE TABLE "game_editions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" uuid NOT NULL,
	"edition_name" varchar(180),
	"edition_number" varchar(80),
	"language_code" varchar(12),
	"publication_year" smallint,
	"isbn" varchar(32),
	"sku" varchar(80),
	"upc" varchar(32),
	"notes" text,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "game_editions_publication_year_valid" CHECK ("game_editions"."publication_year" IS NULL OR "game_editions"."publication_year" >= 0)
);
--> statement-breakpoint
CREATE TABLE "games" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(220) NOT NULL,
	"description" text,
	"publication_year" smallint,
	"min_players" smallint NOT NULL,
	"max_players" smallint NOT NULL,
	"min_duration_minutes" integer,
	"max_duration_minutes" integer,
	"min_age" smallint,
	"max_age" smallint,
	"complexity" numeric(3, 2),
	"classification_code" varchar(30) NOT NULL,
	"visibility_code" varchar(30) NOT NULL,
	"moderation_status_code" varchar(40) NOT NULL,
	"created_by_user_id" uuid,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp (3) with time zone,
	CONSTRAINT "games_publication_year_valid" CHECK ("games"."publication_year" IS NULL OR "games"."publication_year" >= 0),
	CONSTRAINT "games_min_players_valid" CHECK ("games"."min_players" >= 1),
	CONSTRAINT "games_player_range_valid" CHECK ("games"."max_players" >= "games"."min_players"),
	CONSTRAINT "games_min_duration_valid" CHECK ("games"."min_duration_minutes" IS NULL OR "games"."min_duration_minutes" >= 0),
	CONSTRAINT "games_duration_range_valid" CHECK ("games"."max_duration_minutes" IS NULL OR ("games"."max_duration_minutes" >= 0 AND ("games"."min_duration_minutes" IS NULL OR "games"."max_duration_minutes" >= "games"."min_duration_minutes"))),
	CONSTRAINT "games_min_age_valid" CHECK ("games"."min_age" IS NULL OR "games"."min_age" >= 0),
	CONSTRAINT "games_age_range_valid" CHECK ("games"."max_age" IS NULL OR ("games"."max_age" >= 0 AND ("games"."min_age" IS NULL OR "games"."max_age" >= "games"."min_age"))),
	CONSTRAINT "games_complexity_valid" CHECK ("games"."complexity" IS NULL OR ("games"."complexity" >= 0 AND "games"."complexity" <= 5)),
	CONSTRAINT "games_scope_consistent" CHECK ((
        "games"."visibility_code" = 'PRIVATE'
        AND "games"."classification_code" = 'PRIVATE'
        AND "games"."created_by_user_id" IS NOT NULL
        AND "games"."moderation_status_code" IN ('DRAFT', 'ARCHIVED')
      ) OR (
        "games"."visibility_code" = 'PUBLIC'
        AND "games"."classification_code" IN ('OFFICIAL', 'COMMUNITY')
        AND "games"."moderation_status_code" IN ('APPROVED', 'ARCHIVED')
      )),
	CONSTRAINT "games_archive_consistent" CHECK (("games"."moderation_status_code" = 'ARCHIVED') = ("games"."archived_at" IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "game_editions" ADD CONSTRAINT "game_editions_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "games" ADD CONSTRAINT "games_classification_code_game_classifications_code_fk" FOREIGN KEY ("classification_code") REFERENCES "public"."game_classifications"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "games" ADD CONSTRAINT "games_visibility_code_visibility_levels_code_fk" FOREIGN KEY ("visibility_code") REFERENCES "public"."visibility_levels"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "games" ADD CONSTRAINT "games_moderation_status_code_moderation_statuses_code_fk" FOREIGN KEY ("moderation_status_code") REFERENCES "public"."moderation_statuses"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "games" ADD CONSTRAINT "games_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "game_editions_game_id_idx" ON "game_editions" USING btree ("game_id");--> statement-breakpoint
CREATE INDEX "games_name_normalized_idx" ON "games" USING btree (lower("name"));--> statement-breakpoint
CREATE INDEX "games_visibility_moderation_idx" ON "games" USING btree ("visibility_code","moderation_status_code");--> statement-breakpoint
CREATE INDEX "games_created_by_user_id_idx" ON "games" USING btree ("created_by_user_id");