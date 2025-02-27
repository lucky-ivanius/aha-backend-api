ALTER TABLE "sessions" ADD COLUMN "is_revoked" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "sessions" DROP COLUMN "is_active";
CREATE INDEX "active_sessions_idx" ON "sessions" USING btree ("user_id","is_revoked","expires_at");