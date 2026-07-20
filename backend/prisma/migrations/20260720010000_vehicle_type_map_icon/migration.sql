/* SQL Server 2022 additive migration: saves a static map icon path per vehicle type. */
ALTER TABLE [dbo].[vehicle_types] ADD [mapIcon] NVARCHAR(300) NULL;
GO
