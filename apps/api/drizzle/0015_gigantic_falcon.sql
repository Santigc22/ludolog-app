INSERT INTO "match_statuses" ("code", "name") VALUES ('PLANNED', 'Planned')
ON CONFLICT ("code") DO UPDATE SET "name" = EXCLUDED."name";--> statement-breakpoint
ALTER TABLE "matches" DROP CONSTRAINT "matches_status_allowed";--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_status_allowed" CHECK ("matches"."status_code" IN ('PLANNED', 'COMPLETED', 'INCOMPLETE', 'CANCELLED'));
