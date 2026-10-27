-- Idempotently ensure the profile objects exist before repairing the session column.
DO $$ BEGIN CREATE TYPE "profile_type" AS ENUM('participant', 'organizer'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "profile_status" AS ENUM('active', 'suspended', 'deleted'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "profile_role_label" AS ENUM('student', 'teacher', 'other'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "organizer_approval_status" AS ENUM('not_requested', 'pending', 'approved', 'rejected'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
	"type" "profile_type" NOT NULL,
	"display_name" text NOT NULL,
	"avatar_url" text,
	"institution" text,
	"role_label" "profile_role_label" DEFAULT 'other' NOT NULL,
	"bio" text,
	"status" "profile_status" DEFAULT 'active' NOT NULL,
	"approval_status" "organizer_approval_status" DEFAULT 'not_requested' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "profiles_user_type_uidx" ON "profiles" USING btree ("user_id", "type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "profiles_user_id_idx" ON "profiles" USING btree ("user_id");--> statement-breakpoint
INSERT INTO "profiles" ("user_id", "type", "display_name", "role_label")
SELECT "id", 'participant'::"profile_type", "name", 'other'::"profile_role_label" FROM "users"
ON CONFLICT ("user_id", "type") DO NOTHING;--> statement-breakpoint
INSERT INTO "profiles" ("user_id", "type", "display_name", "role_label", "approval_status")
SELECT DISTINCT u."id", 'organizer'::"profile_type", u."name", 'other'::"profile_role_label", 'approved'::"organizer_approval_status"
FROM "users" u
WHERE EXISTS (SELECT 1 FROM "event_memberships" m WHERE m."user_id" = u."id" AND m."role" = 'admin')
   OR EXISTS (SELECT 1 FROM "events" e WHERE e."owner_id" = u."id")
ON CONFLICT ("user_id", "type") DO NOTHING;--> statement-breakpoint
ALTER TABLE "auth_sessions" ADD COLUMN IF NOT EXISTS "active_profile_id" uuid;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_active_profile_id_profiles_id_fk"
    FOREIGN KEY ("active_profile_id") REFERENCES "profiles"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
UPDATE "auth_sessions" s SET "active_profile_id" = COALESCE(
  (SELECT p."id" FROM "profiles" p WHERE p."user_id" = s."user_id" AND p."type" = 'organizer' AND p."status" = 'active' AND p."approval_status" = 'approved'),
  (SELECT p."id" FROM "profiles" p WHERE p."user_id" = s."user_id" AND p."type" = 'participant' AND p."status" = 'active')
)
WHERE s."active_profile_id" IS NULL;--> statement-breakpoint
