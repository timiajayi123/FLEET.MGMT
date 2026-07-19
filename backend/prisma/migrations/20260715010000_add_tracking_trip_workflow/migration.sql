BEGIN TRY

BEGIN TRAN;

-- AlterTable
ALTER TABLE [dbo].[vehicle_allocations] DROP CONSTRAINT [vehicle_allocations_status_df];
ALTER TABLE [dbo].[vehicle_allocations] ADD CONSTRAINT [vehicle_allocations_status_df] DEFAULT 'ASSIGNED' FOR [status];
ALTER TABLE [dbo].[vehicle_allocations] ADD [actualStartAt] DATETIME2,
[assignedById] UNIQUEIDENTIFIER,
[emergencyAt] DATETIME2,
[rejectionReason] NVARCHAR(1000),
[requestId] UNIQUEIDENTIFIER;

-- AlterTable
ALTER TABLE [dbo].[driver_current_locations] ADD [altitude] FLOAT(53),
[isSimulated] BIT NOT NULL CONSTRAINT [driver_current_locations_isSimulated_df] DEFAULT 0,
[receivedAt] DATETIME2 NOT NULL CONSTRAINT [driver_current_locations_receivedAt_df] DEFAULT CURRENT_TIMESTAMP,
[trackingSource] NVARCHAR(1000) NOT NULL CONSTRAINT [driver_current_locations_trackingSource_df] DEFAULT 'PHONE_GPS',
[tripId] UNIQUEIDENTIFIER;

-- AlterTable
ALTER TABLE [dbo].[driver_location_history] ADD [altitude] FLOAT(53),
[clientEventId] NVARCHAR(1000) NOT NULL,
[isSimulated] BIT NOT NULL CONSTRAINT [driver_location_history_isSimulated_df] DEFAULT 0,
[receivedAt] DATETIME2 NOT NULL CONSTRAINT [driver_location_history_receivedAt_df] DEFAULT CURRENT_TIMESTAMP,
[tripId] UNIQUEIDENTIFIER;

-- CreateTable
CREATE TABLE [dbo].[trips] (
    [id] UNIQUEIDENTIFIER NOT NULL,
    [allocationId] UNIQUEIDENTIFIER NOT NULL,
    [requestId] UNIQUEIDENTIFIER,
    [vehicleId] UNIQUEIDENTIFIER NOT NULL,
    [driverId] UNIQUEIDENTIFIER NOT NULL,
    [startLatitude] FLOAT(53),
    [startLongitude] FLOAT(53),
    [endLatitude] FLOAT(53),
    [endLongitude] FLOAT(53),
    [startedAt] DATETIME2,
    [endedAt] DATETIME2,
    [calculatedDistance] FLOAT(53),
    [maximumSpeed] FLOAT(53),
    [averageSpeed] FLOAT(53),
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [trips_status_df] DEFAULT 'NOT_STARTED',
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [trips_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [trips_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [trips_allocationId_key] UNIQUE NONCLUSTERED ([allocationId])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [trips_status_startedAt_idx] ON [dbo].[trips]([status], [startedAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [trips_vehicleId_startedAt_idx] ON [dbo].[trips]([vehicleId], [startedAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [trips_driverId_startedAt_idx] ON [dbo].[trips]([driverId], [startedAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [trips_requestId_idx] ON [dbo].[trips]([requestId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [vehicle_allocations_requestId_status_idx] ON [dbo].[vehicle_allocations]([requestId], [status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [vehicle_allocations_assignedById_idx] ON [dbo].[vehicle_allocations]([assignedById]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [driver_current_locations_vehicleId_recordedAt_idx] ON [dbo].[driver_current_locations]([vehicleId], [recordedAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [driver_current_locations_allocationId_idx] ON [dbo].[driver_current_locations]([allocationId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [driver_current_locations_tripId_idx] ON [dbo].[driver_current_locations]([tripId]);

-- CreateIndex
ALTER TABLE [dbo].[driver_location_history] ADD CONSTRAINT [driver_location_history_clientEventId_key] UNIQUE NONCLUSTERED ([clientEventId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [driver_location_history_vehicleId_recordedAt_idx] ON [dbo].[driver_location_history]([vehicleId], [recordedAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [driver_location_history_tripId_recordedAt_idx] ON [dbo].[driver_location_history]([tripId], [recordedAt]);

-- AddForeignKey
ALTER TABLE [dbo].[vehicle_allocations] ADD CONSTRAINT [vehicle_allocations_requestId_fkey] FOREIGN KEY ([requestId]) REFERENCES [dbo].[vehicle_requests]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[vehicle_allocations] ADD CONSTRAINT [vehicle_allocations_assignedById_fkey] FOREIGN KEY ([assignedById]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[driver_current_locations] ADD CONSTRAINT [driver_current_locations_tripId_fkey] FOREIGN KEY ([tripId]) REFERENCES [dbo].[trips]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[driver_location_history] ADD CONSTRAINT [driver_location_history_tripId_fkey] FOREIGN KEY ([tripId]) REFERENCES [dbo].[trips]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[trips] ADD CONSTRAINT [trips_allocationId_fkey] FOREIGN KEY ([allocationId]) REFERENCES [dbo].[vehicle_allocations]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[trips] ADD CONSTRAINT [trips_requestId_fkey] FOREIGN KEY ([requestId]) REFERENCES [dbo].[vehicle_requests]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[trips] ADD CONSTRAINT [trips_vehicleId_fkey] FOREIGN KEY ([vehicleId]) REFERENCES [dbo].[vehicles]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[trips] ADD CONSTRAINT [trips_driverId_fkey] FOREIGN KEY ([driverId]) REFERENCES [dbo].[drivers]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
