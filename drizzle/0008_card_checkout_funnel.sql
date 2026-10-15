CREATE TABLE "card_checkouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"plan_id" text NOT NULL,
	"plan_name" text NOT NULL,
	"price_cents" integer NOT NULL,
	"cost_usd" numeric NOT NULL,
	"access_token" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"provider" text DEFAULT 'stripe' NOT NULL,
	"payment_ref" text,
	"payment_intent_id" text,
	"email" text,
	"amount_paid_cents" integer,
	"currency" text,
	"promotion_code" text,
	"discount_cents" integer,
	"receipt_url" text,
	"order_id" uuid,
	"deposit_id" uuid,
	"attribution" jsonb,
	"flagged_at" timestamp with time zone,
	"flag_reason" text,
	"refunded_cents" integer DEFAULT 0 NOT NULL,
	"error" text,
	"paid_at" timestamp with time zone,
	"fulfilled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "funnel_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ts" timestamp with time zone DEFAULT now() NOT NULL,
	"event" text NOT NULL,
	"path" text,
	"device" text,
	"country" text,
	"ads" boolean DEFAULT false NOT NULL,
	"campaign" text,
	"term" text,
	"visitor" text,
	"props" jsonb
);
--> statement-breakpoint
ALTER TABLE "admin_audit" ALTER COLUMN "admin_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "card_checkouts" ADD CONSTRAINT "card_checkouts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "card_checkouts" ADD CONSTRAINT "card_checkouts_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "card_checkouts" ADD CONSTRAINT "card_checkouts_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "card_checkouts" ADD CONSTRAINT "card_checkouts_deposit_id_deposits_id_fk" FOREIGN KEY ("deposit_id") REFERENCES "public"."deposits"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "card_checkouts_payment_ref_idx" ON "card_checkouts" USING btree ("payment_ref");--> statement-breakpoint
CREATE INDEX "card_checkouts_pi_idx" ON "card_checkouts" USING btree ("payment_intent_id");--> statement-breakpoint
CREATE INDEX "card_checkouts_user_idx" ON "card_checkouts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "card_checkouts_created_idx" ON "card_checkouts" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "funnel_events_ts_idx" ON "funnel_events" USING btree ("ts");--> statement-breakpoint
CREATE INDEX "funnel_events_visitor_idx" ON "funnel_events" USING btree ("visitor","ts");--> statement-breakpoint
-- Datos: el plan de 50 GB deja de venderse (la sincronización del catálogo ya no lo reactiva).
UPDATE "plans" SET "active" = false WHERE "data_gb" >= 50;
