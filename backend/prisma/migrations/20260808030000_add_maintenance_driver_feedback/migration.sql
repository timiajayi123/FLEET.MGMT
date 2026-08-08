IF COL_LENGTH('dbo.maintenance_requests', 'driverFeedback') IS NULL
BEGIN
    ALTER TABLE [dbo].[maintenance_requests] ADD
        [driverFeedback] NVARCHAR(30),
        [driverFeedbackRemark] NVARCHAR(1000),
        [driverFeedbackAt] DATETIME2;
END;
