-- Add customer detail fields for OUTBOUND receipts (delivery note format)
ALTER TABLE "Receipt" ADD COLUMN "customerAddress" TEXT;
ALTER TABLE "Receipt" ADD COLUMN "customerPhone" TEXT;
