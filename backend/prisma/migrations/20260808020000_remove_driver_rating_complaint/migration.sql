IF COL_LENGTH('dbo.driver_ratings', 'complaint') IS NOT NULL
BEGIN
    ALTER TABLE [dbo].[driver_ratings] DROP COLUMN [complaint];
END;
