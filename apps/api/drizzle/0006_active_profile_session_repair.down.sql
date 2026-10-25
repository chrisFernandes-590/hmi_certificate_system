ALTER TABLE "auth_sessions" DROP CONSTRAINT IF EXISTS "auth_sessions_active_profile_id_profiles_id_fk";--> statement-breakpoint
ALTER TABLE "auth_sessions" DROP COLUMN IF EXISTS "active_profile_id";
