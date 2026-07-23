CREATE TABLE [dbo].[maintenance_requests] (
  [id] UNIQUEIDENTIFIER NOT NULL,
  [vehicleId] UNIQUEIDENTIFIER NOT NULL,
  [reportedById] UNIQUEIDENTIFIER NOT NULL,
  [issueType] NVARCHAR(1000) NOT NULL,
  [issueDescription] NVARCHAR(2000) NOT NULL,
  [issueOccurredAt] DATETIME2 NOT NULL,
  [status] NVARCHAR(1000) NOT NULL CONSTRAINT [maintenance_requests_status_df] DEFAULT 'PENDING_REVIEW',
  [serviceability] NVARCHAR(30),
  [adminRemark] NVARCHAR(2000),
  [reviewedById] UNIQUEIDENTIFIER,
  [reviewedAt] DATETIME2,
  [createdAt] DATETIME2 NOT NULL CONSTRAINT [maintenance_requests_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
  [updatedAt] DATETIME2 NOT NULL,
  CONSTRAINT [maintenance_requests_pkey] PRIMARY KEY CLUSTERED ([id]),
  CONSTRAINT [maintenance_requests_vehicleId_fkey] FOREIGN KEY ([vehicleId]) REFERENCES [dbo].[vehicles]([id]),
  CONSTRAINT [maintenance_requests_reportedById_fkey] FOREIGN KEY ([reportedById]) REFERENCES [dbo].[users]([id]),
  CONSTRAINT [maintenance_requests_reviewedById_fkey] FOREIGN KEY ([reviewedById]) REFERENCES [dbo].[users]([id])
);
CREATE INDEX [maintenance_requests_status_createdAt_idx] ON [dbo].[maintenance_requests]([status], [createdAt]);
CREATE INDEX [maintenance_requests_vehicleId_createdAt_idx] ON [dbo].[maintenance_requests]([vehicleId], [createdAt]);
CREATE INDEX [maintenance_requests_reportedById_createdAt_idx] ON [dbo].[maintenance_requests]([reportedById], [createdAt]);
