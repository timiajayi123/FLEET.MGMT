CREATE TYPE "AllocationStatus" AS ENUM ('ACTIVE','COMPLETED','CANCELLED');
CREATE TABLE "vehicle_allocations" ("id" UUID NOT NULL,"vehicleId" UUID NOT NULL,"driverId" UUID NOT NULL,"purpose" TEXT NOT NULL,"destination" TEXT,"startAt" TIMESTAMPTZ(3) NOT NULL,"expectedEndAt" TIMESTAMPTZ(3) NOT NULL,"actualEndAt" TIMESTAMPTZ(3),"status" "AllocationStatus" NOT NULL DEFAULT 'ACTIVE',"notes" TEXT,"createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMPTZ(3) NOT NULL,CONSTRAINT "vehicle_allocations_pkey" PRIMARY KEY ("id"));
CREATE INDEX "vehicle_allocations_status_startAt_idx" ON "vehicle_allocations"("status","startAt");
CREATE INDEX "vehicle_allocations_vehicleId_status_idx" ON "vehicle_allocations"("vehicleId","status");
CREATE INDEX "vehicle_allocations_driverId_status_idx" ON "vehicle_allocations"("driverId","status");
ALTER TABLE "vehicle_allocations" ADD CONSTRAINT "vehicle_allocations_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE RESTRICT;
ALTER TABLE "vehicle_allocations" ADD CONSTRAINT "vehicle_allocations_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "drivers"("id") ON DELETE RESTRICT;
