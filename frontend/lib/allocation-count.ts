export type AllocationForCount = {
  status: string;
  startAt: string;
  expectedEndAt: string;
  request?: unknown | null;
};

export function isCurrentPermanentAllocation(
  allocation: AllocationForCount,
  now = Date.now(),
) {
  if (allocation.request) return false;
  if (allocation.status === 'IN_PROGRESS') return true;
  if (!['ASSIGNED', 'ACCEPTED'].includes(allocation.status)) return false;
  return (
    new Date(allocation.startAt).getTime() <= now &&
    new Date(allocation.expectedEndAt).getTime() >= now
  );
}

export function countCurrentPermanentAllocations(allocations: AllocationForCount[]) {
  const now = Date.now();
  return allocations.filter((allocation) => isCurrentPermanentAllocation(allocation, now)).length;
}
