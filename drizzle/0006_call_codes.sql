ALTER TABLE "call_logs" ADD COLUMN "code" text;--> statement-breakpoint
ALTER TABLE "call_logs" ADD COLUMN "notified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "call_logs" ADD COLUMN "answered_at" timestamp with time zone;