ALTER TABLE "sessions" ADD COLUMN "is_revoked" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "sessions" DROP COLUMN "is_active";