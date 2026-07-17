-- CreateEnum
CREATE TYPE "VehicleRequestStatus" AS ENUM ('PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "VehicleType" AS ENUM ('SEDAN', 'SUV', 'VAN', 'BUS', 'PICKUP_TRUCK', 'OTHER');

-- CreateEnum
CREATE TYPE "RequestPriority" AS ENUM ('NORMAL', 'HIGH', 'URGENT');

-- CreateTable
CREATE TABLE "vehicle_requests" (
    "id" UUID NOT NULL,
    "requestNumber" TEXT NOT NULL,
    "staffName" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "directorate" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "purposeOfTrip" TEXT NOT NULL,
    "vehicleType" "VehicleType" NOT NULL,
    "destination" TEXT NOT NULL,
    "departureDate" TIMESTAMPTZ(3) NOT NULL,
    "expectedReturnDate" TIMESTAMPTZ(3) NOT NULL,
    "numberOfPassengers" INTEGER NOT NULL,
    "priority" "RequestPriority" NOT NULL,
    "remarks" TEXT,
    "attachmentFileName" TEXT,
    "attachmentMimeType" TEXT,
    "attachmentSizeBytes" INTEGER,
    "attachmentData" BYTEA,
    "status" "VehicleRequestStatus" NOT NULL DEFAULT 'PENDING_APPROVAL',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "vehicle_requests_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "vehicle_requests_passenger_count_check" CHECK ("numberOfPassengers" > 0),
    CONSTRAINT "vehicle_requests_date_order_check" CHECK ("expectedReturnDate" > "departureDate"),
    CONSTRAINT "vehicle_requests_attachment_size_check" CHECK ("attachmentSizeBytes" IS NULL OR "attachmentSizeBytes" BETWEEN 1 AND 10485760),
    CONSTRAINT "vehicle_requests_attachment_consistency_check" CHECK (
        ("attachmentData" IS NULL AND "attachmentFileName" IS NULL AND "attachmentMimeType" IS NULL AND "attachmentSizeBytes" IS NULL)
        OR
        ("attachmentData" IS NOT NULL AND "attachmentFileName" IS NOT NULL AND "attachmentMimeType" IS NOT NULL AND "attachmentSizeBytes" IS NOT NULL)
    )
);

-- CreateIndex
CREATE UNIQUE INDEX "vehicle_requests_requestNumber_key" ON "vehicle_requests"("requestNumber");

-- CreateIndex
CREATE INDEX "vehicle_requests_status_departureDate_idx" ON "vehicle_requests"("status", "departureDate");

-- CreateIndex
CREATE INDEX "vehicle_requests_employeeId_createdAt_idx" ON "vehicle_requests"("employeeId", "createdAt");
