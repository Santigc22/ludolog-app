CREATE TABLE "moderation_actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"moderation_case_id" uuid NOT NULL,
	"actor_user_id" uuid NOT NULL,
	"from_status_code" varchar(40),
	"to_status_code" varchar(40) NOT NULL,
	"reason" text,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "moderation_cases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" uuid NOT NULL,
	"current_status_code" varchar(40) NOT NULL,
	"submitted_by_user_id" uuid NOT NULL,
	"assigned_to_user_id" uuid,
	"submission_note" text,
	"resolution_note" text,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp (3) with time zone,
	CONSTRAINT "moderation_cases_status_allowed" CHECK ("moderation_cases"."current_status_code" IN ('PENDING_REVIEW', 'APPROVED', 'REJECTED')),
	CONSTRAINT "moderation_cases_closed_consistent" CHECK (("moderation_cases"."current_status_code" = 'PENDING_REVIEW' AND "moderation_cases"."closed_at" IS NULL) OR ("moderation_cases"."current_status_code" IN ('APPROVED', 'REJECTED') AND "moderation_cases"."closed_at" IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "games" DROP CONSTRAINT "games_scope_consistent";--> statement-breakpoint
ALTER TABLE "moderation_actions" ADD CONSTRAINT "moderation_actions_moderation_case_id_moderation_cases_id_fk" FOREIGN KEY ("moderation_case_id") REFERENCES "public"."moderation_cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_actions" ADD CONSTRAINT "moderation_actions_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_actions" ADD CONSTRAINT "moderation_actions_from_status_code_moderation_statuses_code_fk" FOREIGN KEY ("from_status_code") REFERENCES "public"."moderation_statuses"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_actions" ADD CONSTRAINT "moderation_actions_to_status_code_moderation_statuses_code_fk" FOREIGN KEY ("to_status_code") REFERENCES "public"."moderation_statuses"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_cases" ADD CONSTRAINT "moderation_cases_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_cases" ADD CONSTRAINT "moderation_cases_current_status_code_moderation_statuses_code_fk" FOREIGN KEY ("current_status_code") REFERENCES "public"."moderation_statuses"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_cases" ADD CONSTRAINT "moderation_cases_submitted_by_user_id_users_id_fk" FOREIGN KEY ("submitted_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_cases" ADD CONSTRAINT "moderation_cases_assigned_to_user_id_users_id_fk" FOREIGN KEY ("assigned_to_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "moderation_actions_case_created_idx" ON "moderation_actions" USING btree ("moderation_case_id","created_at");--> statement-breakpoint
CREATE INDEX "moderation_actions_actor_user_id_idx" ON "moderation_actions" USING btree ("actor_user_id");--> statement-breakpoint
CREATE INDEX "moderation_cases_status_created_idx" ON "moderation_cases" USING btree ("current_status_code","created_at");--> statement-breakpoint
CREATE INDEX "moderation_cases_submitted_by_user_id_idx" ON "moderation_cases" USING btree ("submitted_by_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "moderation_cases_one_pending_per_game" ON "moderation_cases" USING btree ("game_id") WHERE "moderation_cases"."current_status_code" = 'PENDING_REVIEW';--> statement-breakpoint
ALTER TABLE "games" ADD CONSTRAINT "games_scope_consistent" CHECK ((
        "games"."visibility_code" = 'PRIVATE'
        AND "games"."classification_code" = 'PRIVATE'
        AND "games"."created_by_user_id" IS NOT NULL
        AND "games"."moderation_status_code" IN ('DRAFT', 'PENDING_REVIEW', 'REJECTED', 'REJECTED_DUPLICATE', 'BLOCKED', 'ARCHIVED')
      ) OR (
        "games"."visibility_code" = 'PUBLIC'
        AND "games"."classification_code" IN ('OFFICIAL', 'COMMUNITY')
        AND "games"."moderation_status_code" IN ('APPROVED', 'ARCHIVED')
      ));