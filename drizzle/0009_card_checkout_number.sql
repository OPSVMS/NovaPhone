ALTER TABLE "card_checkouts" ADD COLUMN "number_cents" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "card_checkouts" ADD COLUMN "number_status" text;--> statement-breakpoint
ALTER TABLE "card_checkouts" ADD COLUMN "number_id" uuid;--> statement-breakpoint
ALTER TABLE "card_checkouts" ADD CONSTRAINT "card_checkouts_number_id_phone_numbers_id_fk" FOREIGN KEY ("number_id") REFERENCES "public"."phone_numbers"("id") ON DELETE no action ON UPDATE no action;