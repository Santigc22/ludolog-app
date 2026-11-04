CREATE TABLE "collection_members" (
	"collection_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role_code" varchar(30) NOT NULL,
	"joined_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "collection_members_collection_id_user_id_pk" PRIMARY KEY("collection_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "collection_statuses" (
	"code" varchar(30) PRIMARY KEY NOT NULL,
	"name" varchar(80) NOT NULL,
	CONSTRAINT "collection_statuses_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "collection_types" (
	"code" varchar(30) PRIMARY KEY NOT NULL,
	"name" varchar(80) NOT NULL,
	CONSTRAINT "collection_types_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "collections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type_code" varchar(30) NOT NULL,
	"status_code" varchar(30) NOT NULL,
	"name" varchar(140) NOT NULL,
	"description" text,
	"visibility_code" varchar(30) NOT NULL,
	"is_for_sale" boolean DEFAULT false NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp (3) with time zone,
	CONSTRAINT "collections_personal_type_only" CHECK ("collections"."type_code" = 'PERSONAL'),
	CONSTRAINT "collections_personal_visibility_allowed" CHECK ("collections"."visibility_code" IN ('PRIVATE', 'PUBLIC')),
	CONSTRAINT "collections_sale_disabled" CHECK ("collections"."is_for_sale" = false),
	CONSTRAINT "collections_archive_consistent" CHECK (("collections"."status_code" = 'ARCHIVED') = ("collections"."archived_at" IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "collection_members" ADD CONSTRAINT "collection_members_collection_id_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."collections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_members" ADD CONSTRAINT "collection_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_members" ADD CONSTRAINT "collection_members_role_code_collection_roles_code_fk" FOREIGN KEY ("role_code") REFERENCES "public"."collection_roles"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collections" ADD CONSTRAINT "collections_type_code_collection_types_code_fk" FOREIGN KEY ("type_code") REFERENCES "public"."collection_types"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collections" ADD CONSTRAINT "collections_status_code_collection_statuses_code_fk" FOREIGN KEY ("status_code") REFERENCES "public"."collection_statuses"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collections" ADD CONSTRAINT "collections_visibility_code_visibility_levels_code_fk" FOREIGN KEY ("visibility_code") REFERENCES "public"."visibility_levels"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collections" ADD CONSTRAINT "collections_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "collection_members_user_id_idx" ON "collection_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "collections_created_by_user_id_idx" ON "collections" USING btree ("created_by_user_id");--> statement-breakpoint
CREATE INDEX "collections_status_code_idx" ON "collections" USING btree ("status_code");