ALTER TABLE "auth_sessions" DROP COLUMN "active_profile_id";--> statement-breakpoint
DROP TABLE "profiles";--> statement-breakpoint
DROP TYPE "organizer_approval_status";--> statement-breakpoint
DROP TYPE "profile_role_label";--> statement-breakpoint
DROP TYPE "profile_status";--> statement-breakpoint
DROP TYPE "profile_type";
