CREATE TABLE "acquisitions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"copy_id" uuid NOT NULL,
	"collection_id" uuid NOT NULL,
	"acquired_by_user_id" uuid NOT NULL,
	"type_code" varchar(30) NOT NULL,
	"acquired_on" date,
	"price_amount" numeric(12, 2),
	"currency_code" varchar(3),
	"source_name" varchar(180),
	"notes" text,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "acquisitions_price_valid" CHECK ("acquisitions"."price_amount" IS NULL OR "acquisitions"."price_amount" >= 0),
	CONSTRAINT "acquisitions_currency_consistent" CHECK (("acquisitions"."price_amount" IS NULL AND "acquisitions"."currency_code" IS NULL) OR ("acquisitions"."price_amount" IS NOT NULL AND "acquisitions"."currency_code" IS NOT NULL AND "acquisitions"."currency_code" = upper("acquisitions"."currency_code")))
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_user_id" uuid,
	"action" varchar(120) NOT NULL,
	"resource_type" varchar(80) NOT NULL,
	"resource_id" uuid NOT NULL,
	"before_state" jsonb,
	"after_state" jsonb,
	"context" jsonb,
	"occurred_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "copies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" uuid NOT NULL,
	"game_edition_id" uuid,
	"current_collection_id" uuid,
	"lifecycle_code" varchar(30) NOT NULL,
	"condition_code" varchar(30) NOT NULL,
	"alias" varchar(140),
	"notes" text,
	"exit_reason_code" varchar(30),
	"exited_at" timestamp (3) with time zone,
	"created_by_user_id" uuid NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "copies_lifecycle_consistent" CHECK ((
        "copies"."lifecycle_code" = 'ACTIVE'
        AND "copies"."current_collection_id" IS NOT NULL
        AND "copies"."exit_reason_code" IS NULL
        AND "copies"."exited_at" IS NULL
      ) OR (
        "copies"."lifecycle_code" = 'EXITED'
        AND "copies"."current_collection_id" IS NULL
        AND "copies"."exit_reason_code" IS NOT NULL
        AND "copies"."exited_at" IS NOT NULL
      ))
);
--> statement-breakpoint
CREATE TABLE "copy_collection_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"copy_id" uuid NOT NULL,
	"collection_id" uuid NOT NULL,
	"started_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp (3) with time zone,
	"changed_by_user_id" uuid NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "copy_collection_history_period_valid" CHECK ("copy_collection_history"."ended_at" IS NULL OR "copy_collection_history"."ended_at" >= "copy_collection_history"."started_at")
);
--> statement-breakpoint
ALTER TABLE "acquisitions" ADD CONSTRAINT "acquisitions_copy_id_copies_id_fk" FOREIGN KEY ("copy_id") REFERENCES "public"."copies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "acquisitions" ADD CONSTRAINT "acquisitions_collection_id_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."collections"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "acquisitions" ADD CONSTRAINT "acquisitions_acquired_by_user_id_users_id_fk" FOREIGN KEY ("acquired_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "acquisitions" ADD CONSTRAINT "acquisitions_type_code_acquisition_types_code_fk" FOREIGN KEY ("type_code") REFERENCES "public"."acquisition_types"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "copies" ADD CONSTRAINT "copies_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "copies" ADD CONSTRAINT "copies_current_collection_id_collections_id_fk" FOREIGN KEY ("current_collection_id") REFERENCES "public"."collections"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "copies" ADD CONSTRAINT "copies_lifecycle_code_copy_lifecycle_statuses_code_fk" FOREIGN KEY ("lifecycle_code") REFERENCES "public"."copy_lifecycle_statuses"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "copies" ADD CONSTRAINT "copies_condition_code_copy_condition_statuses_code_fk" FOREIGN KEY ("condition_code") REFERENCES "public"."copy_condition_statuses"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "copies" ADD CONSTRAINT "copies_exit_reason_code_copy_exit_reasons_code_fk" FOREIGN KEY ("exit_reason_code") REFERENCES "public"."copy_exit_reasons"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "copies" ADD CONSTRAINT "copies_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_editions" ADD CONSTRAINT "game_editions_id_game_id_unique" UNIQUE("id","game_id");--> statement-breakpoint
ALTER TABLE "copies" ADD CONSTRAINT "copies_edition_belongs_to_game_fk" FOREIGN KEY ("game_edition_id","game_id") REFERENCES "public"."game_editions"("id","game_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "copy_collection_history" ADD CONSTRAINT "copy_collection_history_copy_id_copies_id_fk" FOREIGN KEY ("copy_id") REFERENCES "public"."copies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "copy_collection_history" ADD CONSTRAINT "copy_collection_history_collection_id_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."collections"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "copy_collection_history" ADD CONSTRAINT "copy_collection_history_changed_by_user_id_users_id_fk" FOREIGN KEY ("changed_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "acquisitions_copy_id_idx" ON "acquisitions" USING btree ("copy_id");--> statement-breakpoint
CREATE INDEX "acquisitions_collection_id_idx" ON "acquisitions" USING btree ("collection_id");--> statement-breakpoint
CREATE INDEX "acquisitions_acquired_by_user_id_idx" ON "acquisitions" USING btree ("acquired_by_user_id");--> statement-breakpoint
CREATE INDEX "audit_logs_actor_user_id_idx" ON "audit_logs" USING btree ("actor_user_id");--> statement-breakpoint
CREATE INDEX "audit_logs_resource_idx" ON "audit_logs" USING btree ("resource_type","resource_id");--> statement-breakpoint
CREATE INDEX "audit_logs_occurred_at_idx" ON "audit_logs" USING btree ("occurred_at");--> statement-breakpoint
CREATE INDEX "copies_game_id_idx" ON "copies" USING btree ("game_id");--> statement-breakpoint
CREATE INDEX "copies_game_edition_id_idx" ON "copies" USING btree ("game_edition_id");--> statement-breakpoint
CREATE INDEX "copies_current_collection_id_idx" ON "copies" USING btree ("current_collection_id");--> statement-breakpoint
CREATE INDEX "copies_lifecycle_code_idx" ON "copies" USING btree ("lifecycle_code");--> statement-breakpoint
CREATE INDEX "copies_created_by_user_id_idx" ON "copies" USING btree ("created_by_user_id");--> statement-breakpoint
CREATE INDEX "copy_collection_history_copy_id_idx" ON "copy_collection_history" USING btree ("copy_id");--> statement-breakpoint
CREATE INDEX "copy_collection_history_collection_id_idx" ON "copy_collection_history" USING btree ("collection_id");--> statement-breakpoint
CREATE INDEX "copy_collection_history_changed_by_user_id_idx" ON "copy_collection_history" USING btree ("changed_by_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "copy_collection_history_one_open_per_copy" ON "copy_collection_history" USING btree ("copy_id") WHERE "copy_collection_history"."ended_at" IS NULL;
