ALTER TABLE [dbo].[maintenance_requests]
ADD [evidenceMimeType] NVARCHAR(1000),
    [evidenceData] VARBINARY(MAX);
