import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AdminIcon } from './AdminLayout';

/**
 * Universal, accessible, portal-rendered Action Menu for all admin tables.
 *
 * Specifications:
 * - Opens in a portal (never clipped by table overflow or z-index)
 * - Auto-flips upward near bottom edge and clamps within viewport
 * - Closes on outside click, Escape, and scroll
 * - Keyboard navigation (ArrowDown, ArrowUp, Home, End, Enter, Escape)
 * - Visual: rounded container, border plus soft shadow (border-only in dark mode)
 * - Subtle header with item name and muted subtitle (code, SKU, email)
 * - 36-40px items, 14px text, icons on every item
 * - Dividers before destructive items, destructive items in danger token
 * - Disabled items with tooltip explaining why and disabled styling
 * - Hidden items respected for permission/status checks
 */
export default function AdminRowActionMenu({
  items,
  header,
  title,
  subtitle,
  item,
  customer,
  isOpen,
  onClose,
  triggerRef,
  onView,
  onEdit,
  onViewOrders,
  onSendEmail,
  onToggleBlock,
  onDelete,
  canEdit = true,
  canDelete = true,
  canEmail = true,
  width = 240,
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const internalTriggerRef = useRef(null);

  const isControlled = isOpen !== undefined;
  const menuOpen = isControlled ? isOpen : internalOpen;
  const activeTriggerRef = isControlled ? triggerRef : internalTriggerRef;
  const handleClose = isControlled ? (onClose || (() => {})) : () => setInternalOpen(false);

  const menuRef = useRef(null);
  const [coords, setCoords] = useState({ top: 0, left: 0, placement: 'bottom' });
  const [focusedIndex, setFocusedIndex] = useState(-1);

  // Fallback customer menu items if items prop not provided
  const isBlocked = customer?.status === 'blocked' || customer?.status === 'deactivated' || customer?.isDeactivated;
  const rawItems = items || [
    {
      id: 'view',
      label: 'View customer',
      icon: 'eye',
      onClick: onView,
      enabled: true,
      danger: false,
    },
    {
      id: 'edit',
      label: 'Edit customer',
      icon: 'edit',
      onClick: onEdit,
      enabled: canEdit,
      disabled: !canEdit,
      disabledReason: 'You do not have permission to edit customers',
      danger: false,
    },
    {
      id: 'orders',
      label: 'View orders',
      icon: 'bag',
      onClick: onViewOrders,
      enabled: true,
      danger: false,
    },
    {
      id: 'email',
      label: 'Send email',
      icon: 'mail',
      onClick: onSendEmail,
      enabled: canEmail && !isBlocked,
      disabled: !canEmail || isBlocked,
      disabledReason: isBlocked ? 'Cannot email a blocked customer' : 'You do not have permission to send emails',
      danger: false,
    },
    {
      id: 'divider',
      isDivider: true,
    },
    {
      id: 'block',
      label: isBlocked ? 'Unblock customer' : 'Block customer',
      icon: isBlocked ? 'check' : 'alert',
      onClick: onToggleBlock,
      enabled: canEdit,
      disabled: !canEdit,
      disabledReason: 'You do not have permission to update customer status',
      danger: !isBlocked,
    },
    {
      id: 'delete',
      label: 'Delete customer',
      icon: 'trash',
      onClick: onDelete,
      enabled: canDelete,
      disabled: !canDelete,
      disabledReason: 'You do not have permission to delete customers',
      danger: true,
    },
  ];

  // Active items for navigation
  const visibleItems = rawItems.filter((item) => !item.hidden && item.enabled !== false);
  const actionableItems = visibleItems.filter((item) => !item.isDivider && !item.divider && !item.disabled);

  // Position calculation with auto-flip
  useEffect(() => {
    if (!menuOpen || !activeTriggerRef?.current) return;

    const updatePosition = () => {
      const rect = activeTriggerRef.current.getBoundingClientRect();
      const menuWidth = width;
      const actualHeight = menuRef.current?.offsetHeight;
      const estimatedHeight = actualHeight || Math.min(window.innerHeight - 20, visibleItems.length * 40 + 75);
      const margin = 6;

      let top = rect.bottom + margin;
      let placement = 'bottom';

      // Auto-flip upward if too close to bottom edge
      if (rect.bottom + estimatedHeight > window.innerHeight - 10) {
        top = Math.max(10, rect.top - estimatedHeight - margin);
        placement = 'top';
      }

      // Align right with trigger, bounded within viewport
      let left = rect.right - menuWidth;
      if (left < 10) left = 10;
      if (left + menuWidth > window.innerWidth - 10) {
        left = window.innerWidth - menuWidth - 10;
      }

      setCoords({ top, left, placement });
    };

    updatePosition();
    // Re-check right after render if actual height changed
    const animFrame = requestAnimationFrame(updatePosition);

    // Close on window/container scroll or resize
    window.addEventListener('scroll', handleClose, true);
    window.addEventListener('resize', handleClose);

    return () => {
      cancelAnimationFrame(animFrame);
      window.removeEventListener('scroll', handleClose, true);
      window.removeEventListener('resize', handleClose);
    };
  }, [menuOpen, activeTriggerRef, handleClose, width, visibleItems.length]);

  // Click outside and Escape key listeners
  useEffect(() => {
    if (!menuOpen) return;

    const handlePointerDown = (event) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target) &&
        activeTriggerRef.current &&
        !activeTriggerRef.current.contains(event.target)
      ) {
        handleClose();
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        handleClose();
        activeTriggerRef.current?.focus();
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [menuOpen, handleClose, activeTriggerRef]);

  const handleMenuKeyDown = (event) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setFocusedIndex((prev) => (prev + 1) % actionableItems.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setFocusedIndex((prev) => (prev - 1 + actionableItems.length) % actionableItems.length);
    } else if (event.key === 'Home') {
      event.preventDefault();
      setFocusedIndex(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      setFocusedIndex(actionableItems.length - 1);
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      const currentItem = actionableItems[focusedIndex];
      if (currentItem && !currentItem.disabled) {
        handleClose();
        activeTriggerRef.current?.focus();
        currentItem.onClick?.();
      }
    }
  };

  const headerTitle = header?.title || title || item?.name || item?.headline || item?.title || customer?.name;
  const headerSubtitle = header?.subtitle || subtitle || item?.subtitle || item?.sku || item?.code || customer?.email;

  const menuPortal = menuOpen
    ? createPortal(
    <div
      ref={menuRef}
      role="menu"
      aria-label="Table row actions"
      tabIndex={-1}
      onKeyDown={handleMenuKeyDown}
      style={{
        position: 'fixed',
        top: `${coords.top}px`,
        left: `${coords.left}px`,
        width: `${width}px`,
        maxHeight: 'calc(100vh - 20px)',
        overflowY: 'auto',
        zIndex: 99999,
        padding: '8px',
        borderRadius: '12px',
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-default)',
        boxShadow: 'var(--shadow-lg)',
        color: 'var(--text-primary)',
        opacity: (coords.top === 0 && coords.left === 0) ? 0 : 1,
        pointerEvents: (coords.top === 0 && coords.left === 0) ? 'none' : 'auto',
        animation: 'menuScaleFadeIn 120ms cubic-bezier(0.16, 1, 0.3, 1)',
        transformOrigin: coords.placement === 'top' ? 'bottom right' : 'top right',
      }}
      className="admin-portal-action-menu"
    >
      {/* Subtle header with item name and muted subtitle */}
      {(headerTitle || headerSubtitle) && (
        <div
          style={{
            padding: '6px 12px 10px',
            borderBottom: '1px solid var(--border-subtle)',
            marginBottom: '6px',
          }}
        >
          {headerTitle && (
            <div
              style={{
                fontSize: '13px',
                fontWeight: 700,
                color: 'var(--text-primary)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
              title={headerTitle}
            >
              {headerTitle}
            </div>
          )}
          {headerSubtitle && (
            <div
              style={{
                fontSize: '11px',
                color: 'var(--text-muted)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                marginTop: '1px',
              }}
              title={headerSubtitle}
            >
              {headerSubtitle}
            </div>
          )}
        </div>
      )}

      {/* Menu item list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
        {visibleItems.map((item, idx) => {
          if (item.isDivider || item.divider) {
            return (
              <div
                key={item.id || `divider-${idx}`}
                role="separator"
                style={{
                  height: '1px',
                  background: 'var(--border-subtle)',
                  margin: '4px 0',
                }}
              />
            );
          }

          const actionIndex = actionableItems.findIndex((a) => a.id === item.id);
          const isFocused = actionIndex === focusedIndex;
          const isDisabled = Boolean(item.disabled);

          return (
            <button
              key={item.id || item.label}
              role="menuitem"
              type="button"
              disabled={isDisabled}
              title={isDisabled ? (item.disabledReason || 'Action not permitted') : undefined}
              onClick={() => {
                if (isDisabled) return;
                handleClose();
                activeTriggerRef.current?.focus();
                item.onClick?.();
              }}
              onMouseEnter={() => {
                if (!isDisabled) setFocusedIndex(actionIndex);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                width: '100%',
                minHeight: '38px',
                padding: '0 12px',
                border: 0,
                borderRadius: '8px',
                background: isFocused && !isDisabled
                  ? item.danger
                    ? 'var(--color-danger-soft)'
                    : 'var(--bg-surface-raised)'
                  : 'transparent',
                color: isDisabled
                  ? 'var(--text-subtle)'
                  : item.danger
                  ? 'var(--color-danger)'
                  : 'var(--text-primary)',
                opacity: isDisabled ? 0.45 : 1,
                fontFamily: 'var(--font-sans)',
                fontSize: '14px',
                fontWeight: 500,
                textAlign: 'left',
                cursor: isDisabled ? 'not-allowed' : 'pointer',
                transition: 'background 120ms ease, color 120ms ease',
                outline: 'none',
              }}
            >
              <span
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '18px',
                  height: '18px',
                  flexShrink: 0,
                  color: isDisabled
                    ? 'var(--text-subtle)'
                    : item.danger
                    ? 'var(--color-danger)'
                    : 'var(--text-muted)',
                }}
              >
                <AdminIcon name={item.icon || 'more'} size={16} />
              </span>
              <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {item.label}
              </span>
              {isDisabled && item.disabledReason && (
                <span
                  style={{
                    fontSize: '10px',
                    color: 'var(--text-subtle)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                  }}
                >
                  Disabled
                </span>
              )}
            </button>
          );
        })}
      </div>

      <style>{`
        @keyframes menuScaleFadeIn {
          from {
            opacity: 0;
            transform: scale(0.96) translateY(-4px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
      `}</style>
    </div>,
    document.body
  ) : null;

  if (isControlled) {
    return menuPortal;
  }

  return (
    <>
      <button
        ref={internalTriggerRef}
        type="button"
        className="products-row-menu-button admin-row-menu-trigger"
        onClick={(e) => {
          e.stopPropagation();
          if (!internalOpen && internalTriggerRef.current) {
            const rect = internalTriggerRef.current.getBoundingClientRect();
            const estimatedHeight = Math.min(window.innerHeight - 20, visibleItems.length * 40 + 75);
            let top = rect.bottom + 6;
            let placement = 'bottom';
            if (rect.bottom + estimatedHeight > window.innerHeight - 10) {
              top = Math.max(10, rect.top - estimatedHeight - 6);
              placement = 'top';
            }
            let left = rect.right - width;
            if (left < 10) left = 10;
            if (left + width > window.innerWidth - 10) {
              left = window.innerWidth - width - 10;
            }
            setCoords({ top, left, placement });
          }
          setInternalOpen((prev) => !prev);
        }}
        aria-label={title ? `Actions for ${title}` : 'Row actions'}
        aria-haspopup="true"
        aria-expanded={internalOpen}
      >
        <AdminIcon name="more" size={16} />
      </button>
      {menuPortal}
    </>
  );
}
