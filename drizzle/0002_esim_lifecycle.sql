CREATE TABLE "webhook_events" (
	"id" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "smdp_status" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "suspended" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "low_data_notified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "expiry_notified_at" timestamp with time zone;