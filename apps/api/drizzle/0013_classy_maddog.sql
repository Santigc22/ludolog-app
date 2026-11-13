DROP INDEX "moderation_cases_one_pending_per_game";--> statement-breakpoint
ALTER TABLE "moderation_cases" ALTER COLUMN "game_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "game_editions" ADD COLUMN "moderation_status_code" varchar(40) DEFAULT 'APPROVED' NOT NULL;--> statement-breakpoint
ALTER TABLE "game_editions" ADD COLUMN "created_by_user_id" uuid;--> statement-breakpoint
ALTER TABLE "game_editions" ADD COLUMN "updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "moderation_cases" ADD COLUMN "game_edition_id" uuid;--> statement-breakpoint
ALTER TABLE "game_editions" ADD CONSTRAINT "game_editions_moderation_status_code_moderation_statuses_code_fk" FOREIGN KEY ("moderation_status_code") REFERENCES "public"."moderation_statuses"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_editions" ADD CONSTRAINT "game_editions_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_cases" ADD CONSTRAINT "moderation_cases_game_edition_id_game_editions_id_fk" FOREIGN KEY ("game_edition_id") REFERENCES "public"."game_editions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "game_editions_status_game_idx" ON "game_editions" USING btree ("moderation_status_code","game_id");--> statement-breakpoint
CREATE INDEX "game_editions_created_by_user_id_idx" ON "game_editions" USING btree ("created_by_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "moderation_cases_one_pending_per_edition" ON "moderation_cases" USING btree ("game_edition_id") WHERE "moderation_cases"."game_edition_id" IS NOT NULL AND "moderation_cases"."current_status_code" = 'PENDING_REVIEW';--> statement-breakpoint
CREATE UNIQUE INDEX "moderation_cases_one_pending_per_game" ON "moderation_cases" USING btree ("game_id") WHERE "moderation_cases"."game_id" IS NOT NULL AND "moderation_cases"."current_status_code" = 'PENDING_REVIEW';--> statement-breakpoint
ALTER TABLE "game_editions" ADD CONSTRAINT "game_editions_moderation_status_allowed" CHECK ("game_editions"."moderation_status_code" IN ('PENDING_REVIEW', 'APPROVED', 'REJECTED'));--> statement-breakpoint
ALTER TABLE "moderation_cases" ADD CONSTRAINT "moderation_cases_single_target" CHECK (("moderation_cases"."game_id" IS NOT NULL)::integer + ("moderation_cases"."game_edition_id" IS NOT NULL)::integer = 1);