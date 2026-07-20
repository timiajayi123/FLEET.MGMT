/* SQL Server 2022 additive migration: stores uploaded map icons with a vehicle type. */
ALTER TABLE [dbo].[vehicle_types] ADD
  [mapIconMimeType] NVARCHAR(100) NULL,
  [mapIconData] VARBINARY(MAX) NULL;
GO
