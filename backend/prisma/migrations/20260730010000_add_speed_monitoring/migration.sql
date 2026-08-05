ALTER TABLE [vehicle_types] ADD [speedLimit] FLOAT(53);
ALTER TABLE [vehicles] ADD [customSpeedLimit] FLOAT(53);

CREATE TABLE [fleet_speed_settings] (
    [id] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [fleet_speed_settings_id_df] DEFAULT NEWID(),
    [defaultSpeedLimit] FLOAT(53) NOT NULL CONSTRAINT [fleet_speed_settings_defaultSpeedLimit_df] DEFAULT 80,
    [speedUnit] NVARCHAR(20) NOT NULL CONSTRAINT [fleet_speed_settings_speedUnit_df] DEFAULT 'KMH',
    [graceSpeed] FLOAT(53) NOT NULL CONSTRAINT [fleet_speed_settings_graceSpeed_df] DEFAULT 5,
    [minimumViolationDurationSeconds] INT NOT NULL CONSTRAINT [fleet_speed_settings_minimumViolationDurationSeconds_df] DEFAULT 10,
    [recoveryDurationSeconds] INT NOT NULL CONSTRAINT [fleet_speed_settings_recoveryDurationSeconds_df] DEFAULT 10,
    [alertCooldownMinutes] INT NOT NULL CONSTRAINT [fleet_speed_settings_alertCooldownMinutes_df] DEFAULT 15,
    [alertsEnabled] BIT NOT NULL CONSTRAINT [fleet_speed_settings_alertsEnabled_df] DEFAULT 1,
    [lowSeverityMaxExcess] FLOAT(53) NOT NULL CONSTRAINT [fleet_speed_settings_lowSeverityMaxExcess_df] DEFAULT 10,
    [mediumSeverityMaxExcess] FLOAT(53) NOT NULL CONSTRAINT [fleet_speed_settings_mediumSeverityMaxExcess_df] DEFAULT 20,
    [highSeverityMaxExcess] FLOAT(53) NOT NULL CONSTRAINT [fleet_speed_settings_highSeverityMaxExcess_df] DEFAULT 40,
    [maximumAllowedSpeedLimit] FLOAT(53) NOT NULL CONSTRAINT [fleet_speed_settings_maximumAllowedSpeedLimit_df] DEFAULT 200,
    [staleAfterSeconds] INT NOT NULL CONSTRAINT [fleet_speed_settings_staleAfterSeconds_df] DEFAULT 120,
    [readingRetentionDays] INT NOT NULL CONSTRAINT [fleet_speed_settings_readingRetentionDays_df] DEFAULT 90,
    [updatedById] UNIQUEIDENTIFIER,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [fleet_speed_settings_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [fleet_speed_settings_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [fleet_speed_settings_updatedById_fkey] FOREIGN KEY ([updatedById]) REFERENCES [users]([id])
);

CREATE TABLE [speed_readings] (
    [id] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [speed_readings_id_df] DEFAULT NEWID(),
    [vehicleId] UNIQUEIDENTIFIER NOT NULL,
    [driverId] UNIQUEIDENTIFIER,
    [tripId] UNIQUEIDENTIFIER,
    [speed] FLOAT(53) NOT NULL,
    [latitude] FLOAT(53) NOT NULL,
    [longitude] FLOAT(53) NOT NULL,
    [recordedAt] DATETIME2 NOT NULL,
    [source] NVARCHAR(50) NOT NULL CONSTRAINT [speed_readings_source_df] DEFAULT 'PHONE_GPS',
    [effectiveSpeedLimit] FLOAT(53) NOT NULL,
    [limitSource] NVARCHAR(30) NOT NULL,
    [isOverspeeding] BIT NOT NULL CONSTRAINT [speed_readings_isOverspeeding_df] DEFAULT 0,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [speed_readings_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [speed_readings_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [speed_readings_vehicleId_fkey] FOREIGN KEY ([vehicleId]) REFERENCES [vehicles]([id]),
    CONSTRAINT [speed_readings_driverId_fkey] FOREIGN KEY ([driverId]) REFERENCES [drivers]([id]),
    CONSTRAINT [speed_readings_tripId_fkey] FOREIGN KEY ([tripId]) REFERENCES [trips]([id])
);

CREATE TABLE [speed_violations] (
    [id] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [speed_violations_id_df] DEFAULT NEWID(),
    [vehicleId] UNIQUEIDENTIFIER NOT NULL,
    [driverId] UNIQUEIDENTIFIER,
    [tripId] UNIQUEIDENTIFIER,
    [vehicleTypeId] UNIQUEIDENTIFIER,
    [recordedSpeed] FLOAT(53) NOT NULL,
    [maximumSpeed] FLOAT(53) NOT NULL,
    [effectiveSpeedLimit] FLOAT(53) NOT NULL,
    [excessSpeed] FLOAT(53) NOT NULL,
    [severity] NVARCHAR(20) NOT NULL,
    [latitude] FLOAT(53) NOT NULL,
    [longitude] FLOAT(53) NOT NULL,
    [locationName] NVARCHAR(500),
    [startedAt] DATETIME2 NOT NULL,
    [lastSeenAt] DATETIME2 NOT NULL,
    [endedAt] DATETIME2,
    [durationSeconds] INT NOT NULL CONSTRAINT [speed_violations_durationSeconds_df] DEFAULT 0,
    [status] NVARCHAR(30) NOT NULL CONSTRAINT [speed_violations_status_df] DEFAULT 'ACTIVE',
    [acknowledgedAt] DATETIME2,
    [acknowledgedById] UNIQUEIDENTIFIER,
    [resolutionNote] NVARCHAR(2000),
    [lastAlertedAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [speed_violations_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [speed_violations_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [speed_violations_vehicleId_fkey] FOREIGN KEY ([vehicleId]) REFERENCES [vehicles]([id]),
    CONSTRAINT [speed_violations_driverId_fkey] FOREIGN KEY ([driverId]) REFERENCES [drivers]([id]),
    CONSTRAINT [speed_violations_tripId_fkey] FOREIGN KEY ([tripId]) REFERENCES [trips]([id]),
    CONSTRAINT [speed_violations_vehicleTypeId_fkey] FOREIGN KEY ([vehicleTypeId]) REFERENCES [vehicle_types]([id]),
    CONSTRAINT [speed_violations_acknowledgedById_fkey] FOREIGN KEY ([acknowledgedById]) REFERENCES [users]([id])
);

CREATE TABLE [speed_violation_audits] (
    [id] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [speed_violation_audits_id_df] DEFAULT NEWID(),
    [violationId] UNIQUEIDENTIFIER NOT NULL,
    [actorId] UNIQUEIDENTIFIER,
    [action] NVARCHAR(50) NOT NULL,
    [fromStatus] NVARCHAR(30),
    [toStatus] NVARCHAR(30),
    [note] NVARCHAR(2000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [speed_violation_audits_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [speed_violation_audits_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [speed_violation_audits_violationId_fkey] FOREIGN KEY ([violationId]) REFERENCES [speed_violations]([id]) ON DELETE CASCADE,
    CONSTRAINT [speed_violation_audits_actorId_fkey] FOREIGN KEY ([actorId]) REFERENCES [users]([id])
);

CREATE INDEX [fleet_speed_settings_updatedAt_idx] ON [fleet_speed_settings]([updatedAt]);
CREATE INDEX [speed_readings_vehicleId_recordedAt_idx] ON [speed_readings]([vehicleId], [recordedAt]);
CREATE INDEX [speed_readings_driverId_recordedAt_idx] ON [speed_readings]([driverId], [recordedAt]);
CREATE INDEX [speed_readings_tripId_recordedAt_idx] ON [speed_readings]([tripId], [recordedAt]);
CREATE INDEX [speed_readings_isOverspeeding_recordedAt_idx] ON [speed_readings]([isOverspeeding], [recordedAt]);
CREATE INDEX [speed_violations_status_startedAt_idx] ON [speed_violations]([status], [startedAt]);
CREATE INDEX [speed_violations_vehicleId_startedAt_idx] ON [speed_violations]([vehicleId], [startedAt]);
CREATE INDEX [speed_violations_driverId_startedAt_idx] ON [speed_violations]([driverId], [startedAt]);
CREATE INDEX [speed_violations_tripId_startedAt_idx] ON [speed_violations]([tripId], [startedAt]);
CREATE INDEX [speed_violations_severity_startedAt_idx] ON [speed_violations]([severity], [startedAt]);
CREATE UNIQUE INDEX [speed_violations_one_active_per_vehicle] ON [speed_violations]([vehicleId]) WHERE [status] = 'ACTIVE';
CREATE INDEX [speed_violation_audits_violationId_createdAt_idx] ON [speed_violation_audits]([violationId], [createdAt]);
CREATE INDEX [speed_violation_audits_actorId_createdAt_idx] ON [speed_violation_audits]([actorId], [createdAt]);

EXEC(N'ALTER TABLE [fleet_speed_settings] ADD CONSTRAINT [fleet_speed_settings_limits_ck]
CHECK ([defaultSpeedLimit] > 0 AND [maximumAllowedSpeedLimit] >= [defaultSpeedLimit] AND [graceSpeed] >= 0)');
EXEC(N'ALTER TABLE [vehicle_types] ADD CONSTRAINT [vehicle_types_speedLimit_ck] CHECK ([speedLimit] IS NULL OR [speedLimit] > 0)');
EXEC(N'ALTER TABLE [vehicles] ADD CONSTRAINT [vehicles_customSpeedLimit_ck] CHECK ([customSpeedLimit] IS NULL OR [customSpeedLimit] > 0)');

INSERT INTO [fleet_speed_settings] ([id], [updatedAt])
VALUES (NEWID(), CURRENT_TIMESTAMP);
