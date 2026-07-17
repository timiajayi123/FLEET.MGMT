-- CreateEnum
CREATE TYPE "MasterDataStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateTable
CREATE TABLE "directorates" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "MasterDataStatus" NOT NULL DEFAULT 'ACTIVE',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "directorates_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "departments" (
    "id" UUID NOT NULL,
    "directorateId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "MasterDataStatus" NOT NULL DEFAULT 'ACTIVE',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "units" (
    "id" UUID NOT NULL,
    "departmentId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "MasterDataStatus" NOT NULL DEFAULT 'ACTIVE',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "units_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "locations" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "state" TEXT,
    "description" TEXT,
    "status" "MasterDataStatus" NOT NULL DEFAULT 'ACTIVE',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "locations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "vehicle_types" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "passengerCapacity" INTEGER,
    "status" "MasterDataStatus" NOT NULL DEFAULT 'ACTIVE',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "vehicle_types_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "vehicle_types_capacity_check" CHECK ("passengerCapacity" IS NULL OR "passengerCapacity" > 0)
);

CREATE TABLE "roles" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isSystemRole" BOOLEAN NOT NULL DEFAULT false,
    "status" "MasterDataStatus" NOT NULL DEFAULT 'ACTIVE',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- Add master-data references while retaining text snapshots for request history.
ALTER TABLE "vehicle_requests"
    ADD COLUMN "locationId" UUID,
    ADD COLUMN "directorateId" UUID,
    ADD COLUMN "departmentId" UUID,
    ADD COLUMN "unitId" UUID,
    ADD COLUMN "vehicleTypeId" UUID,
    ADD COLUMN "vehicleTypeName" TEXT;

UPDATE "vehicle_requests" SET "vehicleTypeName" = "vehicleType"::TEXT;
ALTER TABLE "vehicle_requests" ALTER COLUMN "vehicleTypeName" SET NOT NULL;
ALTER TABLE "vehicle_requests" ALTER COLUMN "locationId" SET NOT NULL;
ALTER TABLE "vehicle_requests" ALTER COLUMN "directorateId" SET NOT NULL;
ALTER TABLE "vehicle_requests" ALTER COLUMN "departmentId" SET NOT NULL;
ALTER TABLE "vehicle_requests" ALTER COLUMN "unitId" SET NOT NULL;
ALTER TABLE "vehicle_requests" ALTER COLUMN "vehicleTypeId" SET NOT NULL;
ALTER TABLE "vehicle_requests" DROP COLUMN "vehicleType";
DROP TYPE "VehicleType";

-- Unique and lookup indexes.
CREATE UNIQUE INDEX "directorates_code_key" ON "directorates"("code");
CREATE UNIQUE INDEX "directorates_name_key" ON "directorates"("name");
CREATE INDEX "directorates_status_sortOrder_name_idx" ON "directorates"("status", "sortOrder", "name");
CREATE UNIQUE INDEX "departments_code_key" ON "departments"("code");
CREATE UNIQUE INDEX "departments_directorateId_name_key" ON "departments"("directorateId", "name");
CREATE INDEX "departments_directorateId_status_sortOrder_name_idx" ON "departments"("directorateId", "status", "sortOrder", "name");
CREATE UNIQUE INDEX "units_code_key" ON "units"("code");
CREATE UNIQUE INDEX "units_departmentId_name_key" ON "units"("departmentId", "name");
CREATE INDEX "units_departmentId_status_sortOrder_name_idx" ON "units"("departmentId", "status", "sortOrder", "name");
CREATE UNIQUE INDEX "locations_code_key" ON "locations"("code");
CREATE UNIQUE INDEX "locations_name_key" ON "locations"("name");
CREATE INDEX "locations_status_sortOrder_name_idx" ON "locations"("status", "sortOrder", "name");
CREATE UNIQUE INDEX "vehicle_types_code_key" ON "vehicle_types"("code");
CREATE UNIQUE INDEX "vehicle_types_name_key" ON "vehicle_types"("name");
CREATE INDEX "vehicle_types_status_sortOrder_name_idx" ON "vehicle_types"("status", "sortOrder", "name");
CREATE UNIQUE INDEX "roles_code_key" ON "roles"("code");
CREATE UNIQUE INDEX "roles_name_key" ON "roles"("name");
CREATE INDEX "roles_status_sortOrder_name_idx" ON "roles"("status", "sortOrder", "name");
CREATE INDEX "vehicle_requests_locationId_idx" ON "vehicle_requests"("locationId");
CREATE INDEX "vehicle_requests_directorateId_idx" ON "vehicle_requests"("directorateId");
CREATE INDEX "vehicle_requests_departmentId_idx" ON "vehicle_requests"("departmentId");
CREATE INDEX "vehicle_requests_unitId_idx" ON "vehicle_requests"("unitId");
CREATE INDEX "vehicle_requests_vehicleTypeId_idx" ON "vehicle_requests"("vehicleTypeId");

-- Foreign keys are restrictive so referenced master data is deactivated, not deleted.
ALTER TABLE "departments" ADD CONSTRAINT "departments_directorateId_fkey" FOREIGN KEY ("directorateId") REFERENCES "directorates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "units" ADD CONSTRAINT "units_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "vehicle_requests" ADD CONSTRAINT "vehicle_requests_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "vehicle_requests" ADD CONSTRAINT "vehicle_requests_directorateId_fkey" FOREIGN KEY ("directorateId") REFERENCES "directorates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "vehicle_requests" ADD CONSTRAINT "vehicle_requests_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "vehicle_requests" ADD CONSTRAINT "vehicle_requests_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "vehicle_requests" ADD CONSTRAINT "vehicle_requests_vehicleTypeId_fkey" FOREIGN KEY ("vehicleTypeId") REFERENCES "vehicle_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
