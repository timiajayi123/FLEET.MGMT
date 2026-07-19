BEGIN TRY

BEGIN TRAN;

-- DropIndex
ALTER TABLE [dbo].[drivers] DROP CONSTRAINT [drivers_licenceNumber_key];

-- CreateIndex
CREATE NONCLUSTERED INDEX [drivers_licenceNumber_idx] ON [dbo].[drivers]([licenceNumber]);

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
