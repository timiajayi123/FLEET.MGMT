ALTER TABLE "vehicles" RENAME COLUMN "make" TO "manufacturer";
CREATE TYPE "DriverStatus" AS ENUM ('AVAILABLE','ASSIGNED','ON_LEAVE','INACTIVE');
CREATE TABLE "drivers" ("id" UUID NOT NULL,"staffName" TEXT NOT NULL,"employeeId" TEXT NOT NULL,"phone" TEXT NOT NULL,"email" TEXT,"licenceNumber" TEXT NOT NULL,"licenceClass" TEXT,"licenceExpiry" DATE,"status" "DriverStatus" NOT NULL DEFAULT 'AVAILABLE',"locationId" UUID,"passportMimeType" TEXT,"passportData" BYTEA,"createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMPTZ(3) NOT NULL,CONSTRAINT "drivers_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "drivers_employeeId_key" ON "drivers"("employeeId");
CREATE UNIQUE INDEX "drivers_licenceNumber_key" ON "drivers"("licenceNumber");
CREATE INDEX "drivers_status_staffName_idx" ON "drivers"("status","staffName");
ALTER TABLE "drivers" ADD CONSTRAINT "drivers_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE RESTRICT;
