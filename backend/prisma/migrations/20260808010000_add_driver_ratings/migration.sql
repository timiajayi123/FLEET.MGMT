CREATE TABLE [driver_ratings] (
    [id] UNIQUEIDENTIFIER NOT NULL,
    [tripId] UNIQUEIDENTIFIER NOT NULL,
    [requestId] UNIQUEIDENTIFIER NOT NULL,
    [driverId] UNIQUEIDENTIFIER NOT NULL,
    [ratedById] UNIQUEIDENTIFIER NOT NULL,
    [stars] INT NOT NULL,
    [likedTrip] BIT NOT NULL,
    [remark] NVARCHAR(1000),
    [complaint] NVARCHAR(1500),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [driver_ratings_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [driver_ratings_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [driver_ratings_tripId_key] UNIQUE NONCLUSTERED ([tripId]),
    CONSTRAINT [driver_ratings_tripId_fkey] FOREIGN KEY ([tripId]) REFERENCES [trips]([id]),
    CONSTRAINT [driver_ratings_requestId_fkey] FOREIGN KEY ([requestId]) REFERENCES [vehicle_requests]([id]),
    CONSTRAINT [driver_ratings_driverId_fkey] FOREIGN KEY ([driverId]) REFERENCES [drivers]([id]),
    CONSTRAINT [driver_ratings_ratedById_fkey] FOREIGN KEY ([ratedById]) REFERENCES [users]([id])
);

CREATE INDEX [driver_ratings_driverId_createdAt_idx] ON [driver_ratings]([driverId], [createdAt]);
CREATE INDEX [driver_ratings_ratedById_createdAt_idx] ON [driver_ratings]([ratedById], [createdAt]);
