CREATE TABLE "phone_numbers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"e164" text NOT NULL,
	"country" text DEFAULT 'GB' NOT NULL,
	"provider" text DEFAULT 'cloudnumbering' NOT NULL,
	"provider_ref" text,
	"status" text DEFAULT 'available' NOT NULL,
	"user_id" uuid,
	"order_id" uuid,
	"monthly_price_cents" integer,
	"assigned_at" timestamp with time zone,
	"renews_at" timestamp with time zone,
	"grace_until" timestamp with time zone,
	"auto_renew" boolean DEFAULT true NOT NULL,
	"cooldown_until" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sms_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"number_id" uuid NOT NULL,
	"user_id" uuid,
	"from_number" text NOT NULL,
	"to_number" text NOT NULL,
	"body" text NOT NULL,
	"external_id" text,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "phone_numbers" ADD CONSTRAINT "phone_numbers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "phone_numbers" ADD CONSTRAINT "phone_numbers_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sms_messages" ADD CONSTRAINT "sms_messages_number_id_phone_numbers_id_fk" FOREIGN KEY ("number_id") REFERENCES "public"."phone_numbers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sms_messages" ADD CONSTRAINT "sms_messages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "phone_numbers_e164_idx" ON "phone_numbers" USING btree ("e164");--> statement-breakpoint
CREATE INDEX "phone_numbers_user_idx" ON "phone_numbers" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sms_number_idx" ON "sms_messages" USING btree ("number_id","received_at");--> statement-breakpoint
CREATE UNIQUE INDEX "sms_external_idx" ON "sms_messages" USING btree ("external_id");