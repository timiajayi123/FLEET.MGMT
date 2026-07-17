ALTER TABLE "vehicles"
  ADD COLUMN "serialNumber" TEXT,
  ADD COLUMN "locationUser" TEXT,
  ADD COLUMN "privateRegistrationNumber" TEXT,
  ADD COLUMN "officialRegistrationNumber" TEXT,
  ADD COLUMN "purchaseCost" DOUBLE PRECISION,
  ADD COLUMN "bookedValue" DOUBLE PRECISION,
  ADD COLUMN "estimatedCost" DOUBLE PRECISION,
  ADD COLUMN "reservedPresentValue" DOUBLE PRECISION,
  ADD COLUMN "age" INTEGER,
  ADD COLUMN "serviceability" TEXT,
  ADD COLUMN "legacyAgency" TEXT,
  ADD COLUMN "chassisNumber" TEXT,
  ADD COLUMN "engineNumber" TEXT,
  ADD COLUMN "remark" TEXT,
  ADD COLUMN "faultDescription" TEXT;

CREATE INDEX "vehicles_privateRegistrationNumber_idx" ON "vehicles"("privateRegistrationNumber");
CREATE INDEX "vehicles_officialRegistrationNumber_idx" ON "vehicles"("officialRegistrationNumber");
CREATE INDEX "vehicles_chassisNumber_idx" ON "vehicles"("chassisNumber");
