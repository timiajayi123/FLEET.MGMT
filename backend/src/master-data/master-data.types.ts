export const MASTER_DATA_RESOURCES = [
  'directorates',
  'departments',
  'units',
  'locations',
  'vehicle-types',
  'roles',
] as const;

export type MasterDataResource = (typeof MASTER_DATA_RESOURCES)[number];

export function isMasterDataResource(value: string): value is MasterDataResource {
  return MASTER_DATA_RESOURCES.includes(value as MasterDataResource);
}
