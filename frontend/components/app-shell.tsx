'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import {
  Bell,
  ChevronDown,
  LogOut,
  Menu,
  Moon,
  Search,
  Settings,
  ShieldCheck,
  Sun,
  UserRound,
  X,
} from 'lucide-react';
import { ReactNode, useEffect, useState } from 'react';
import { canAccessPath, visibleNavigation } from './navigation';
import { CsvImportBar } from './csv-import-bar';
import { LocationMapPanel } from './location-map-panel';

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [authLoaded, setAuthLoaded] = useState(false);
  const [user, setUser] = useState<{ id: string; staffName: string; email: string; passportMimeType?: string; role: { code: string; name: string } } | null>(null);
  const [notifications, setNotifications] = useState<{ id: string; title: string; message: string; createdAt: string }[]>([]);
  useEffect(() => { fetch('/api/auth/me').then(async r => r.ok ? r.json() : null).then(p => setUser(p?.user ?? null)).catch(() => undefined).finally(() => setAuthLoaded(true)); }, []);
  useEffect(() => { fetch('/api/dashboard?days=30').then(async r => r.ok ? r.json() : null).then(p => setNotifications(p?.notifications ?? [])).catch(() => undefined); }, []);
  const initials = user?.staffName.split(/\s+/).map(part => part[0]).slice(0, 2).join('').toUpperCase() || 'GU';
  const roleCode = user?.role.code;
  const navGroups = visibleNavigation(roleCode);
  const routeAllowed = authLoaded && user ? canAccessPath(pathname, roleCode) : true;

  function toggleTheme() {
    const next = document.documentElement.dataset.theme !== 'dark';
    document.documentElement.dataset.theme = next ? 'dark' : 'light';
    localStorage.setItem('fleet-theme', next ? 'dark' : 'light');
  }

  return (
    <div className="app-shell">
      <button
        className={`sidebar-backdrop ${sidebarOpen ? 'visible' : ''}`}
        aria-label="Close navigation"
        onClick={() => setSidebarOpen(false)}
      />
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="brand">
          <Image className="brand-logo" src="/nmdpra-logo.png" alt="NMDPRA logo" width={96} height={96} priority />
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
                return (
                  <Link
                    className={active ? 'active' : ''}
                    href={item.href}
                    key={item.href}
                    onClick={() => setSidebarOpen(false)}
                  >
                    <Icon size={18} strokeWidth={1.8} />
                    <span>{item.label}</span>
                    {item.roles && (
                      <span className="role-dot" title="Role-restricted placeholder" />
                    )}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
        <div className="sidebar-user">
          {user?.passportMimeType ? <img className="avatar" src={`/api/users/${user.id}/passport`} alt="" /> : <div className="avatar">{initials}</div>}
          <div>
            <strong>{user?.staffName ?? 'Guest user'}</strong>
            <span>{user?.role.name ?? 'Not signed in'}</span>
          </div>
        </div>
      </aside>

      <div className="app-column">
        <header className="topbar">
          <button className="icon-button mobile-menu" onClick={() => setSidebarOpen(true)}>
            <Menu size={20} />
            <span className="sr-only">Open navigation</span>
          </button>
          <label className="global-search">
            <Search size={18} />
            <input placeholder="Search fleet records…" aria-label="Global search" />
            <kbd>Ctrl K</kbd>
          </label>
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
                {notifications.length > 0 && <span className="notification-badge">{notifications.length}</span>}
              </button>
              {notificationsOpen && (
                <NotificationPanel notifications={notifications} onClose={() => setNotificationsOpen(false)} />
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
                {user?.passportMimeType ? <img className="avatar small" src={`/api/users/${user.id}/passport`} alt="" /> : <span className="avatar small">{initials}</span>}
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
            <AccessDenied title="Sign in required" message="Please sign in to access the fleet management system." />
          ) : !routeAllowed ? (
            <AccessDenied title="Permission required" message="Your role does not have access to this module." />
          ) : (
            <>
              {pathname === '/fleet/vehicles' && <CsvImportBar type="vehicles" />}
              {pathname === '/fleet/drivers' && <CsvImportBar type="drivers" />}
              {pathname === '/administration/locations' && <CsvImportBar type="locations" />}
              {pathname === '/administration/locations' && <LocationMapPanel />}
              {children}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function AccessDenied({ title, message }: { title: string; message: string }) {
  return (
    <section className="master-panel">
      <div className="master-empty">
        <ShieldCheck size={30} />
        <h2>{title}</h2>
        <p>{message}</p>
        <Link className="primary-action" href="/dashboard">
          Go to dashboard
        </Link>
      </div>
    </section>
  );
}

function NotificationPanel({ onClose, notifications }: { onClose: () => void; notifications: { id: string; title: string; message: string; createdAt: string }[] }) {
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
        {notifications.map((item) => <NotificationItem key={item.id} title={item.title} meta={`${item.message} · ${new Date(item.createdAt).toLocaleString()}`} />)}
        {notifications.length === 0 && <div className="empty-compact"><strong>No notifications</strong><span>Database events requiring attention will appear here.</span></div>}
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

function ProfileMenu({ user, initials }: { user: { id: string; staffName: string; email: string; passportMimeType?: string; role: { code: string; name: string } } | null; initials: string }) {
  async function logout() { await fetch('/api/auth/logout', { method: 'POST' }); window.location.href = '/login'; }
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
      <button>
        <Settings size={17} /> Preferences
      </button>
      <div className="menu-separator" />
      <button onClick={() => void logout()}>
        <LogOut size={17} /> Sign out
      </button>
    </div>
  );
}
