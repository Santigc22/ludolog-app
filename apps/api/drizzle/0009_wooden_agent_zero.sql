CREATE TABLE "game_mechanics" (
	"game_id" uuid NOT NULL,
	"mechanic_id" uuid NOT NULL,
	CONSTRAINT "game_mechanics_game_id_mechanic_id_pk" PRIMARY KEY("game_id","mechanic_id")
);
--> statement-breakpoint
CREATE TABLE "mechanics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(120) NOT NULL
);
--> statement-breakpoint
ALTER TABLE "game_mechanics" ADD CONSTRAINT "game_mechanics_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_mechanics" ADD CONSTRAINT "game_mechanics_mechanic_id_mechanics_id_fk" FOREIGN KEY ("mechanic_id") REFERENCES "public"."mechanics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "game_mechanics_mechanic_id_idx" ON "game_mechanics" USING btree ("mechanic_id");--> statement-breakpoint
CREATE UNIQUE INDEX "mechanics_name_normalized_unique" ON "mechanics" USING btree (lower("name"));