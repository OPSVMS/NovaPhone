CREATE TABLE "call_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"number_id" uuid NOT NULL,
	"user_id" uuid,
	"from_number" text NOT NULL,
	"to_number" text NOT NULL,
	"direction" text DEFAULT 'inbound' NOT NULL,
	"status" text DEFAULT 'missed' NOT NULL,
	"duration_sec" integer DEFAULT 0 NOT NULL,
	"transcript" text,
	"external_id" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "call_logs" ADD CONSTRAINT "call_logs_number_id_phone_numbers_id_fk" FOREIGN KEY ("number_id") REFERENCES "public"."phone_numbers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "call_logs" ADD CONSTRAINT "call_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "calls_number_idx" ON "call_logs" USING btree ("number_id","started_at");--> statement-breakpoint
CREATE UNIQUE INDEX "calls_external_idx" ON "call_logs" USING btree ("external_id");