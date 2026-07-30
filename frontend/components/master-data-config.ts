export const masterDataResources = {
  directorates: {
    title: 'Directorates',
    singular: 'Directorate',
    description: 'Manage the top-level organizational directorates used across fleet workflows.',
  },
  departments: {
    title: 'Departments',
    singular: 'Department',
    description: 'Manage departments and their parent directorates.',
    parentResource: 'directorates',
    parentField: 'directorateId',
    parentLabel: 'Directorate',
  },
  locations: {
    title: 'Locations',
    singular: 'Location',
    description: 'Manage approved offices, depots, and fleet operating locations.',
    extraFields: ['address', 'state'],
  },
  'vehicle-types': {
    title: 'Vehicle Types',
    singular: 'Vehicle Type',
    description: 'Manage requestable vehicle classifications and passenger capacities.',
    extraFields: ['passengerCapacity', 'mapIcon'],
  },
  roles: {
    title: 'Roles',
    singular: 'Role',
    description: 'Manage role definitions used by future access-control assignments.',
    extraFields: ['isSystemRole'],
  },
} as const;

export type MasterDataResource = keyof typeof masterDataResources;

export function isMasterDataResource(value: string): value is MasterDataResource {
  return value in masterDataResources;
}
