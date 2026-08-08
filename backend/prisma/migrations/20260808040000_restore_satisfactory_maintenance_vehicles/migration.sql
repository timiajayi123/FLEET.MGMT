;WITH latest_maintenance AS (
    SELECT
        [vehicleId],
        [driverFeedback],
        ROW_NUMBER() OVER (
            PARTITION BY [vehicleId]
            ORDER BY COALESCE([driverFeedbackAt], [reviewedAt], [updatedAt], [createdAt]) DESC
        ) AS [recordRank]
    FROM [dbo].[maintenance_requests]
)
UPDATE vehicle
SET
    vehicle.[status] = 'AVAILABLE',
    vehicle.[serviceability] = 'SERVICEABLE',
    vehicle.[updatedAt] = SYSUTCDATETIME()
FROM [dbo].[vehicles] AS vehicle
INNER JOIN latest_maintenance AS latest
    ON latest.[vehicleId] = vehicle.[id]
    AND latest.[recordRank] = 1
WHERE
    latest.[driverFeedback] = 'SATISFACTORY'
    AND vehicle.[status] = 'MAINTENANCE';
