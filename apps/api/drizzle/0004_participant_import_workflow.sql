CREATE TABLE "participant_import_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"actor_user_id" uuid NOT NULL,
	"status" text DEFAULT 'upload_pending' NOT NULL,
	"bucket" text NOT NULL,
	"object_key" text NOT NULL,
	"source_file_name" text NOT NULL,
	"content_type" text NOT NULL,
	"file_size_bytes" integer NOT NULL,
	"checksum_sha256" text NOT NULL,
	"mapping" jsonb,
	"duplicate_policy" text DEFAULT 'skip' NOT NULL,
	"total_rows" integer DEFAULT 0 NOT NULL,
	"valid_rows" integer DEFAULT 0 NOT NULL,
	"duplicate_rows" integer DEFAULT 0 NOT NULL,
	"invalid_rows" integer DEFAULT 0 NOT NULL,
	"expected_new" integer DEFAULT 0 NOT NULL,
	"expected_updates" integer DEFAULT 0 NOT NULL,
	"processed_rows" integer DEFAULT 0 NOT NULL,
	"created_count" integer DEFAULT 0 NOT NULL,
	"updated_count" integer DEFAULT 0 NOT NULL,
	"skipped_count" integer DEFAULT 0 NOT NULL,
	"row_errors" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"error_message" text,
	"cancel_requested" boolean DEFAULT false NOT NULL,
	"object_deleted" boolean DEFAULT false NOT NULL,
	"lock_expires_at" timestamp with time zone,
	"expires_at" timestamp with time zone NOT NULL,
	"validated_at" timestamp with time zone,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "participant_import_jobs_object_key_unique" UNIQUE("object_key"),
	CONSTRAINT "participant_import_jobs_status_check" CHECK ("participant_import_jobs"."status" IN ('upload_pending', 'uploaded', 'validating', 'validated', 'queued', 'importing', 'completed', 'partial', 'failed', 'cancelled')),
	CONSTRAINT "participant_import_jobs_duplicate_policy_check" CHECK ("participant_import_jobs"."duplicate_policy" IN ('skip', 'update')),
	CONSTRAINT "participant_import_jobs_file_size_check" CHECK ("participant_import_jobs"."file_size_bytes" BETWEEN 1 AND 20971520),
	CONSTRAINT "participant_import_jobs_counts_check" CHECK ("participant_import_jobs"."total_rows" >= 0 AND "participant_import_jobs"."valid_rows" >= 0 AND "participant_import_jobs"."duplicate_rows" >= 0 AND "participant_import_jobs"."invalid_rows" >= 0 AND "participant_import_jobs"."processed_rows" >= 0 AND "participant_import_jobs"."created_count" >= 0 AND "participant_import_jobs"."updated_count" >= 0 AND "participant_import_jobs"."skipped_count" >= 0)
);
--> statement-breakpoint
ALTER TABLE "participants" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "participants" ADD COLUMN "name" text;--> statement-breakpoint
ALTER TABLE "participants" ADD COLUMN "email" text;--> statement-breakpoint
ALTER TABLE "participants" ADD COLUMN "phone" text;--> statement-breakpoint
ALTER TABLE "participants" ADD COLUMN "organization" text;--> statement-breakpoint
ALTER TABLE "participant_import_jobs" ADD CONSTRAINT "participant_import_jobs_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participant_import_jobs" ADD CONSTRAINT "participant_import_jobs_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "participant_import_jobs_event_created_idx" ON "participant_import_jobs" USING btree ("event_id","created_at");--> statement-breakpoint
CREATE INDEX "participant_import_jobs_worker_idx" ON "participant_import_jobs" USING btree ("status","lock_expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "participant_import_jobs_active_event_uidx" ON "participant_import_jobs" USING btree ("event_id") WHERE "participant_import_jobs"."status" IN ('upload_pending', 'uploaded', 'validating', 'validated', 'queued', 'importing', 'partial');--> statement-breakpoint
CREATE UNIQUE INDEX "participants_managed_email_uidx" ON "participants" USING btree (lower("email")) WHERE "participants"."email" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "participants" ADD CONSTRAINT "participants_managed_contact_check" CHECK ("participants"."user_id" IS NOT NULL OR ("participants"."name" IS NOT NULL AND "participants"."email" IS NOT NULL));