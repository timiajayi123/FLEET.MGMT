BEGIN TRY

BEGIN TRAN;

-- CreateSchema
IF NOT EXISTS (SELECT * FROM sys.schemas WHERE name = N'dbo') EXEC sp_executesql N'CREATE SCHEMA [dbo];';

-- CreateTable
CREATE TABLE [dbo].[directorates] (
    [id] UNIQUEIDENTIFIER NOT NULL,
    [code] NVARCHAR(1000) NOT NULL,
    [name] NVARCHAR(1000) NOT NULL,
    [description] NVARCHAR(1000),
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [directorates_status_df] DEFAULT 'ACTIVE',
    [sortOrder] INT NOT NULL CONSTRAINT [directorates_sortOrder_df] DEFAULT 0,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [directorates_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [directorates_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [directorates_code_key] UNIQUE NONCLUSTERED ([code]),
    CONSTRAINT [directorates_name_key] UNIQUE NONCLUSTERED ([name])
);

-- CreateTable
CREATE TABLE [dbo].[departments] (
    [id] UNIQUEIDENTIFIER NOT NULL,
    [directorateId] UNIQUEIDENTIFIER NOT NULL,
    [code] NVARCHAR(1000) NOT NULL,
    [name] NVARCHAR(1000) NOT NULL,
    [description] NVARCHAR(1000),
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [departments_status_df] DEFAULT 'ACTIVE',
    [sortOrder] INT NOT NULL CONSTRAINT [departments_sortOrder_df] DEFAULT 0,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [departments_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [departments_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [departments_code_key] UNIQUE NONCLUSTERED ([code]),
    CONSTRAINT [departments_directorateId_name_key] UNIQUE NONCLUSTERED ([directorateId],[name])
);

-- CreateTable
CREATE TABLE [dbo].[units] (
    [id] UNIQUEIDENTIFIER NOT NULL,
    [departmentId] UNIQUEIDENTIFIER NOT NULL,
    [code] NVARCHAR(1000) NOT NULL,
    [name] NVARCHAR(1000) NOT NULL,
    [description] NVARCHAR(1000),
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [units_status_df] DEFAULT 'ACTIVE',
    [sortOrder] INT NOT NULL CONSTRAINT [units_sortOrder_df] DEFAULT 0,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [units_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [units_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [units_code_key] UNIQUE NONCLUSTERED ([code]),
    CONSTRAINT [units_departmentId_name_key] UNIQUE NONCLUSTERED ([departmentId],[name])
);

-- CreateTable
CREATE TABLE [dbo].[locations] (
    [id] UNIQUEIDENTIFIER NOT NULL,
    [code] NVARCHAR(1000) NOT NULL,
    [name] NVARCHAR(1000) NOT NULL,
    [address] NVARCHAR(1000),
    [state] NVARCHAR(1000),
    [latitude] FLOAT(53),
    [longitude] FLOAT(53),
    [description] NVARCHAR(1000),
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [locations_status_df] DEFAULT 'ACTIVE',
    [sortOrder] INT NOT NULL CONSTRAINT [locations_sortOrder_df] DEFAULT 0,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [locations_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [locations_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [locations_code_key] UNIQUE NONCLUSTERED ([code]),
    CONSTRAINT [locations_name_key] UNIQUE NONCLUSTERED ([name])
);

-- CreateTable
CREATE TABLE [dbo].[vehicle_types] (
    [id] UNIQUEIDENTIFIER NOT NULL,
    [code] NVARCHAR(1000) NOT NULL,
    [name] NVARCHAR(1000) NOT NULL,
    [description] NVARCHAR(1000),
    [passengerCapacity] INT,
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [vehicle_types_status_df] DEFAULT 'ACTIVE',
    [sortOrder] INT NOT NULL CONSTRAINT [vehicle_types_sortOrder_df] DEFAULT 0,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [vehicle_types_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [vehicle_types_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [vehicle_types_code_key] UNIQUE NONCLUSTERED ([code]),
    CONSTRAINT [vehicle_types_name_key] UNIQUE NONCLUSTERED ([name])
);

-- CreateTable
CREATE TABLE [dbo].[roles] (
    [id] UNIQUEIDENTIFIER NOT NULL,
    [code] NVARCHAR(1000) NOT NULL,
    [name] NVARCHAR(1000) NOT NULL,
    [description] NVARCHAR(1000),
    [isSystemRole] BIT NOT NULL CONSTRAINT [roles_isSystemRole_df] DEFAULT 0,
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [roles_status_df] DEFAULT 'ACTIVE',
    [sortOrder] INT NOT NULL CONSTRAINT [roles_sortOrder_df] DEFAULT 0,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [roles_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [roles_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [roles_code_key] UNIQUE NONCLUSTERED ([code]),
    CONSTRAINT [roles_name_key] UNIQUE NONCLUSTERED ([name])
);

-- CreateTable
CREATE TABLE [dbo].[users] (
    [id] UNIQUEIDENTIFIER NOT NULL,
    [email] NVARCHAR(1000) NOT NULL,
    [passwordHash] NVARCHAR(1000) NOT NULL,
    [staffName] NVARCHAR(1000) NOT NULL,
    [employeeId] NVARCHAR(1000) NOT NULL,
    [phone] NVARCHAR(1000),
    [passportMimeType] NVARCHAR(1000),
    [passportData] VARBINARY(max),
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [users_status_df] DEFAULT 'ACTIVE',
    [roleId] UNIQUEIDENTIFIER NOT NULL,
    [locationId] UNIQUEIDENTIFIER,
    [directorateId] UNIQUEIDENTIFIER,
    [departmentId] UNIQUEIDENTIFIER,
    [unitId] UNIQUEIDENTIFIER,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [users_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [users_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [users_email_key] UNIQUE NONCLUSTERED ([email]),
    CONSTRAINT [users_employeeId_key] UNIQUE NONCLUSTERED ([employeeId])
);

-- CreateTable
CREATE TABLE [dbo].[vehicles] (
    [id] UNIQUEIDENTIFIER NOT NULL,
    [registrationNumber] NVARCHAR(1000) NOT NULL,
    [serialNumber] NVARCHAR(1000),
    [locationUser] NVARCHAR(1000),
    [privateRegistrationNumber] NVARCHAR(1000),
    [officialRegistrationNumber] NVARCHAR(1000),
    [manufacturer] NVARCHAR(1000) NOT NULL,
    [model] NVARCHAR(1000) NOT NULL,
    [year] INT,
    [purchaseCost] NVARCHAR(1000),
    [bookedValue] NVARCHAR(1000),
    [estimatedCost] NVARCHAR(1000),
    [reservedPresentValue] NVARCHAR(1000),
    [age] NVARCHAR(1000),
    [serviceability] NVARCHAR(1000),
    [legacyAgency] NVARCHAR(1000),
    [chassisNumber] NVARCHAR(1000),
    [engineNumber] NVARCHAR(1000),
    [remark] NVARCHAR(1000),
    [faultDescription] NVARCHAR(1000),
    [color] NVARCHAR(1000),
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [vehicles_status_df] DEFAULT 'AVAILABLE',
    [locationId] UNIQUEIDENTIFIER,
    [vehicleTypeId] UNIQUEIDENTIFIER,
    [imageMimeType] NVARCHAR(1000),
    [imageData] VARBINARY(max),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [vehicles_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [vehicles_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [vehicles_registrationNumber_key] UNIQUE NONCLUSTERED ([registrationNumber])
);

-- CreateTable
CREATE TABLE [dbo].[drivers] (
    [id] UNIQUEIDENTIFIER NOT NULL,
    [serialNumber] NVARCHAR(1000),
    [staffName] NVARCHAR(1000) NOT NULL,
    [employeeId] NVARCHAR(1000) NOT NULL,
    [locationText] NVARCHAR(1000),
    [zone] NVARCHAR(1000),
    [category] NVARCHAR(1000),
    [phone] NVARCHAR(1000) NOT NULL,
    [email] NVARCHAR(1000),
    [licenceNumber] NVARCHAR(1000),
    [licenceClass] NVARCHAR(1000),
    [licenceExpiry] DATE,
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [drivers_status_df] DEFAULT 'AVAILABLE',
    [locationId] UNIQUEIDENTIFIER,
    [passportMimeType] NVARCHAR(1000),
    [passportData] VARBINARY(max),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [drivers_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [drivers_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [drivers_employeeId_key] UNIQUE NONCLUSTERED ([employeeId]),
    CONSTRAINT [drivers_licenceNumber_key] UNIQUE NONCLUSTERED ([licenceNumber])
);

-- CreateTable
CREATE TABLE [dbo].[vehicle_allocations] (
    [id] UNIQUEIDENTIFIER NOT NULL,
    [vehicleId] UNIQUEIDENTIFIER NOT NULL,
    [driverId] UNIQUEIDENTIFIER NOT NULL,
    [purpose] NVARCHAR(1000) NOT NULL,
    [destination] NVARCHAR(1000),
    [startAt] DATETIME2 NOT NULL,
    [expectedEndAt] DATETIME2 NOT NULL,
    [actualEndAt] DATETIME2,
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [vehicle_allocations_status_df] DEFAULT 'ACTIVE',
    [notes] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [vehicle_allocations_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [vehicle_allocations_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[driver_current_locations] (
    [id] UNIQUEIDENTIFIER NOT NULL,
    [driverId] UNIQUEIDENTIFIER NOT NULL,
    [vehicleId] UNIQUEIDENTIFIER,
    [allocationId] UNIQUEIDENTIFIER,
    [latitude] FLOAT(53) NOT NULL,
    [longitude] FLOAT(53) NOT NULL,
    [accuracy] FLOAT(53),
    [speed] FLOAT(53),
    [heading] FLOAT(53),
    [recordedAt] DATETIME2 NOT NULL,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [driver_current_locations_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [driver_current_locations_driverId_key] UNIQUE NONCLUSTERED ([driverId])
);

-- CreateTable
CREATE TABLE [dbo].[driver_location_history] (
    [id] UNIQUEIDENTIFIER NOT NULL,
    [driverId] UNIQUEIDENTIFIER NOT NULL,
    [vehicleId] UNIQUEIDENTIFIER,
    [allocationId] UNIQUEIDENTIFIER,
    [latitude] FLOAT(53) NOT NULL,
    [longitude] FLOAT(53) NOT NULL,
    [accuracy] FLOAT(53),
    [speed] FLOAT(53),
    [heading] FLOAT(53),
    [recordedAt] DATETIME2 NOT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [driver_location_history_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [driver_location_history_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[sessions] (
    [id] UNIQUEIDENTIFIER NOT NULL,
    [tokenHash] NVARCHAR(1000) NOT NULL,
    [userId] UNIQUEIDENTIFIER NOT NULL,
    [expiresAt] DATETIME2 NOT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [sessions_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [sessions_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [sessions_tokenHash_key] UNIQUE NONCLUSTERED ([tokenHash])
);

-- CreateTable
CREATE TABLE [dbo].[vehicle_requests] (
    [id] UNIQUEIDENTIFIER NOT NULL,
    [requestNumber] NVARCHAR(1000) NOT NULL,
    [staffName] NVARCHAR(1000) NOT NULL,
    [employeeId] NVARCHAR(1000) NOT NULL,
    [locationId] UNIQUEIDENTIFIER NOT NULL,
    [directorateId] UNIQUEIDENTIFIER NOT NULL,
    [departmentId] UNIQUEIDENTIFIER NOT NULL,
    [unitId] UNIQUEIDENTIFIER NOT NULL,
    [vehicleTypeId] UNIQUEIDENTIFIER NOT NULL,
    [requesterId] UNIQUEIDENTIFIER,
    [location] NVARCHAR(1000) NOT NULL,
    [directorate] NVARCHAR(1000) NOT NULL,
    [department] NVARCHAR(1000) NOT NULL,
    [unit] NVARCHAR(1000) NOT NULL,
    [purposeOfTrip] NVARCHAR(1000) NOT NULL,
    [vehicleTypeName] NVARCHAR(1000) NOT NULL,
    [destination] NVARCHAR(1000) NOT NULL,
    [departureDate] DATETIME2 NOT NULL,
    [expectedReturnDate] DATETIME2 NOT NULL,
    [numberOfPassengers] INT NOT NULL,
    [priority] NVARCHAR(1000) NOT NULL,
    [remarks] NVARCHAR(1000),
    [attachmentFileName] NVARCHAR(1000),
    [attachmentMimeType] NVARCHAR(1000),
    [attachmentSizeBytes] INT,
    [attachmentData] VARBINARY(max),
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [vehicle_requests_status_df] DEFAULT 'PENDING_APPROVAL',
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [vehicle_requests_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [vehicle_requests_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [vehicle_requests_requestNumber_key] UNIQUE NONCLUSTERED ([requestNumber])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [directorates_status_sortOrder_name_idx] ON [dbo].[directorates]([status], [sortOrder], [name]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [departments_directorateId_status_sortOrder_name_idx] ON [dbo].[departments]([directorateId], [status], [sortOrder], [name]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [units_departmentId_status_sortOrder_name_idx] ON [dbo].[units]([departmentId], [status], [sortOrder], [name]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [locations_status_sortOrder_name_idx] ON [dbo].[locations]([status], [sortOrder], [name]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [vehicle_types_status_sortOrder_name_idx] ON [dbo].[vehicle_types]([status], [sortOrder], [name]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [roles_status_sortOrder_name_idx] ON [dbo].[roles]([status], [sortOrder], [name]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [users_status_staffName_idx] ON [dbo].[users]([status], [staffName]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [users_roleId_idx] ON [dbo].[users]([roleId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [vehicles_status_registrationNumber_idx] ON [dbo].[vehicles]([status], [registrationNumber]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [drivers_status_staffName_idx] ON [dbo].[drivers]([status], [staffName]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [vehicle_allocations_status_startAt_idx] ON [dbo].[vehicle_allocations]([status], [startAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [vehicle_allocations_vehicleId_status_idx] ON [dbo].[vehicle_allocations]([vehicleId], [status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [vehicle_allocations_driverId_status_idx] ON [dbo].[vehicle_allocations]([driverId], [status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [driver_current_locations_recordedAt_idx] ON [dbo].[driver_current_locations]([recordedAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [driver_location_history_driverId_recordedAt_idx] ON [dbo].[driver_location_history]([driverId], [recordedAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [driver_location_history_allocationId_recordedAt_idx] ON [dbo].[driver_location_history]([allocationId], [recordedAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [sessions_userId_idx] ON [dbo].[sessions]([userId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [sessions_expiresAt_idx] ON [dbo].[sessions]([expiresAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [vehicle_requests_status_departureDate_idx] ON [dbo].[vehicle_requests]([status], [departureDate]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [vehicle_requests_employeeId_createdAt_idx] ON [dbo].[vehicle_requests]([employeeId], [createdAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [vehicle_requests_locationId_idx] ON [dbo].[vehicle_requests]([locationId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [vehicle_requests_directorateId_idx] ON [dbo].[vehicle_requests]([directorateId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [vehicle_requests_departmentId_idx] ON [dbo].[vehicle_requests]([departmentId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [vehicle_requests_unitId_idx] ON [dbo].[vehicle_requests]([unitId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [vehicle_requests_vehicleTypeId_idx] ON [dbo].[vehicle_requests]([vehicleTypeId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [vehicle_requests_requesterId_idx] ON [dbo].[vehicle_requests]([requesterId]);

-- AddForeignKey
ALTER TABLE [dbo].[departments] ADD CONSTRAINT [departments_directorateId_fkey] FOREIGN KEY ([directorateId]) REFERENCES [dbo].[directorates]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[units] ADD CONSTRAINT [units_departmentId_fkey] FOREIGN KEY ([departmentId]) REFERENCES [dbo].[departments]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[users] ADD CONSTRAINT [users_roleId_fkey] FOREIGN KEY ([roleId]) REFERENCES [dbo].[roles]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[users] ADD CONSTRAINT [users_locationId_fkey] FOREIGN KEY ([locationId]) REFERENCES [dbo].[locations]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[users] ADD CONSTRAINT [users_directorateId_fkey] FOREIGN KEY ([directorateId]) REFERENCES [dbo].[directorates]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[users] ADD CONSTRAINT [users_departmentId_fkey] FOREIGN KEY ([departmentId]) REFERENCES [dbo].[departments]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[users] ADD CONSTRAINT [users_unitId_fkey] FOREIGN KEY ([unitId]) REFERENCES [dbo].[units]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[vehicles] ADD CONSTRAINT [vehicles_locationId_fkey] FOREIGN KEY ([locationId]) REFERENCES [dbo].[locations]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[vehicles] ADD CONSTRAINT [vehicles_vehicleTypeId_fkey] FOREIGN KEY ([vehicleTypeId]) REFERENCES [dbo].[vehicle_types]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[drivers] ADD CONSTRAINT [drivers_locationId_fkey] FOREIGN KEY ([locationId]) REFERENCES [dbo].[locations]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[vehicle_allocations] ADD CONSTRAINT [vehicle_allocations_vehicleId_fkey] FOREIGN KEY ([vehicleId]) REFERENCES [dbo].[vehicles]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[vehicle_allocations] ADD CONSTRAINT [vehicle_allocations_driverId_fkey] FOREIGN KEY ([driverId]) REFERENCES [dbo].[drivers]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[driver_current_locations] ADD CONSTRAINT [driver_current_locations_driverId_fkey] FOREIGN KEY ([driverId]) REFERENCES [dbo].[drivers]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[driver_current_locations] ADD CONSTRAINT [driver_current_locations_vehicleId_fkey] FOREIGN KEY ([vehicleId]) REFERENCES [dbo].[vehicles]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[driver_current_locations] ADD CONSTRAINT [driver_current_locations_allocationId_fkey] FOREIGN KEY ([allocationId]) REFERENCES [dbo].[vehicle_allocations]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[driver_location_history] ADD CONSTRAINT [driver_location_history_driverId_fkey] FOREIGN KEY ([driverId]) REFERENCES [dbo].[drivers]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[driver_location_history] ADD CONSTRAINT [driver_location_history_vehicleId_fkey] FOREIGN KEY ([vehicleId]) REFERENCES [dbo].[vehicles]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[driver_location_history] ADD CONSTRAINT [driver_location_history_allocationId_fkey] FOREIGN KEY ([allocationId]) REFERENCES [dbo].[vehicle_allocations]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[sessions] ADD CONSTRAINT [sessions_userId_fkey] FOREIGN KEY ([userId]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[vehicle_requests] ADD CONSTRAINT [vehicle_requests_locationId_fkey] FOREIGN KEY ([locationId]) REFERENCES [dbo].[locations]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[vehicle_requests] ADD CONSTRAINT [vehicle_requests_directorateId_fkey] FOREIGN KEY ([directorateId]) REFERENCES [dbo].[directorates]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[vehicle_requests] ADD CONSTRAINT [vehicle_requests_departmentId_fkey] FOREIGN KEY ([departmentId]) REFERENCES [dbo].[departments]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[vehicle_requests] ADD CONSTRAINT [vehicle_requests_unitId_fkey] FOREIGN KEY ([unitId]) REFERENCES [dbo].[units]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[vehicle_requests] ADD CONSTRAINT [vehicle_requests_vehicleTypeId_fkey] FOREIGN KEY ([vehicleTypeId]) REFERENCES [dbo].[vehicle_types]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[vehicle_requests] ADD CONSTRAINT [vehicle_requests_requesterId_fkey] FOREIGN KEY ([requesterId]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
