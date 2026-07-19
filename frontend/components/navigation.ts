import {
  BarChart3,
  BrainCircuit,
  Building2,
  CarFront,
  ClipboardList,
  Fuel,
  Gauge,
  LayoutDashboard,
  Map as MapIcon,
  MapPin,
  Route,
  Settings,
  ShieldCheck,
  Sparkles,
  Tags,
  Truck,
  Users,
  Wrench,
  type LucideIcon,
} from 'lucide-react';

export type NavigationItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  roles?: string[];
};

export type NavigationGroup = {
  label: string;
  items: NavigationItem[];
};

export const navigation: NavigationGroup[] = [
  {
    label: 'Overview',
    items: [{ label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard }],
  },
  {
    label: 'Fleet',
    items: [
      { label: 'Vehicles', href: '/fleet/vehicles', icon: CarFront, roles: ['S_ADMIN', 'FM'] },
      { label: 'Drivers', href: '/fleet/drivers', icon: Users, roles: ['S_ADMIN', 'FM'] },
      {
        label: 'Request Vehicle',
        href: '/fleet/vehicle-requests/new',
        icon: ClipboardList,
        roles: ['ST'],
      },
      {
        label: 'Review Requests',
        href: '/fleet/vehicle-requests/review',
        icon: ClipboardList,
        roles: ['S_ADMIN', 'FM'],
      },
      {
        label: 'Vehicle Allocation',
        href: '/fleet/vehicle-allocation',
        icon: Truck,
        roles: ['S_ADMIN', 'FM', 'DRIVER'],
      },
      { label: 'Trips', href: '/fleet/trips', icon: Route, roles: ['S_ADMIN', 'FM'] },
    ],
  },
  {
    label: 'Operations',
    items: [
      { label: 'GPS Tracking', href: '/operations/gps-tracking', icon: MapIcon, roles: ['S_ADMIN', 'FM', 'DRIVER'] },
      { label: 'Fuel Management', href: '/operations/fuel-management', icon: Fuel, roles: ['S_ADMIN', 'FM'] },
      { label: 'Maintenance', href: '/operations/maintenance', icon: Wrench, roles: ['S_ADMIN', 'FM'] },
    ],
  },
  {
    label: 'Administration',
    items: [
      {
        label: 'Roles',
        href: '/administration/roles',
        icon: ShieldCheck,
        roles: ['S_ADMIN'],
      },
      { label: 'Directorates', href: '/administration/directorates', icon: Building2, roles: ['S_ADMIN'] },
      { label: 'Departments', href: '/administration/departments', icon: Building2, roles: ['S_ADMIN'] },
      { label: 'Units', href: '/administration/units', icon: Building2, roles: ['S_ADMIN'] },
      { label: 'Locations', href: '/administration/locations', icon: MapPin, roles: ['S_ADMIN'] },
      { label: 'Vehicle Types', href: '/administration/vehicle-types', icon: Tags, roles: ['S_ADMIN'] },
    ],
  },
  {
    label: 'Analytics',
    items: [
      { label: 'Reports', href: '/analytics/reports', icon: BarChart3, roles: ['S_ADMIN', 'FM'] },
      { label: 'Dashboard Analytics', href: '/analytics/dashboard', icon: Gauge, roles: ['S_ADMIN', 'FM'] },
    ],
  },
  {
    label: 'AI',
    items: [
      { label: 'Fleet Optimization', href: '/ai/fleet-optimization', icon: Sparkles, roles: ['S_ADMIN', 'FM'] },
      { label: 'Predictive Maintenance', href: '/ai/predictive-maintenance', icon: BrainCircuit, roles: ['S_ADMIN', 'FM'] },
    ],
  },
  {
    label: 'System',
    items: [
      { label: 'Settings', href: '/settings', icon: Settings, roles: ['S_ADMIN'] },
      { label: 'Users', href: '/administration/users', icon: Users, roles: ['S_ADMIN'] },
    ],
  },
];

export const moduleMetadata = new Map(
  navigation.flatMap((group) =>
    group.items.map((item) => [
      item.href,
      { title: item.label, section: group.label, icon: item.icon, roles: item.roles },
    ]),
  ),
);

export function canAccessNavigationItem(item: NavigationItem, roleCode?: string) {
  if (!item.roles?.length) return true;
  if (!roleCode) return false;
  return item.roles.includes(roleCode);
}

export function visibleNavigation(roleCode?: string) {
  return navigation
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => canAccessNavigationItem(item, roleCode)),
    }))
    .filter((group) => group.items.length > 0);
}

export function canAccessPath(pathname: string, roleCode?: string) {
  if (!roleCode) return false;
  if (pathname === '/dashboard' || pathname === '/profile') return true;
  const items = navigation
    .flatMap((group) => group.items)
    .sort((a, b) => b.href.length - a.href.length);
  const matchingItems = items.filter((entry) => pathname === entry.href || pathname.startsWith(`${entry.href}/`));
  return matchingItems.length
    ? matchingItems.some((item) => canAccessNavigationItem(item, roleCode))
    : false;
}
