BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[fuel_vendors] (
    [id] UNIQUEIDENTIFIER NOT NULL,
    [name] NVARCHAR(1000) NOT NULL,
    [contact] NVARCHAR(1000),
    [email] NVARCHAR(1000),
    [phone] NVARCHAR(1000),
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [fuel_vendors_status_df] DEFAULT 'ACTIVE',
    [notes] NVARCHAR(2000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [fuel_vendors_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [fuel_vendors_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [fuel_vendors_name_key] UNIQUE NONCLUSTERED ([name])
);

-- CreateTable
CREATE TABLE [dbo].[fuel_stations] (
    [id] UNIQUEIDENTIFIER NOT NULL,
    [vendorId] UNIQUEIDENTIFIER,
    [name] NVARCHAR(1000) NOT NULL,
    [brand] NVARCHAR(1000),
    [address] NVARCHAR(1000),
    [state] NVARCHAR(1000) NOT NULL,
    [city] NVARCHAR(1000),
    [latitude] DECIMAL(10,7),
    [longitude] DECIMAL(10,7),
    [contact] NVARCHAR(1000),
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [fuel_stations_status_df] DEFAULT 'ACTIVE',
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [fuel_stations_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [fuel_stations_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [fuel_stations_name_state_city_key] UNIQUE NONCLUSTERED ([name],[state],[city])
);

-- CreateTable
CREATE TABLE [dbo].[fuel_prices] (
    [id] UNIQUEIDENTIFIER NOT NULL,
    [stationId] UNIQUEIDENTIFIER,
    [vendorId] UNIQUEIDENTIFIER,
    [state] NVARCHAR(1000) NOT NULL,
    [fuelType] NVARCHAR(1000) NOT NULL,
    [effectiveDate] DATE NOT NULL,
    [pricePerLitre] DECIMAL(18,2) NOT NULL,
    [tolerancePct] DECIMAL(6,2) NOT NULL CONSTRAINT [fuel_prices_tolerancePct_df] DEFAULT 10,
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [fuel_prices_status_df] DEFAULT 'ACTIVE',
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [fuel_prices_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [fuel_prices_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[fuel_cards] (
    [id] UNIQUEIDENTIFIER NOT NULL,
    [cardNumber] NVARCHAR(1000) NOT NULL,
    [maskedNumber] NVARCHAR(1000) NOT NULL,
    [provider] NVARCHAR(1000) NOT NULL,
    [encryptedPin] NVARCHAR(2000),
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [fuel_cards_status_df] DEFAULT 'ACTIVE',
    [issueDate] DATE NOT NULL,
    [expiryDate] DATE,
    [vehicleId] UNIQUEIDENTIFIER,
    [driverId] UNIQUEIDENTIFIER,
    [officeId] UNIQUEIDENTIFIER,
    [monthlyLimit] DECIMAL(18,2),
    [dailyLimit] DECIMAL(18,2),
    [transactionLimit] DECIMAL(18,2),
    [currentBalance] DECIMAL(18,2),
    [allowedFuelTypes] NVARCHAR(1000),
    [allowedStates] NVARCHAR(1000),
    [allowedStationId] UNIQUEIDENTIFIER,
    [notes] NVARCHAR(2000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [fuel_cards_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [fuel_cards_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [fuel_cards_cardNumber_key] UNIQUE NONCLUSTERED ([cardNumber])
);

-- CreateTable
CREATE TABLE [dbo].[fuel_card_transactions] (
    [id] UNIQUEIDENTIFIER NOT NULL,
    [fuelCardId] UNIQUEIDENTIFIER NOT NULL,
    [fuelEntryId] UNIQUEIDENTIFIER,
    [transactionNumber] NVARCHAR(1000) NOT NULL,
    [amount] DECIMAL(18,2) NOT NULL,
    [transactionAt] DATETIME2 NOT NULL,
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [fuel_card_transactions_status_df] DEFAULT 'PENDING',
    [reconciliationRef] NVARCHAR(1000),
    [notes] NVARCHAR(2000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [fuel_card_transactions_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [fuel_card_transactions_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [fuel_card_transactions_fuelEntryId_key] UNIQUE NONCLUSTERED ([fuelEntryId]),
    CONSTRAINT [fuel_card_transactions_transactionNumber_key] UNIQUE NONCLUSTERED ([transactionNumber])
);

-- CreateTable
CREATE TABLE [dbo].[vehicle_fuel_baselines] (
    [id] UNIQUEIDENTIFIER NOT NULL,
    [vehicleId] UNIQUEIDENTIFIER NOT NULL,
    [expectedKmPerLitre] DECIMAL(12,3),
    [manufacturerKmPerLitre] DECIMAL(12,3),
    [tankCapacityLitres] DECIMAL(12,3),
    [acceptableTolerancePct] DECIMAL(6,2) NOT NULL CONSTRAINT [vehicle_fuel_baselines_acceptableTolerancePct_df] DEFAULT 10,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [vehicle_fuel_baselines_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [vehicle_fuel_baselines_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [vehicle_fuel_baselines_vehicleId_key] UNIQUE NONCLUSTERED ([vehicleId])
);

-- CreateTable
CREATE TABLE [dbo].[fuel_budgets] (
    [id] UNIQUEIDENTIFIER NOT NULL,
    [name] NVARCHAR(1000) NOT NULL,
    [fiscalYear] INT NOT NULL,
    [month] INT,
    [amount] DECIMAL(18,2) NOT NULL,
    [committed] DECIMAL(18,2) NOT NULL CONSTRAINT [fuel_budgets_committed_df] DEFAULT 0,
    [spent] DECIMAL(18,2) NOT NULL CONSTRAINT [fuel_budgets_spent_df] DEFAULT 0,
    [directorateId] UNIQUEIDENTIFIER,
    [departmentId] UNIQUEIDENTIFIER,
    [officeId] UNIQUEIDENTIFIER,
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [fuel_budgets_status_df] DEFAULT 'ACTIVE',
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [fuel_budgets_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [fuel_budgets_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[fuel_entries] (
    [id] UNIQUEIDENTIFIER NOT NULL,
    [entryNumber] NVARCHAR(1000) NOT NULL,
    [vehicleId] UNIQUEIDENTIFIER NOT NULL,
    [driverId] UNIQUEIDENTIFIER NOT NULL,
    [allocationId] UNIQUEIDENTIFIER NOT NULL,
    [tripId] UNIQUEIDENTIFIER,
    [createdById] UNIQUEIDENTIFIER NOT NULL,
    [fuelCardId] UNIQUEIDENTIFIER,
    [stationId] UNIQUEIDENTIFIER,
    [vendorId] UNIQUEIDENTIFIER,
    [fuelingAt] DATETIME2 NOT NULL,
    [entryType] NVARCHAR(1000) NOT NULL CONSTRAINT [fuel_entries_entryType_df] DEFAULT 'REFUEL',
    [fuelType] NVARCHAR(1000) NOT NULL,
    [entryStatus] NVARCHAR(1000) NOT NULL CONSTRAINT [fuel_entries_entryStatus_df] DEFAULT 'DRAFT',
    [approvalStatus] NVARCHAR(1000) NOT NULL CONSTRAINT [fuel_entries_approvalStatus_df] DEFAULT 'DRAFT',
    [reason] NVARCHAR(1000),
    [comments] NVARCHAR(2000),
    [vehicleRegistration] NVARCHAR(1000) NOT NULL,
    [driverName] NVARCHAR(1000) NOT NULL,
    [driverEmployeeId] NVARCHAR(1000) NOT NULL,
    [allocationSnapshot] NVARCHAR(100),
    [tripSnapshot] NVARCHAR(100),
    [departmentName] NVARCHAR(1000),
    [directorateName] NVARCHAR(1000),
    [officeName] NVARCHAR(1000),
    [unitName] NVARCHAR(1000),
    [supervisorName] NVARCHAR(1000),
    [state] NVARCHAR(1000),
    [city] NVARCHAR(1000),
    [pumpNumber] NVARCHAR(1000),
    [fuelLevelBefore] DECIMAL(6,2),
    [fuelLevelAfter] DECIMAL(6,2),
    [requestedLitres] DECIMAL(18,3),
    [dispensedLitres] DECIMAL(18,3) NOT NULL,
    [approvedPricePerLitre] DECIMAL(18,2),
    [pricePerLitre] DECIMAL(18,2) NOT NULL,
    [totalAmount] DECIMAL(18,2) NOT NULL,
    [paymentMethod] NVARCHAR(1000) NOT NULL,
    [cardTransactionNumber] NVARCHAR(1000),
    [receiptNumber] NVARCHAR(1000),
    [vendorInvoice] NVARCHAR(1000),
    [previousOdometer] DECIMAL(18,2),
    [currentOdometer] DECIMAL(18,2),
    [distanceTravelled] DECIMAL(18,2),
    [gpsDistance] DECIMAL(18,2),
    [tripDistance] DECIMAL(18,2),
    [engineHours] DECIMAL(18,2),
    [distanceSource] NVARCHAR(1000),
    [kmPerLitre] DECIMAL(18,4),
    [litresPer100Km] DECIMAL(18,4),
    [costPerKm] DECIMAL(18,4),
    [baselineDifference] DECIMAL(18,4),
    [baselineVariancePct] DECIMAL(8,2),
    [latitude] DECIMAL(10,7),
    [longitude] DECIMAL(10,7),
    [submittedAt] DATETIME2,
    [approvedAt] DATETIME2,
    [postedAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [fuel_entries_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [fuel_entries_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [fuel_entries_entryNumber_key] UNIQUE NONCLUSTERED ([entryNumber])
);

-- CreateTable
CREATE TABLE [dbo].[fuel_approvals] (
    [id] UNIQUEIDENTIFIER NOT NULL,
    [fuelEntryId] UNIQUEIDENTIFIER NOT NULL,
    [actorId] UNIQUEIDENTIFIER,
    [stage] NVARCHAR(1000) NOT NULL,
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [fuel_approvals_status_df] DEFAULT 'PENDING',
    [comment] NVARCHAR(2000),
    [actedAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [fuel_approvals_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [fuel_approvals_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[fuel_attachments] (
    [id] UNIQUEIDENTIFIER NOT NULL,
    [fuelEntryId] UNIQUEIDENTIFIER NOT NULL,
    [kind] NVARCHAR(1000) NOT NULL,
    [fileName] NVARCHAR(1000) NOT NULL,
    [mimeType] NVARCHAR(1000) NOT NULL,
    [sizeBytes] INT NOT NULL,
    [data] VARBINARY(max) NOT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [fuel_attachments_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [fuel_attachments_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[fuel_alerts] (
    [id] UNIQUEIDENTIFIER NOT NULL,
    [fuelEntryId] UNIQUEIDENTIFIER,
    [alertType] NVARCHAR(1000) NOT NULL,
    [severity] NVARCHAR(1000) NOT NULL CONSTRAINT [fuel_alerts_severity_df] DEFAULT 'WARNING',
    [message] NVARCHAR(2000) NOT NULL,
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [fuel_alerts_status_df] DEFAULT 'OPEN',
    [resolvedAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [fuel_alerts_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [fuel_alerts_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[fuel_reconciliations] (
    [id] UNIQUEIDENTIFIER NOT NULL,
    [fuelEntryId] UNIQUEIDENTIFIER NOT NULL,
    [reconciledAmount] DECIMAL(18,2),
    [varianceAmount] DECIMAL(18,2),
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [fuel_reconciliations_status_df] DEFAULT 'PENDING',
    [notes] NVARCHAR(2000),
    [reconciledAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [fuel_reconciliations_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [fuel_reconciliations_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [fuel_reconciliations_fuelEntryId_key] UNIQUE NONCLUSTERED ([fuelEntryId])
);

-- CreateTable
CREATE TABLE [dbo].[fuel_audit_logs] (
    [id] UNIQUEIDENTIFIER NOT NULL,
    [fuelEntryId] UNIQUEIDENTIFIER,
    [actorId] UNIQUEIDENTIFIER,
    [action] NVARCHAR(1000) NOT NULL,
    [entityType] NVARCHAR(1000) NOT NULL,
    [entityId] NVARCHAR(1000) NOT NULL,
    [details] NVARCHAR(4000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [fuel_audit_logs_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [fuel_audit_logs_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [fuel_vendors_status_name_idx] ON [dbo].[fuel_vendors]([status], [name]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [fuel_stations_status_state_city_idx] ON [dbo].[fuel_stations]([status], [state], [city]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [fuel_stations_vendorId_idx] ON [dbo].[fuel_stations]([vendorId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [fuel_prices_state_fuelType_effectiveDate_idx] ON [dbo].[fuel_prices]([state], [fuelType], [effectiveDate]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [fuel_prices_stationId_effectiveDate_idx] ON [dbo].[fuel_prices]([stationId], [effectiveDate]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [fuel_cards_status_expiryDate_idx] ON [dbo].[fuel_cards]([status], [expiryDate]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [fuel_cards_vehicleId_idx] ON [dbo].[fuel_cards]([vehicleId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [fuel_cards_driverId_idx] ON [dbo].[fuel_cards]([driverId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [fuel_card_transactions_fuelCardId_transactionAt_idx] ON [dbo].[fuel_card_transactions]([fuelCardId], [transactionAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [fuel_budgets_fiscalYear_month_status_idx] ON [dbo].[fuel_budgets]([fiscalYear], [month], [status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [fuel_budgets_departmentId_idx] ON [dbo].[fuel_budgets]([departmentId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [fuel_entries_vehicleId_fuelingAt_idx] ON [dbo].[fuel_entries]([vehicleId], [fuelingAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [fuel_entries_driverId_fuelingAt_idx] ON [dbo].[fuel_entries]([driverId], [fuelingAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [fuel_entries_allocationId_fuelingAt_idx] ON [dbo].[fuel_entries]([allocationId], [fuelingAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [fuel_entries_tripId_idx] ON [dbo].[fuel_entries]([tripId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [fuel_entries_approvalStatus_fuelingAt_idx] ON [dbo].[fuel_entries]([approvalStatus], [fuelingAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [fuel_entries_receiptNumber_idx] ON [dbo].[fuel_entries]([receiptNumber]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [fuel_approvals_fuelEntryId_stage_idx] ON [dbo].[fuel_approvals]([fuelEntryId], [stage]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [fuel_approvals_status_stage_idx] ON [dbo].[fuel_approvals]([status], [stage]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [fuel_attachments_fuelEntryId_kind_idx] ON [dbo].[fuel_attachments]([fuelEntryId], [kind]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [fuel_alerts_status_severity_createdAt_idx] ON [dbo].[fuel_alerts]([status], [severity], [createdAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [fuel_alerts_fuelEntryId_idx] ON [dbo].[fuel_alerts]([fuelEntryId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [fuel_reconciliations_status_createdAt_idx] ON [dbo].[fuel_reconciliations]([status], [createdAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [fuel_audit_logs_entityType_entityId_createdAt_idx] ON [dbo].[fuel_audit_logs]([entityType], [entityId], [createdAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [fuel_audit_logs_fuelEntryId_idx] ON [dbo].[fuel_audit_logs]([fuelEntryId]);

-- AddForeignKey
ALTER TABLE [dbo].[fuel_stations] ADD CONSTRAINT [fuel_stations_vendorId_fkey] FOREIGN KEY ([vendorId]) REFERENCES [dbo].[fuel_vendors]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[fuel_prices] ADD CONSTRAINT [fuel_prices_stationId_fkey] FOREIGN KEY ([stationId]) REFERENCES [dbo].[fuel_stations]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[fuel_prices] ADD CONSTRAINT [fuel_prices_vendorId_fkey] FOREIGN KEY ([vendorId]) REFERENCES [dbo].[fuel_vendors]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[fuel_cards] ADD CONSTRAINT [fuel_cards_vehicleId_fkey] FOREIGN KEY ([vehicleId]) REFERENCES [dbo].[vehicles]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[fuel_cards] ADD CONSTRAINT [fuel_cards_driverId_fkey] FOREIGN KEY ([driverId]) REFERENCES [dbo].[drivers]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[fuel_cards] ADD CONSTRAINT [fuel_cards_officeId_fkey] FOREIGN KEY ([officeId]) REFERENCES [dbo].[locations]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[fuel_cards] ADD CONSTRAINT [fuel_cards_allowedStationId_fkey] FOREIGN KEY ([allowedStationId]) REFERENCES [dbo].[fuel_stations]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[fuel_card_transactions] ADD CONSTRAINT [fuel_card_transactions_fuelCardId_fkey] FOREIGN KEY ([fuelCardId]) REFERENCES [dbo].[fuel_cards]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[fuel_card_transactions] ADD CONSTRAINT [fuel_card_transactions_fuelEntryId_fkey] FOREIGN KEY ([fuelEntryId]) REFERENCES [dbo].[fuel_entries]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[vehicle_fuel_baselines] ADD CONSTRAINT [vehicle_fuel_baselines_vehicleId_fkey] FOREIGN KEY ([vehicleId]) REFERENCES [dbo].[vehicles]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[fuel_budgets] ADD CONSTRAINT [fuel_budgets_directorateId_fkey] FOREIGN KEY ([directorateId]) REFERENCES [dbo].[directorates]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[fuel_budgets] ADD CONSTRAINT [fuel_budgets_departmentId_fkey] FOREIGN KEY ([departmentId]) REFERENCES [dbo].[departments]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[fuel_budgets] ADD CONSTRAINT [fuel_budgets_officeId_fkey] FOREIGN KEY ([officeId]) REFERENCES [dbo].[locations]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[fuel_entries] ADD CONSTRAINT [fuel_entries_vehicleId_fkey] FOREIGN KEY ([vehicleId]) REFERENCES [dbo].[vehicles]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[fuel_entries] ADD CONSTRAINT [fuel_entries_driverId_fkey] FOREIGN KEY ([driverId]) REFERENCES [dbo].[drivers]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[fuel_entries] ADD CONSTRAINT [fuel_entries_allocationId_fkey] FOREIGN KEY ([allocationId]) REFERENCES [dbo].[vehicle_allocations]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[fuel_entries] ADD CONSTRAINT [fuel_entries_tripId_fkey] FOREIGN KEY ([tripId]) REFERENCES [dbo].[trips]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[fuel_entries] ADD CONSTRAINT [fuel_entries_createdById_fkey] FOREIGN KEY ([createdById]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[fuel_entries] ADD CONSTRAINT [fuel_entries_fuelCardId_fkey] FOREIGN KEY ([fuelCardId]) REFERENCES [dbo].[fuel_cards]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[fuel_entries] ADD CONSTRAINT [fuel_entries_stationId_fkey] FOREIGN KEY ([stationId]) REFERENCES [dbo].[fuel_stations]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[fuel_entries] ADD CONSTRAINT [fuel_entries_vendorId_fkey] FOREIGN KEY ([vendorId]) REFERENCES [dbo].[fuel_vendors]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[fuel_approvals] ADD CONSTRAINT [fuel_approvals_fuelEntryId_fkey] FOREIGN KEY ([fuelEntryId]) REFERENCES [dbo].[fuel_entries]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[fuel_approvals] ADD CONSTRAINT [fuel_approvals_actorId_fkey] FOREIGN KEY ([actorId]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[fuel_attachments] ADD CONSTRAINT [fuel_attachments_fuelEntryId_fkey] FOREIGN KEY ([fuelEntryId]) REFERENCES [dbo].[fuel_entries]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[fuel_alerts] ADD CONSTRAINT [fuel_alerts_fuelEntryId_fkey] FOREIGN KEY ([fuelEntryId]) REFERENCES [dbo].[fuel_entries]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[fuel_reconciliations] ADD CONSTRAINT [fuel_reconciliations_fuelEntryId_fkey] FOREIGN KEY ([fuelEntryId]) REFERENCES [dbo].[fuel_entries]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[fuel_audit_logs] ADD CONSTRAINT [fuel_audit_logs_fuelEntryId_fkey] FOREIGN KEY ([fuelEntryId]) REFERENCES [dbo].[fuel_entries]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[fuel_audit_logs] ADD CONSTRAINT [fuel_audit_logs_actorId_fkey] FOREIGN KEY ([actorId]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
