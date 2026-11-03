import { useEffect, useState, useRef } from 'react';
import { useAdminAuth } from '../../context/AdminAuthContext';
import BrandLogo from './BrandLogo';
import AdminGlobalSearchModal from './AdminGlobalSearchModal';
import AdminNotificationDropdown from './AdminNotificationDropdown';
import { useAdminNotifications } from '../../hooks/useAdminDashboard';
import { ThemeToggle } from '../../context/ThemeContext';
import './admin-dashboard.css';

export function AdminIcon({ name, size = 18 }) {
  const common = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round' };
  const paths = {
    dashboard: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
    orders: <><path d="M4 7h16l-1 13H5L4 7Z" /><path d="M9 9V6a3 3 0 0 1 6 0v3" /></>,
    products: <><path d="m12 3 9 5-9 5-9-5 9-5Z" /><path d="m3 12 9 5 9-5M3 16l9 5 9-5" /></>,
    categories: <><path d="M20.6 13.4 13 21l-10-10V3h8l9.6 9.6a.6.6 0 0 1 0 .8Z" /><circle cx="7.5" cy="7.5" r="1" /></>,
    customers: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 5.5a3.5 3.5 0 0 1 0 6.8M18 14a5.5 5.5 0 0 1 3.5 5" /></>,
    inventory: <><path d="M4 5h16v15H4z" /><path d="M8 5V3h8v2M8 10h8M8 14h5" /></>,
    discounts: <><path d="M20 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7" /><path d="m15 3 6 6M21 3l-9 9" /></>,
    reviews: <><path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9L12 3Z" /></>,
    analytics: <><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></>,
    content: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M7 8h10M7 12h10M7 16h6" /></>,
    returns: <><path d="M3 11a9 9 0 1 1 2.6 6.4L3 15" /><path d="M3 9V15h6M12 7v5l3 2" /></>,
    shipping: <><path d="M3 6h11v12H3zM14 10h4l3 3v5h-7z" /><circle cx="7.5" cy="19" r="1.5" /><circle cx="18" cy="19" r="1.5" /></>,
    payments: <><rect x="2.5" y="5" width="19" height="14" rx="2" /><path d="M2.5 10h19M6 15h4" /></>,
    support: <><path d="M4 13v-2a8 8 0 0 1 16 0v2" /><path d="M4 13H3a1 1 0 0 0-1 1v3a1 1 0 0 0 1 1h3v-5H4ZM20 13h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-3v-5h2ZM17 19c-1 2-3 2-5 2" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="m19.4 15 .1.1 1.4 1.1-1.4 2.4-1.7-.6a8 8 0 0 1-1.6.9l-.3 1.8h-2.8l-.3-1.8a8 8 0 0 1-1.6-.9l-1.7.6-1.4-2.4 1.4-1.1a8 8 0 0 1 0-1.9l-1.4-1.1 1.4-2.4 1.7.6a8 8 0 0 1 1.6-.9l.3-1.8h2.8l.3 1.8a8 8 0 0 1 1.6.9l1.7-.6 1.4 2.4-1.4 1.1a8 8 0 0 1-.1 1.8Z" /></>,
    collapse: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M9 4v16M15 9l-3 3 3 3" /></>,
    search: <><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 4.5 4.5" /></>,
    bell: <><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></>,
    mail: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></>,
    chevron: <path d="m9 18 6-6-6-6" />,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></>,
    clock: <circle cx="12" cy="12" r="8.5" />,
    download: <><path d="M12 3v12m0 0 4-4m-4 4-4-4M4 17v4h16v-4" /></>,
    plus: <><path d="M12 5v14M5 12h14" /></>,
    truck: <><path d="M3 6h11v12H3zM14 10h4l3 3v5h-7z" /><circle cx="7.5" cy="19" r="1.5" /><circle cx="18" cy="19" r="1.5" /></>,
    eye: <><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" /><circle cx="12" cy="12" r="2.5" /></>,
    left: <path d="m15 18-6-6 6-6" />,
    print: <><path d="M6 9V3h12v6M6 17H4a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2" /><path d="M6 14h12v7H6z" /></>,
    close: <><path d="m6 6 12 12M18 6 6 18" /></>,
    filter: <><path d="M4 5h16M7 12h10m-7 7h4" /><circle cx="7" cy="5" r="1" fill="currentColor" /><circle cx="17" cy="12" r="1" fill="currentColor" /><circle cx="10" cy="19" r="1" fill="currentColor" /></>,
    location: <><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></>,
    phone: <path d="M7 3H5a2 2 0 0 0-2 2c0 8.8 7.2 16 16 16a2 2 0 0 0 2-2v-2l-5-2-2 3a14 14 0 0 1-8-8l3-2-2-5Z" />,
    check: <path d="m5 12 4 4L19 6" />,
    document: <><path d="M6 3h9l4 4v14H6z" /><path d="M14 3v5h5M9 13h7M9 17h7" /></>,
    searchSlash: <><circle cx="10" cy="10" r="6.5" /><path d="m15 15 5 5M4 20 20 4" /></>,
    sort: <><path d="M8 4v16m0 0-3-3m3 3 3-3M16 20V4m0 0-3 3m3-3 3 3" /></>,
    package: <><path d="m12 3 9 5v8l-9 5-9-5V8l9-5Z" /><path d="m3 8 9 5 9-5M12 13v8M7.5 5.5l9 5" /></>,
    copy: <><rect x="8" y="8" width="13" height="13" rx="2" /><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3" /></>,
    more: <><circle cx="5" cy="12" r="1" fill="currentColor" /><circle cx="12" cy="12" r="1" fill="currentColor" /><circle cx="19" cy="12" r="1" fill="currentColor" /></>,
    lock: <><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></>,
    warning: <><path d="M12 3 2.8 20h18.4L12 3Z" /><path d="M12 9v5m0 3h.01" /></>,
    alert: <><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></>,
    refresh: <><path d="M3 12a9 9 0 0 1 15-6.7L21 8M21 3v5h-5M21 12a9 9 0 0 1-15 6.7L3 16M3 21v-5h5" /></>,
    edit: <><path d="m4 20 4.5-1 10-10a2.1 2.1 0 0 0-3-3l-10 10L4 20Z" /><path d="m13.5 7.5 3 3" /></>,
    pencil: <><path d="m4 20 4.5-1 10-10a2.1 2.1 0 0 0-3-3l-10 10L4 20Z" /><path d="m13.5 7.5 3 3" /></>,
    email: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></>,
    duplicate: <><rect x="8" y="8" width="13" height="13" rx="2" /><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3" /></>,
    bag: <><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4zM3 6h18M16 10a4 4 0 0 1-8 0" /></>,

    receipt: <><path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z" /><path d="M9 8h6M9 12h6M9 16h3" /></>,

    stop: <><circle cx="12" cy="12" r="9" /><rect x="9" y="9" width="6" height="6" rx="1" /></>,

    trash: <><path d="M4 7h16M10 11v6M14 11v6M6 7l1 14h10l1-14M9 7V4h6v3" /></>,

    code: <><path d="m8 8-4 4 4 4M16 8l4 4-4 4M14 5l-4 14" /></>,

    sliders: <><path d="M4 6h16M4 12h16M4 18h16" /><circle cx="9" cy="6" r="2" /><circle cx="15" cy="12" r="2" /><circle cx="10" cy="18" r="2" /></>,

    x: <><path d="m6 6 12 12M18 6 6 18" /></>,
    store: <><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></>,
    percent: <><line x1="19" y1="5" x2="5" y2="19"></line><circle cx="6.5" cy="6.5" r="2.5"></circle><circle cx="17.5" cy="17.5" r="2.5"></circle></>,
    user: <><circle cx="12" cy="8" r="4" /><path d="M6 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" /></>,
    logout: <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></>,
  };

  return <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" {...common}>{paths[name]}</svg>;
}

const navigation = [
  { label: 'Dashboard', icon: 'dashboard', path: '/admin/dashboard' },
  { label: 'Orders', icon: 'orders', path: '/admin/orders' },
  { label: 'Products', icon: 'products', path: '/admin/products' },
  { label: 'Categories', icon: 'categories', path: '/admin/categories' },
  { label: 'Customers', icon: 'customers', path: '/admin/customers' },
  { label: 'Inventory', icon: 'inventory', path: '/admin/inventory', },
  { label: 'Discounts', icon: 'discounts',  path: '/admin/discounts' },
  { label: 'Reviews', icon: 'reviews', path: '/admin/reviews' },
  {
    label: 'Analytics',
    icon: 'analytics',
    children: [
      { label: 'Analytical overview', path: '/admin/analytics/overview' },
      { label: 'Sales analytics', path: '/admin/analytics/sales' },
      { label: 'Product analytics', path: '/admin/analytics/products' },
      { label: 'Customer analytics', path: '/admin/analytics/customers' },
    ],
  },
  {
    label: 'Content',
    icon: 'content',
    children: [
      { label: 'Homepage content', path: '/admin/content/homepage' },
      { label: 'Hero slides', path: '/admin/content/hero' },
      { label: 'Media library', path: '/admin/content/media' }
    ]
  },

  { label: 'Returns and refunds', icon: 'returns', path: '/admin/returns' },
  { label: 'Shipping', icon: 'shipping', path: '/admin/shipping' },
  { label: 'Payments', icon: 'payments', path: '/admin/payments' },
  { label: 'Customer support', icon: 'support', path: '/admin/support' },
  { label: 'Settings', icon: 'settings', path: '/admin/settings' },
];

// A group's child can be a plain string (not wired to a route yet, e.g. Content)
// or an object with its own { label, path } (e.g. Analytics). This lets both
// shapes render from the same submenu markup without breaking Content.
function getChildMeta(child) {
  if (typeof child === 'string') {
    return { label: child, path: undefined };
  }
  return { label: child.label, path: child.path };
}

export default function AdminLayout({ children, go, activePath = '/admin/dashboard', breadcrumb }) {
  const { user, logout } = useAdminAuth();
  const [collapsed, setCollapsed] = useState(() => window.matchMedia('(max-width: 860px)').matches);
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // Real admin notifications
  const { data: notifData, refetch: refetchNotifs, lastUpdated: notifSyncTime } = useAdminNotifications({
    refreshInterval: 30000,
  });

  // Global search shortcut ⌘K / Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsSearchOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const [expandedGroups, setExpandedGroups] = useState(() => {
    // Auto-expand whichever group owns the current route (e.g. landing
    // directly on /admin/analytics/overview should open "Analytics").
    const initial = {};
    navigation.forEach((item) => {
      if (item.children?.some((child) => getChildMeta(child).path === activePath)) {
        initial[item.label] = true;
      }
    });
    return initial;
  });

  // Keep parent group expanded when activePath matches any child route (direct navigation, refresh, route change)
  useEffect(() => {
    navigation.forEach((item) => {
      if (item.children?.some((child) => getChildMeta(child).path === activePath)) {
        setExpandedGroups((prev) => ({ ...prev, [item.label]: true }));
      }
    });
  }, [activePath]);

  useEffect(() => {
    const media = window.matchMedia('(max-width: 860px)');
    const updateSidebar = () => setCollapsed(media.matches);
    window.addEventListener('resize', updateSidebar);
    media.addEventListener('change', updateSidebar);
    return () => {
      window.removeEventListener('resize', updateSidebar);
      media.removeEventListener('change', updateSidebar);
    };
  }, []);

  const toggleSidebar = () => setCollapsed((current) => !current);
  const toggleGroup = (label) => {
    setExpandedGroups((current) => ({ ...current, [label]: !current[label] }));
  };
  const displayName = user?.displayName || user?.name || 'Administrator';
  const initials = displayName.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
  const avatarUrl = user?.avatar;
  const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
  const shortcutLabel = isMac ? '⌘ K' : 'Ctrl K';

  const [profileOpen, setProfileOpen] = useState(false);
  const profileMenuRef = useRef(null);

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target)) {
        setProfileOpen(false);
      }
    };
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setProfileOpen(false);
      }
    };
    if (profileOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [profileOpen]);

  const handleLogout = async () => {
    await logout();
    go('/admin/login');
  };

  const role = user?.adminRole || 'owner';
  const roleLabel =
    role === 'owner' ? 'Owner' :
    role === 'admin' ? 'Administrator' :
    role === 'manager' ? 'Store Manager' :
    role === 'support' ? 'Support Agent' :
    role === 'viewer' ? 'Viewer' : 'Administrator';

  const permissions = user?.permissions;

  const resourceMap = {
    'Dashboard': null,
    'Orders': 'orders',
    'Products': 'products',
    'Categories': 'products',
    'Customers': 'customers',
    'Inventory': 'inventory',
    'Discounts': 'discounts',
    'Reviews': 'reviews',
    'Analytics': 'analytics',
    'Content': 'content',
    'Returns and refunds': 'returns',
    'Shipping': 'shipping',
    'Payments': 'payments',
    'Customer support': 'support',
    'Settings': 'settings',
  };

  const filteredNavigation = navigation.filter((item) => {
    if (role === 'owner') return true;
    const res = resourceMap[item.label];
    if (!res) return true;
    if (permissions && permissions[res]) {
      return permissions[res].length > 0;
    }
    if (role === 'manager') return res !== 'settings';
    if (role === 'support') return ['orders', 'customers', 'support', 'returns', 'products', 'reviews'].includes(res);
    if (role === 'viewer') return ['content', 'products'].includes(res);
    return true;
  });

  return (
    <div className={`admin-app-shell${collapsed ? ' is-collapsed' : ''}`}>
      <aside className="admin-sidebar" aria-label="Admin navigation">
        <div className="admin-sidebar-scroll">
          <div className="admin-sidebar-brand-row">
            <BrandLogo label="Admin Dashboard" />
            <button className="admin-icon-button admin-sidebar-toggle" type="button" onClick={toggleSidebar} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
              <AdminIcon name="collapse" />
            </button>
          </div>

          <nav className="admin-primary-nav">
            {filteredNavigation.map((item) => (
              <div className="admin-nav-group" key={item.label}>
                {(() => {
                  const hasActiveChild = item.children?.some(
                    (child) => getChildMeta(child).path === activePath
                  );
                  const isActive = item.path === activePath || hasActiveChild;
                  return (
                <button
                  className={`admin-nav-item${isActive ? ' is-active' : ''}${item.children ? ' has-children' : ''}`}
                  type="button"
                  onClick={item.children ? () => toggleGroup(item.label) : item.path ? () => go(item.path) : undefined}
                  title={collapsed ? item.label : undefined}
                  aria-label={item.label}
                  aria-current={isActive ? 'page' : undefined}
                  aria-expanded={item.children ? Boolean(expandedGroups[item.label]) : undefined}
                >
                  <AdminIcon name={item.icon} />
                  <span>{item.label}</span>
                  {item.children && <AdminIcon name="chevron" size={14} />}
                </button>
                  );
                })()}
                {item.children && expandedGroups[item.label] && !collapsed && (
                  <div className="admin-nav-submenu">
                    {item.children.map((child) => {
                      const { label: childLabel, path: childPath } = getChildMeta(child);
                      const isChildActive = childPath === activePath;

                      return (
                        <button
                          type="button"
                          key={childLabel}
                          className={isChildActive ? 'is-active' : ''}
                          aria-current={isChildActive ? 'page' : undefined}
                          onClick={childPath ? () => go(childPath) : () => toggleGroup(item.label)}
                        >
                          {childLabel}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </nav>
        </div>
      </aside>

      <div className="admin-main">
        <header className="admin-topbar">
          <div className="admin-topbar-leading">
            {breadcrumb && <div className="admin-topbar-breadcrumb"><button type="button" onClick={() => go('/admin/orders')}>Orders</button><span>/</span><strong>{breadcrumb}</strong></div>}
            <div
              className="admin-global-search cursor-pointer"
              role="button"
              tabIndex={0}
              onClick={() => setIsSearchOpen(true)}
              onKeyDown={(e) => e.key === 'Enter' && setIsSearchOpen(true)}
              aria-label="Open search"
            >
              <AdminIcon name="search" size={17} />
              <span className="text-xs text-[#A8A29A] select-none flex-1">Search orders, products, customers...</span>
              <kbd>{shortcutLabel}</kbd>
            </div>
          </div>
          <div className="admin-topbar-actions">
            <ThemeToggle variant="button" className="admin-theme-toggle" />

            <AdminNotificationDropdown
              notifications={notifData?.notifications || []}
              unreadCount={notifData?.unreadCount || 0}
              onRefresh={refetchNotifs}
              go={go}
            />

            <div className="relative inline-block" ref={profileMenuRef}>
              <button
                className="admin-profile-button"
                type="button"
                aria-label="Admin profile menu"
                aria-haspopup="true"
                aria-expanded={profileOpen}
                onClick={() => setProfileOpen((prev) => !prev)}
              >
                {avatarUrl ? (
                  <img src={avatarUrl} alt={displayName} className="admin-profile-avatar-img" />
                ) : (
                  <span className="admin-profile-avatar">{initials}</span>
                )}
                <span className="admin-profile-name">
                  {displayName}
                  <small>{roleLabel}</small>
                </span>
                <AdminIcon name="chevron" size={13} />
              </button>

              {profileOpen && (
                <div
                  className="admin-profile-dropdown"
                  role="menu"
                  aria-orientation="vertical"
                >
                  <div className="admin-profile-dropdown-header">
                    <div className="admin-profile-dropdown-name">{displayName}</div>
                    <div className="admin-profile-dropdown-email">{user?.email || 'admin@novashop.com'}</div>
                    <span className="admin-role-badge">{roleLabel}</span>
                  </div>
                  <div className="admin-profile-dropdown-divider" />
                  <button
                    type="button"
                    className="admin-profile-dropdown-item"
                    role="menuitem"
                    onClick={() => {
                      setProfileOpen(false);
                      go('/admin/profile');
                    }}
                  >
                    <AdminIcon name="user" size={15} />
                    <span>My profile</span>
                  </button>
                  <button
                    type="button"
                    className="admin-profile-dropdown-item"
                    role="menuitem"
                    onClick={() => {
                      setProfileOpen(false);
                      go('/admin/settings');
                    }}
                  >
                    <AdminIcon name="settings" size={15} />
                    <span>Settings</span>
                  </button>
                  <div className="admin-profile-dropdown-divider" />
                  <div style={{ padding: '6px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)' }}>Theme</span>
                    <ThemeToggle variant="segmented" />
                  </div>
                  <div className="admin-profile-dropdown-divider" />
                  <button
                    type="button"
                    className="admin-profile-dropdown-item is-signout"
                    role="menuitem"
                    onClick={() => {
                      setProfileOpen(false);
                      handleLogout();
                    }}
                  >
                    <AdminIcon name="logout" size={15} />
                    <span>Sign out</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <AdminGlobalSearchModal
          isOpen={isSearchOpen}
          onClose={() => setIsSearchOpen(false)}
          go={go}
        />

        <main className="admin-page-content">{children}</main>
      </div>
    </div>
  );
}