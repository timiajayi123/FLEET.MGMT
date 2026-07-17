CREATE TYPE "VehicleStatus" AS ENUM ('AVAILABLE','IN_USE','RESERVED','MAINTENANCE','OUT_OF_SERVICE');
ALTER TABLE "users" ADD COLUMN "passportMimeType" TEXT, ADD COLUMN "passportData" BYTEA;
CREATE TABLE "vehicles" (
  "id" UUID NOT NULL, "registrationNumber" TEXT NOT NULL, "make" TEXT NOT NULL, "model" TEXT NOT NULL,
  "year" INTEGER, "color" TEXT, "status" "VehicleStatus" NOT NULL DEFAULT 'AVAILABLE', "locationId" UUID,
  "vehicleTypeId" UUID, "imageMimeType" TEXT, "imageData" BYTEA, "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL, CONSTRAINT "vehicles_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "vehicles_registrationNumber_key" ON "vehicles"("registrationNumber");
CREATE INDEX "vehicles_status_registrationNumber_idx" ON "vehicles"("status","registrationNumber");
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE RESTRICT;
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_vehicleTypeId_fkey" FOREIGN KEY ("vehicleTypeId") REFERENCES "vehicle_types"("id") ON DELETE RESTRICT;
