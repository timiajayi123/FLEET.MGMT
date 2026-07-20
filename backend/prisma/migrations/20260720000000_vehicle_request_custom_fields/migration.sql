/*
  SQL Server 2022 safe additive migration.
  Review and run this script manually against fleet_management only after backing up the database.
  No existing request data is removed. Rollback instructions are in the accompanying README.
*/
ALTER TABLE [dbo].[vehicle_requests] ADD
  [tripCategory] NVARCHAR(30) NULL,
  [legacyPurposeOfTrip] NVARCHAR(2000) NULL,
  [customPickupLocation] NVARCHAR(300) NULL,
  [customDestination] NVARCHAR(300) NULL,
  [customDepartment] NVARCHAR(200) NULL,
  [customUnit] NVARCHAR(200) NULL;
GO

UPDATE [dbo].[vehicle_requests]
SET [legacyPurposeOfTrip] = [purposeOfTrip]
WHERE [legacyPurposeOfTrip] IS NULL
  AND [purposeOfTrip] NOT IN (N'Official', N'Non-Official');
GO

UPDATE [dbo].[vehicle_requests]
SET [tripCategory] = CASE
  WHEN [purposeOfTrip] = N'Official' THEN N'Official'
  WHEN [purposeOfTrip] = N'Non-Official' THEN N'Non-Official'
  ELSE NULL
END
WHERE [tripCategory] IS NULL;
GO

ALTER TABLE [dbo].[vehicle_requests] ALTER COLUMN [locationId] UNIQUEIDENTIFIER NULL;
ALTER TABLE [dbo].[vehicle_requests] ALTER COLUMN [departmentId] UNIQUEIDENTIFIER NULL;
ALTER TABLE [dbo].[vehicle_requests] ALTER COLUMN [unitId] UNIQUEIDENTIFIER NULL;
GO

CREATE INDEX [vehicle_requests_tripCategory_departureDate_idx]
ON [dbo].[vehicle_requests] ([tripCategory], [departureDate]);
GO
