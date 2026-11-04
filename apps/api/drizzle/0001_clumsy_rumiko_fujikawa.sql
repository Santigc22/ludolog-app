CREATE TABLE "profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"display_name" varchar(120),
	"bio" text,
	"avatar_url" text,
	"location_text" varchar(160),
	"visibility_code" varchar(30) NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "profiles_visibility_allowed" CHECK ("profiles"."visibility_code" IN ('PRIVATE', 'PUBLIC'))
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(320) NOT NULL,
	"username" varchar(80) NOT NULL,
	"password_hash" varchar(255) NOT NULL,
	"status_code" varchar(30) NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"deactivated_at" timestamp (3) with time zone,
	CONSTRAINT "users_deactivation_consistent" CHECK (("users"."status_code" = 'DEACTIVATED') = ("users"."deactivated_at" IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_visibility_code_visibility_levels_code_fk" FOREIGN KEY ("visibility_code") REFERENCES "public"."visibility_levels"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_status_code_user_statuses_code_fk" FOREIGN KEY ("status_code") REFERENCES "public"."user_statuses"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_normalized_unique" ON "users" USING btree (lower("email"));--> statement-breakpoint
CREATE UNIQUE INDEX "users_username_normalized_unique" ON "users" USING btree (lower("username"));