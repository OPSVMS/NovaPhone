CREATE TABLE "topups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"plan_id" text NOT NULL,
	"plan_name" text NOT NULL,
	"price_cents" integer NOT NULL,
	"cost_usd" numeric NOT NULL,
	"auto" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"provider_txn" text,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "activated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "usage_synced_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "auto_topup_plan_id" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "auto_topup_last_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "low_balance_notified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "clabe" text;--> statement-breakpoint
ALTER TABLE "topups" ADD CONSTRAINT "topups_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topups" ADD CONSTRAINT "topups_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "topups_order_idx" ON "topups" USING btree ("order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_clabe_idx" ON "users" USING btree ("clabe");