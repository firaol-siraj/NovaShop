import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';

const ThemeContext = createContext({
  theme: 'system', // 'light' | 'dark' | 'system'
  resolvedTheme: 'light', // 'light' | 'dark'
  setTheme: () => {},
  toggleTheme: () => {},
});

const STORAGE_KEY = 'novashop-theme';

/**
 * Helper to determine system dark mode preference safely
 */
function getSystemPreference() {
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return 'light';
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === 'light' || stored === 'dark' || stored === 'system') {
        return stored;
      }
    } catch {}
    return 'system';
  });

  const [resolvedTheme, setResolvedTheme] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === 'light' || stored === 'dark') {
        return stored;
      }
      return getSystemPreference();
    } catch {}
    return 'light';
  });

  // Apply theme attributes to <html> with smooth switching transition
  const applyThemeDOM = useCallback((activeTheme, resolved, animate = false) => {
    try {
      const root = document.documentElement;
      const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      const updateAttributes = () => {
        root.setAttribute('data-theme', resolved);
        root.setAttribute('data-theme-preference', activeTheme);
        root.style.colorScheme = resolved;
        const metaThemeColor = document.querySelector('meta[name="theme-color"]');
        if (metaThemeColor) {
          metaThemeColor.setAttribute('content', resolved === 'dark' ? '#141210' : '#231E1B');
        }
      };

      if (!animate || prefersReducedMotion) {
        updateAttributes();
        return;
      }

      // Check if modern View Transitions API is supported
      if (typeof document.startViewTransition === 'function') {
        document.startViewTransition(() => {
          updateAttributes();
        });
      } else {
        // Fallback: apply temporary transition class on <html> for 220ms
        root.classList.add('theme-transitioning');
        updateAttributes();
        window.setTimeout(() => {
          root.classList.remove('theme-transitioning');
        }, 250);
      }
    } catch (err) {
      console.warn('Failed to apply theme to document root:', err);
    }
  }, []);

  const setTheme = useCallback((newTheme) => {
    if (newTheme !== 'light' && newTheme !== 'dark' && newTheme !== 'system') return;

    setThemeState(newTheme);
    try {
      localStorage.setItem(STORAGE_KEY, newTheme);
    } catch (err) {
      console.warn('Failed to save theme in localStorage:', err);
    }

    const resolved = newTheme === 'system' ? getSystemPreference() : newTheme;
    setResolvedTheme(resolved);
    applyThemeDOM(newTheme, resolved, true);
  }, [applyThemeDOM]);

  const toggleTheme = useCallback(() => {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
  }, [resolvedTheme, setTheme]);

  // Listen to OS system color scheme changes in real-time
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const handleSystemChange = (e) => {
      if (theme === 'system') {
        const resolved = e.matches ? 'dark' : 'light';
        setResolvedTheme(resolved);
        applyThemeDOM('system', resolved, true);
      }
    };

    mediaQuery.addEventListener('change', handleSystemChange);
    return () => mediaQuery.removeEventListener('change', handleSystemChange);
  }, [theme, applyThemeDOM]);

  // Sync theme changes across browser tabs via storage event
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleStorageChange = (e) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        const newTheme = e.newValue;
        if (newTheme === 'light' || newTheme === 'dark' || newTheme === 'system') {
          setThemeState(newTheme);
          const resolved = newTheme === 'system' ? getSystemPreference() : newTheme;
          setResolvedTheme(resolved);
          applyThemeDOM(newTheme, resolved, false);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [applyThemeDOM]);

  // Initial sync on mount without flash
  useEffect(() => {
    const resolved = theme === 'system' ? getSystemPreference() : theme;
    setResolvedTheme(resolved);
    applyThemeDOM(theme, resolved, false);
  }, [theme, applyThemeDOM]);

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

/**
 * Crisp, theme-aware SVGs
 */
export const SunIcon = ({ size = 15, className = '' }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
  </svg>
);

export const MoonIcon = ({ size = 15, className = '' }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
  </svg>
);

export const MonitorIcon = ({ size = 15, className = '' }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <rect width="20" height="14" x="2" y="3" rx="2" />
    <line x1="8" x2="16" y1="21" y2="21" />
    <line x1="12" x2="12" y1="17" y2="21" />
  </svg>
);

export const CheckIcon = ({ size = 13, className = '' }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

/**
 * Accessible ThemeToggle component supporting single-button, segmented, and dropdown variants
 */
export function ThemeToggle({ variant = 'button', className = '' }) {
  const { theme, resolvedTheme, setTheme, toggleTheme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  // Close menu on click outside
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  // Simple single-button toggle variant (storefront header, admin topbar & mobile)
  if (variant === 'button') {
    const isDark = resolvedTheme === 'dark';
    const label = isDark ? 'Switch to light mode' : 'Switch to dark mode';
    return (
      <button
        type="button"
        onClick={toggleTheme}
        aria-label={label}
        aria-pressed={isDark}
        title={label}
        className={`theme-simple-toggle-btn ${className}`}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '6px',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-primary)',
          borderRadius: '4px',
          transition: 'color 180ms ease, background-color 180ms ease, opacity 180ms ease',
        }}
      >
        {isDark ? <SunIcon size={18} /> : <MoonIcon size={18} />}
      </button>
    );
  }

  // Segmented control variant (e.g. used inside profile / settings)
  if (variant === 'segmented') {
    return (
      <div
        className={`theme-segmented-control ${className}`}
        role="group"
        aria-label="Theme selection"
      >
        <button
          type="button"
          className={`theme-seg-btn ${theme === 'light' ? 'is-active' : ''}`}
          onClick={() => setTheme('light')}
          aria-label="Switch to light theme"
          aria-pressed={theme === 'light'}
          title="Light theme"
        >
          <SunIcon size={14} />
          <span className="theme-seg-label">Light</span>
        </button>
        <button
          type="button"
          className={`theme-seg-btn ${theme === 'dark' ? 'is-active' : ''}`}
          onClick={() => setTheme('dark')}
          aria-label="Switch to dark theme"
          aria-pressed={theme === 'dark'}
          title="Dark theme"
        >
          <MoonIcon size={14} />
          <span className="theme-seg-label">Dark</span>
        </button>
        <button
          type="button"
          className={`theme-seg-btn ${theme === 'system' ? 'is-active' : ''}`}
          onClick={() => setTheme('system')}
          aria-label="Follow system theme"
          aria-pressed={theme === 'system'}
          title="System theme"
        >
          <MonitorIcon size={14} />
          <span className="theme-seg-label">System</span>
        </button>
      </div>
    );
  }

  // Active icon based on current selected mode (consistent with button variant)
  const getActiveIcon = () => {
    if (theme === 'system') return <MonitorIcon size={18} />;
    return resolvedTheme === 'dark' ? <SunIcon size={18} /> : <MoonIcon size={18} />;
  };

  const getThemeTitle = () => {
    const modeName = theme.charAt(0).toUpperCase() + theme.slice(1);
    return `Theme: ${modeName} (${resolvedTheme} active). Click to choose.`;
  };

  return (
    <div className={`theme-toggle-container relative inline-block ${className}`} ref={containerRef}>
      <button
        type="button"
        className="theme-toggle-btn"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label={getThemeTitle()}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        title={getThemeTitle()}
      >
        <span className="theme-toggle-icon">{getActiveIcon()}</span>
        <span className="theme-toggle-indicator" aria-hidden="true" />
      </button>

      {isOpen && (
        <div
          className="theme-dropdown-menu"
          role="menu"
          aria-label="Select color theme"
        >
          <button
            type="button"
            role="menuitemradio"
            aria-checked={theme === 'light'}
            className={`theme-menu-item ${theme === 'light' ? 'is-selected' : ''}`}
            onClick={() => {
              setTheme('light');
              setIsOpen(false);
            }}
          >
            <SunIcon size={15} />
            <span className="theme-item-text">Light</span>
            {theme === 'light' && <CheckIcon size={13} className="theme-check-icon" />}
          </button>
          <button
            type="button"
            role="menuitemradio"
            aria-checked={theme === 'dark'}
            className={`theme-menu-item ${theme === 'dark' ? 'is-selected' : ''}`}
            onClick={() => {
              setTheme('dark');
              setIsOpen(false);
            }}
          >
            <MoonIcon size={15} />
            <span className="theme-item-text">Dark</span>
            {theme === 'dark' && <CheckIcon size={13} className="theme-check-icon" />}
          </button>
          <button
            type="button"
            role="menuitemradio"
            aria-checked={theme === 'system'}
            className={`theme-menu-item ${theme === 'system' ? 'is-selected' : ''}`}
            onClick={() => {
              setTheme('system');
              setIsOpen(false);
            }}
          >
            <MonitorIcon size={15} />
            <span className="theme-item-text">System</span>
            {theme === 'system' && <CheckIcon size={13} className="theme-check-icon" />}
          </button>
        </div>
      )}
    </div>
  );
}

export default ThemeContext;
