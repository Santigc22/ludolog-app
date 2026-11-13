CREATE TABLE "categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(120) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "game_categories" (
	"game_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	CONSTRAINT "game_categories_game_id_category_id_pk" PRIMARY KEY("game_id","category_id")
);
--> statement-breakpoint
ALTER TABLE "game_categories" ADD CONSTRAINT "game_categories_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_categories" ADD CONSTRAINT "game_categories_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "categories_name_normalized_unique" ON "categories" USING btree (lower("name"));--> statement-breakpoint
CREATE INDEX "game_categories_category_id_idx" ON "game_categories" USING btree ("category_id");