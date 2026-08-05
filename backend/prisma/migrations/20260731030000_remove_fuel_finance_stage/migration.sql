-- Finance has no reviewer role or module in the application. Records that reached
-- this legacy stage have already passed Fleet Supervisor and Fleet Manager review,
-- so complete them as recorded when this workflow update is deployed.
UPDATE [dbo].[fuel_approvals]
SET
  [status] = N'APPROVED',
  [actedAt] = COALESCE([actedAt], SYSUTCDATETIME()),
  [comment] = COALESCE([comment], N'Automatically completed when the Finance approval stage was removed.')
WHERE [stage] = N'FINANCE'
  AND [status] = N'PENDING';

UPDATE [dbo].[fuel_entries]
SET
  [approvalStatus] = N'APPROVED',
  [entryStatus] = N'APPROVED',
  [approvedAt] = COALESCE([approvedAt], SYSUTCDATETIME())
WHERE [approvalStatus] = N'FINANCE_PENDING';
