'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import {
  Bell,
  CheckCircle2,
  ChevronDown,
  LogOut,
  Menu,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  ShieldCheck,
  Sun,
  UserRound,
  X,
} from 'lucide-react';
import { ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { canAccessPath, visibleNavigation } from './navigation';
import { CsvImportBar } from './csv-import-bar';
import { LocationMapPanel } from './location-map-panel';

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchInput = useRef<HTMLInputElement>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() =>
    shouldAutoCollapseSidebar(pathname),
  );
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [authLoaded, setAuthLoaded] = useState(false);
  const [user, setUser] = useState<{
    id: string;
    staffName: string;
    email: string;
    passportMimeType?: string;
    role: { code: string; name: string };
  } | null>(null);
  const [notifications, setNotifications] = useState<
    { id: string; title: string; message: string; createdAt: string }[]
  >([]);
  const [sidebarMetrics, setSidebarMetrics] = useState<Record<string, number>>({});
  const [globalNotice, setGlobalNotice] = useState('');
  const [globalSearch, setGlobalSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [recordResults, setRecordResults] = useState<GlobalSearchResult[]>([]);
  useEffect(() => {
    // Route changes intentionally restore the best sidebar layout for that page.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSidebarCollapsed(shouldAutoCollapseSidebar(pathname));
  }, [pathname]);
  useEffect(() => {
    fetch('/api/auth/me', { cache: 'no-store' })
      .then(async (response) => {
        if (response.status === 401 || response.status === 403) {
          router.replace('/login');
          return null;
        }
        if (!response.ok) throw new Error('Unable to verify session.');
        return response.json();
      })
      .then((payload) => {
        if (!payload) return;
        if (!payload.user) {
          router.replace('/login');
          return;
        }
        setUser(payload.user);
        setAuthLoaded(true);
      })
      .catch(() => setAuthLoaded(true));
  }, [router]);
  useEffect(() => {
    if (!user) return;
    let active = true;
    const refreshSidebar = () => {
      fetch('/api/dashboard?days=30', { cache: 'no-store' })
        .then(async (response) => (response.ok ? response.json() : null))
        .then((payload) => {
          if (!active || !payload) return;
          setNotifications(payload.notifications ?? []);
          setSidebarMetrics(payload.metrics ?? {});
        })
        .catch(() => undefined);
    };
    refreshSidebar();
    const timer = window.setInterval(refreshSidebar, 30_000);
    window.addEventListener('focus', refreshSidebar);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener('focus', refreshSidebar);
    };
  }, [user]);
  useEffect(() => {
    const originalFetch = window.fetch;
    const silentPaths = ['/api/auth/', '/api/driver-tracking/', '/api/gps/', '/api/fleet/'];
    const wrappedFetch: typeof window.fetch = async (input, init) => {
      const response = await originalFetch(input, init);
      const method = (
        init?.method ?? (input instanceof Request ? input.method : 'GET')
      ).toUpperCase();
      const url =
        typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      const requestHeaders = new Headers(
        init?.headers ?? (input instanceof Request ? input.headers : undefined),
      );
      if (
        response.ok &&
        ['POST', 'PATCH', 'PUT', 'DELETE'].includes(method) &&
        !silentPaths.some((path) => url.includes(path))
      ) {
        const message =
          requestHeaders.get('X-Fleet-Success-Message') ?? mutationSuccessMessage(url, method);
        setGlobalNotice(message);
      }
      return response;
    };
    window.fetch = wrappedFetch;
    return () => {
      if (window.fetch === wrappedFetch) window.fetch = originalFetch;
    };
  }, []);
  useEffect(() => {
    if (!globalNotice) return;
    const timer = window.setTimeout(() => setGlobalNotice(''), 4500);
    return () => window.clearTimeout(timer);
  }, [globalNotice]);
  useEffect(() => {
    function shortcut(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        searchInput.current?.focus();
        setSearchOpen(true);
      }
      if (event.key === 'Escape') setSearchOpen(false);
    }
    window.addEventListener('keydown', shortcut);
    return () => window.removeEventListener('keydown', shortcut);
  }, []);
  const initials =
    user?.staffName
      .split(/\s+/)
      .map((part) => part[0])
      .slice(0, 2)
      .join('')
      .toUpperCase() || 'GU';
  const roleCode = user?.role.code;
  const navGroups = visibleNavigation(roleCode);
  const moduleResults = useMemo(() => {
    const term = globalSearch.trim().toLowerCase();
    if (!term) return [];
    return navGroups
      .flatMap((group) =>
        group.items.map((item) => ({
          id: `module:${item.href}`,
          title: item.label,
          detail: `${group.label} module`,
          href: item.href,
          type: 'Module',
        })),
      )
      .filter((result) => `${result.title} ${result.detail}`.toLowerCase().includes(term))
      .slice(0, 6) as GlobalSearchResult[];
  }, [globalSearch, navGroups]);
  const combinedSearchResults = [...moduleResults, ...recordResults].slice(0, 12);
  const routeAllowed = authLoaded && user ? canAccessPath(pathname, roleCode) : true;

  useEffect(() => {
    const term = globalSearch.trim();
    if (!user || term.length < 2) {
      queueMicrotask(() => {
        setRecordResults([]);
        setSearching(false);
      });
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setSearching(true);
      const endpoints = [
        ['/api/vehicles', 'Vehicle'],
        ['/api/drivers', 'Driver'],
        ['/api/vehicle-requests', 'Request'],
      ] as const;
      const responses = await Promise.allSettled(
        endpoints.map(async ([endpoint, type]) => {
          const response = await fetch(endpoint, { signal: controller.signal, cache: 'no-store' });
          if (!response.ok) return [];
          const payload = await response.json();
          return globalRecordResults(type, payload.data ?? [], term);
        }),
      );
      if (!controller.signal.aborted) {
        setRecordResults(
          responses.flatMap((result) => (result.status === 'fulfilled' ? result.value : [])),
        );
        setSearching(false);
      }
    }, 250);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [globalSearch, user]);

  function openSearchResult(result: GlobalSearchResult) {
    setGlobalSearch('');
    setSearchOpen(false);
    router.push(result.href);
  }

  function toggleTheme() {
    const next = document.documentElement.dataset.theme !== 'dark';
    document.documentElement.dataset.theme = next ? 'dark' : 'light';
    localStorage.setItem('fleet-theme', next ? 'dark' : 'light');
  }

  return (
    <div className={`app-shell ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      {globalNotice && (
        <div className="global-request-toast" role="status">
          <CheckCircle2 size={20} />
          <span>{globalNotice}</span>
          <button type="button" aria-label="Close notification" onClick={() => setGlobalNotice('')}>
            <X size={17} />
          </button>
        </div>
      )}
      <button
        className={`sidebar-backdrop ${sidebarOpen ? 'visible' : ''}`}
        aria-label="Close navigation"
        onClick={() => setSidebarOpen(false)}
      />
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="brand">
          <Image
            className="brand-logo"
            src="/nmdpra-logo.png"
            alt="NMDPRA logo"
            width={96}
            height={96}
            priority
          />
          <div>
            <strong>NMDPRA</strong>
            <span>Fleet Management</span>
          </div>
          <button className="icon-button sidebar-close" onClick={() => setSidebarOpen(false)}>
            <X size={18} />
            <span className="sr-only">Close navigation</span>
          </button>
        </div>
        <nav className="sidebar-nav" aria-label="Primary navigation">
          {navGroups.map((group) => (
            <div className="nav-group" key={group.label}>
              <p>{group.label}</p>
              {group.items.map((item) => {
                const active =
                  pathname === item.href ||
                  (item.href !== '/dashboard' && pathname.startsWith(`${item.href}/`));
                const Icon = item.icon;
                const count = sidebarCount(item.href, roleCode, sidebarMetrics);
                return (
                  <Link
                    className={active ? 'active' : ''}
                    href={item.href}
                    key={item.href}
                    onClick={() => setSidebarOpen(false)}
                  >
                    <Icon size={18} strokeWidth={1.8} />
                    <span>{item.label}</span>
                    {count > 0 && (
                      <span className="nav-count" title={`${count} item${count === 1 ? '' : 's'}`}>
                        {count > 99 ? '99+' : count}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
        <div className="sidebar-user">
          {user?.passportMimeType ? (
            <Image
              unoptimized
              width={48}
              height={48}
              className="avatar"
              src={`/api/users/${user.id}/passport`}
              alt=""
            />
          ) : (
            <div className="avatar">{initials}</div>
          )}
          <div>
            <strong>{user?.staffName ?? 'Guest user'}</strong>
            <span>{user?.role.name ?? 'Not signed in'}</span>
          </div>
        </div>
      </aside>

      <div className="app-column">
        <header className="topbar">
          <button
            className="desktop-sidebar-toggle"
            onClick={() => setSidebarCollapsed((collapsed) => !collapsed)}
            aria-label={sidebarCollapsed ? 'Expand side navigation' : 'Collapse side navigation'}
            title={sidebarCollapsed ? 'Expand navigation' : 'Collapse navigation'}
          >
            {sidebarCollapsed ? <PanelLeftOpen size={20} /> : <PanelLeftClose size={20} />}
            <span>{sidebarCollapsed ? 'Show menu' : 'Hide menu'}</span>
          </button>
          <button className="icon-button mobile-menu" onClick={() => setSidebarOpen(true)}>
            <Menu size={20} />
            <span className="sr-only">Open navigation</span>
          </button>
          <div className="global-search-anchor">
            <label className="global-search">
              <Search size={18} />
              <input
                ref={searchInput}
                value={globalSearch}
                onChange={(event) => {
                  setGlobalSearch(event.target.value);
                  setSearchOpen(true);
                }}
                onFocus={() => setSearchOpen(true)}
                onBlur={() => window.setTimeout(() => setSearchOpen(false), 160)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && combinedSearchResults[0]) {
                    event.preventDefault();
                    openSearchResult(combinedSearchResults[0]);
                  }
                }}
                placeholder="Search vehicles, drivers, requests or modules"
                aria-label="Global fleet search"
                role="combobox"
                aria-expanded={searchOpen}
                aria-controls="global-search-results"
              />
              <kbd>Ctrl K</kbd>
            </label>
            {searchOpen && globalSearch.trim() && (
              <section
                id="global-search-results"
                className="global-search-results"
                aria-label="Search results"
              >
                <header>
                  <strong>Search results</strong>
                  <small>
                    {searching ? 'Searching records…' : `${combinedSearchResults.length} found`}
                  </small>
                </header>
                {combinedSearchResults.length ? (
                  <div>
                    {combinedSearchResults.map((result) => (
                      <button
                        key={result.id}
                        type="button"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => openSearchResult(result)}
                      >
                        <span>
                          <b>{result.title}</b>
                          <small>{result.detail}</small>
                        </span>
                        <em>{result.type}</em>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p>
                    {searching ? 'Checking fleet records…' : 'No matching fleet record or module.'}
                  </p>
                )}
                <footer>Press Enter to open the first result · Esc to close</footer>
              </section>
            )}
          </div>
          <div className="topbar-actions">
            <button className="icon-button" onClick={toggleTheme} aria-label="Toggle color theme">
              <Sun className="theme-icon dark-icon" size={19} />
              <Moon className="theme-icon light-icon" size={19} />
            </button>
            <div className="popover-anchor">
              <button
                className="icon-button notification-trigger"
                onClick={() => {
                  setNotificationsOpen(!notificationsOpen);
                  setProfileOpen(false);
                }}
                aria-expanded={notificationsOpen}
                aria-label="Notifications"
              >
                <Bell size={19} />
                {notifications.length > 0 && (
                  <span className="notification-badge">{notifications.length}</span>
                )}
              </button>
              {notificationsOpen && (
                <NotificationPanel
                  notifications={notifications}
                  onClose={() => setNotificationsOpen(false)}
                />
              )}
            </div>
            <div className="popover-anchor">
              <button
                className="profile-trigger"
                onClick={() => {
                  setProfileOpen(!profileOpen);
                  setNotificationsOpen(false);
                }}
                aria-expanded={profileOpen}
              >
                {user?.passportMimeType ? (
                  <Image
                    unoptimized
                    width={36}
                    height={36}
                    className="avatar small"
                    src={`/api/users/${user.id}/passport`}
                    alt=""
                  />
                ) : (
                  <span className="avatar small">{initials}</span>
                )}
                <span className="profile-copy">
                  <strong>{user?.staffName ?? 'Guest user'}</strong>
                  <small>{user?.role.name ?? 'Not signed in'}</small>
                </span>
                <ChevronDown size={15} />
              </button>
              {profileOpen && <ProfileMenu user={user} initials={initials} />}
            </div>
          </div>
        </header>
        <div className="app-content">
          {!authLoaded ? (
            <section className="master-panel">
              <div className="master-loading">
                <span />
                <span />
                <span />
              </div>
            </section>
          ) : !user ? (
            <AccessDenied
              title="Sign in required"
              message="Please sign in to access the fleet management system."
              actionHref="/login"
              actionLabel="Sign in"
            />
          ) : !routeAllowed ? (
            <AccessDenied
              title="Permission required"
              message="Your role does not have access to this module."
            />
          ) : (
            <>
              {pathname === '/fleet/vehicles' && <CsvImportBar type="vehicles" />}
              {pathname === '/fleet/drivers' && <CsvImportBar type="drivers" />}
              {pathname === '/administration/locations' && <CsvImportBar type="locations" />}
              {pathname === '/administration/departments' && <CsvImportBar type="departments" />}
              {pathname === '/administration/locations' && <LocationMapPanel />}
              {children}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function mutationSuccessMessage(url: string, method: string) {
  if (url.includes('/vehicle-requests'))
    return method === 'POST'
      ? 'Vehicle request submitted successfully.'
      : 'Vehicle request updated successfully.';
  if (url.includes('/fuel/entries'))
    return method === 'POST'
      ? 'Fuel record submitted successfully.'
      : 'Fuel record updated successfully.';
  if (url.includes('/maintenance') && url.includes('/driver-feedback'))
    return 'Maintenance feedback sent successfully.';
  if (url.includes('/maintenance') && url.includes('/review'))
    return 'Maintenance decision saved successfully.';
  if (url.includes('/maintenance'))
    return method === 'POST'
      ? 'Maintenance report submitted successfully.'
      : 'Maintenance record updated successfully.';
  if (method === 'DELETE') return 'Record deleted successfully.';
  if (method === 'POST') return 'Record submitted successfully.';
  return 'Changes saved successfully.';
}

type GlobalSearchResult = {
  id: string;
  title: string;
  detail: string;
  href: string;
  type: 'Module' | 'Vehicle' | 'Driver' | 'Request';
};

function globalRecordResults(
  type: 'Vehicle' | 'Driver' | 'Request',
  records: Record<string, unknown>[],
  query: string,
): GlobalSearchResult[] {
  const term = query.toLowerCase();
  return records
    .map((record): GlobalSearchResult => {
      if (type === 'Vehicle') {
        const registration = String(record.registrationNumber ?? 'Vehicle');
        const vehicleType = record.vehicleType as { name?: string } | null | undefined;
        return {
          id: `vehicle:${String(record.id)}`,
          title: registration,
          detail:
            vehicleType?.name ||
            [record.manufacturer, record.model].filter(Boolean).map(String).join(' ') ||
            'Fleet vehicle',
          href: '/fleet/vehicles',
          type,
        };
      }
      if (type === 'Driver') {
        return {
          id: `driver:${String(record.id)}`,
          title: String(record.staffName ?? 'Driver'),
          detail: [record.employeeId, record.email, record.phone]
            .filter(Boolean)
            .map(String)
            .join(' · '),
          href: '/fleet/drivers',
          type,
        };
      }
      return {
        id: `request:${String(record.id)}`,
        title: String(record.requestNumber ?? 'Vehicle request'),
        detail: [record.staffName, record.destination, record.status]
          .filter(Boolean)
          .map(String)
          .join(' · '),
        href: '/fleet/vehicle-requests/review',
        type,
      };
    })
    .filter((result) => `${result.title} ${result.detail}`.toLowerCase().includes(term))
    .slice(0, 4);
}

function shouldAutoCollapseSidebar(pathname: string) {
  return [
    '/analytics/reports',
    '/fleet/vehicles',
    '/fleet/drivers',
    '/fleet/trips',
    '/fleet/vehicle-allocation',
    '/fleet/vehicle-requests/review',
    '/administration/',
    '/fuel/dashboard',
    '/operations/speed-overspeed',
  ].some((path) => pathname === path || (path.endsWith('/') && pathname.startsWith(path)));
}

function sidebarCount(href: string, roleCode: string | undefined, metrics: Record<string, number>) {
  if (roleCode === 'ST' && href === '/fleet/vehicle-requests/new')
    return metrics.pendingRequests ?? 0;
  if (roleCode === 'DRIVER') {
    if (href === '/operations/gps-tracking')
      return (metrics.activeTrips ?? 0) + (metrics.upcomingAssignments ?? 0);
    if (href === '/operations/maintenance') return metrics.openMaintenance ?? 0;
    return 0;
  }
  const metricByPath: Record<string, string> = {
    '/fleet/vehicles': 'vehicles',
    '/fleet/drivers': 'drivers',
    '/fleet/vehicle-requests/review': 'pendingRequests',
    '/fleet/vehicle-allocation': 'activeAllocations',
    '/fleet/trips': 'activeTrips',
    '/operations/gps-tracking': 'activeTrips',
    '/operations/maintenance': 'openMaintenance',
    '/fuel/dashboard': 'pendingFuelEntries',
    '/fuel/operations': 'openFuelAlerts',
  };
  return metrics[metricByPath[href]] ?? 0;
}

function AccessDenied({
  title,
  message,
  actionHref = '/dashboard',
  actionLabel = 'Go to dashboard',
}: {
  title: string;
  message: string;
  actionHref?: string;
  actionLabel?: string;
}) {
  return (
    <section className="master-panel">
      <div className="master-empty">
        <ShieldCheck size={30} />
        <h2>{title}</h2>
        <p>{message}</p>
        <Link className="primary-action" href={actionHref}>
          {actionLabel}
        </Link>
      </div>
    </section>
  );
}

function NotificationPanel({
  onClose,
  notifications,
}: {
  onClose: () => void;
  notifications: { id: string; title: string; message: string; createdAt: string }[];
}) {
  return (
    <section className="popover notification-panel" aria-label="Notifications">
      <header>
        <div>
          <strong>Notifications</strong>
          <span>{notifications.length} pending</span>
        </div>
        <button className="text-button" onClick={onClose}>
          Close
        </button>
      </header>
      <div className="notification-list">
        {notifications.map((item) => (
          <NotificationItem
            key={item.id}
            title={item.title}
            meta={`${item.message} · ${new Date(item.createdAt).toLocaleString()}`}
          />
        ))}
        {notifications.length === 0 && (
          <div className="empty-compact">
            <strong>No notifications</strong>
            <span>Database events requiring attention will appear here.</span>
          </div>
        )}
      </div>
    </section>
  );
}

function NotificationItem({ title, meta }: { title: string; meta: string }) {
  return (
    <button className="notification-item">
      <span className="unread-dot" />
      <span>
        <strong>{title}</strong>
        <small>{meta}</small>
      </span>
    </button>
  );
}

function ProfileMenu({
  user,
  initials,
}: {
  user: {
    id: string;
    staffName: string;
    email: string;
    passportMimeType?: string;
    role: { code: string; name: string };
  } | null;
  initials: string;
}) {
  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  }
  return (
    <div className="popover profile-menu">
      <div className="profile-summary">
        <span className="avatar">{initials}</span>
        <span>
          <strong>{user?.staffName ?? 'Guest user'}</strong>
          <small>{user?.email ?? 'Sign in to continue'}</small>
        </span>
      </div>
      <Link href="/profile">
        <UserRound size={17} /> My profile
      </Link>
      <div className="menu-separator" />
      <button onClick={() => void logout()}>
        <LogOut size={17} /> Sign out
      </button>
    </div>
  );
}
