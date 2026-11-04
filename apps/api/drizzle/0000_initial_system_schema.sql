CREATE TABLE "acquisition_types" (
	"code" varchar(30) PRIMARY KEY NOT NULL,
	"name" varchar(80) NOT NULL,
	CONSTRAINT "acquisition_types_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "collection_roles" (
	"code" varchar(30) PRIMARY KEY NOT NULL,
	"name" varchar(80) NOT NULL,
	CONSTRAINT "collection_roles_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "copy_condition_statuses" (
	"code" varchar(30) PRIMARY KEY NOT NULL,
	"name" varchar(80) NOT NULL,
	CONSTRAINT "copy_condition_statuses_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "copy_exit_reasons" (
	"code" varchar(30) PRIMARY KEY NOT NULL,
	"name" varchar(80) NOT NULL,
	CONSTRAINT "copy_exit_reasons_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "copy_lifecycle_statuses" (
	"code" varchar(30) PRIMARY KEY NOT NULL,
	"name" varchar(80) NOT NULL,
	CONSTRAINT "copy_lifecycle_statuses_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "game_classifications" (
	"code" varchar(30) PRIMARY KEY NOT NULL,
	"name" varchar(80) NOT NULL,
	CONSTRAINT "game_classifications_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "game_person_roles" (
	"code" varchar(30) PRIMARY KEY NOT NULL,
	"name" varchar(80) NOT NULL,
	CONSTRAINT "game_person_roles_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "game_relation_types" (
	"code" varchar(40) PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	CONSTRAINT "game_relation_types_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "group_roles" (
	"code" varchar(30) PRIMARY KEY NOT NULL,
	"name" varchar(80) NOT NULL,
	CONSTRAINT "group_roles_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "loan_statuses" (
	"code" varchar(30) PRIMARY KEY NOT NULL,
	"name" varchar(80) NOT NULL,
	CONSTRAINT "loan_statuses_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "match_statuses" (
	"code" varchar(30) PRIMARY KEY NOT NULL,
	"name" varchar(80) NOT NULL,
	CONSTRAINT "match_statuses_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "merge_statuses" (
	"code" varchar(30) PRIMARY KEY NOT NULL,
	"name" varchar(80) NOT NULL,
	CONSTRAINT "merge_statuses_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "moderation_statuses" (
	"code" varchar(40) PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	CONSTRAINT "moderation_statuses_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "outcome_types" (
	"code" varchar(30) PRIMARY KEY NOT NULL,
	"name" varchar(80) NOT NULL,
	CONSTRAINT "outcome_types_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "permissions" (
	"code" varchar(120) PRIMARY KEY NOT NULL,
	"description" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "publisher_relation_types" (
	"code" varchar(30) PRIMARY KEY NOT NULL,
	"name" varchar(80) NOT NULL,
	CONSTRAINT "publisher_relation_types_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "reaction_types" (
	"code" varchar(30) PRIMARY KEY NOT NULL,
	"name" varchar(80) NOT NULL,
	CONSTRAINT "reaction_types_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "resource_types" (
	"code" varchar(40) PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	CONSTRAINT "resource_types_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "result_types" (
	"code" varchar(40) PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	CONSTRAINT "result_types_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "role_permissions" (
	"role_code" varchar(60) NOT NULL,
	"permission_code" varchar(120) NOT NULL,
	CONSTRAINT "role_permissions_role_code_permission_code_pk" PRIMARY KEY("role_code","permission_code")
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"code" varchar(60) PRIMARY KEY NOT NULL,
	"name" varchar(120) NOT NULL,
	"description" text,
	CONSTRAINT "roles_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "sale_listing_statuses" (
	"code" varchar(30) PRIMARY KEY NOT NULL,
	"name" varchar(80) NOT NULL,
	CONSTRAINT "sale_listing_statuses_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "score_directions" (
	"code" varchar(30) PRIMARY KEY NOT NULL,
	"name" varchar(80) NOT NULL,
	CONSTRAINT "score_directions_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "scoring_types" (
	"code" varchar(30) PRIMARY KEY NOT NULL,
	"name" varchar(80) NOT NULL,
	CONSTRAINT "scoring_types_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "share_permissions" (
	"code" varchar(30) PRIMARY KEY NOT NULL,
	"name" varchar(80) NOT NULL,
	CONSTRAINT "share_permissions_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "statistic_target_types" (
	"code" varchar(30) PRIMARY KEY NOT NULL,
	"name" varchar(80) NOT NULL,
	CONSTRAINT "statistic_target_types_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "statistic_value_types" (
	"code" varchar(30) PRIMARY KEY NOT NULL,
	"name" varchar(80) NOT NULL,
	CONSTRAINT "statistic_value_types_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "trade_item_sides" (
	"code" varchar(30) PRIMARY KEY NOT NULL,
	"name" varchar(80) NOT NULL,
	CONSTRAINT "trade_item_sides_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "trade_statuses" (
	"code" varchar(30) PRIMARY KEY NOT NULL,
	"name" varchar(80) NOT NULL,
	CONSTRAINT "trade_statuses_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "user_statuses" (
	"code" varchar(30) PRIMARY KEY NOT NULL,
	"name" varchar(80) NOT NULL,
	CONSTRAINT "user_statuses_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "visibility_levels" (
	"code" varchar(30) PRIMARY KEY NOT NULL,
	"name" varchar(80) NOT NULL,
	CONSTRAINT "visibility_levels_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "winner_resolution_types" (
	"code" varchar(30) PRIMARY KEY NOT NULL,
	"name" varchar(80) NOT NULL,
	CONSTRAINT "winner_resolution_types_name_unique" UNIQUE("name")
);
--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_code_roles_code_fk" FOREIGN KEY ("role_code") REFERENCES "public"."roles"("code") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_code_permissions_code_fk" FOREIGN KEY ("permission_code") REFERENCES "public"."permissions"("code") ON DELETE cascade ON UPDATE no action;
