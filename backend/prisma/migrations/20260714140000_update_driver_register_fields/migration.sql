ALTER TABLE "drivers"
  ADD COLUMN "serialNumber" TEXT,
  ADD COLUMN "locationText" TEXT,
  ADD COLUMN "zone" TEXT,
  ADD COLUMN "category" TEXT,
  ALTER COLUMN "licenceNumber" DROP NOT NULL;

CREATE INDEX "drivers_serialNumber_idx" ON "drivers"("serialNumber");
CREATE INDEX "drivers_category_idx" ON "drivers"("category");
