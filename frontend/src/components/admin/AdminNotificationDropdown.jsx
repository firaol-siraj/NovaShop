import { useState, useRef, useEffect } from 'react';
import { AdminIcon } from './AdminLayout';
import adminApi from '../../lib/api/adminApi';
import { formatRelativeTime } from '../../lib/formatters';

export default function AdminNotificationDropdown({
  notifications = [],
  unreadCount = 0,
  onRefresh,
  go,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isOpen]);

  const handleMarkAsRead = async (id, e) => {
    e.stopPropagation();
    try {
      await adminApi.markNotificationRead(id);
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error('Failed to mark notification read:', err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await adminApi.markAllNotificationsRead();
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error('Failed to mark all read:', err);
    }
  };

  const handleNotificationClick = (item) => {
    if (!item.isRead) {
      adminApi.markNotificationRead(item._id).catch(() => {});
      if (onRefresh) onRefresh();
    }

    setIsOpen(false);

    // If it's a support conversation notification, make sure conversation ID is in the query param
    const convId = item.data?.conversationId || (item.entityType === 'conversation' ? item.entityId : null) || (item.link?.includes('/admin/support') ? item.entityId : null);
    const msgId = item.data?.messageId;

    if (convId && (item.entityType === 'conversation' || item.link?.startsWith('/admin/support') || item.type === 'new_ticket' || item.type === 'support_reply')) {
      const target = `/admin/support?conversation=${convId}${msgId ? `#message=${msgId}` : ''}`;
      go(target);
      return;
    }

    if (item.link && item.link !== '/admin/support') {
      go(item.link);
      return;
    }

    const orderId = item.data?.orderId || (item.entityType === 'order' ? item.entityId : null);
    const productId = item.data?.productId || (item.entityType === 'product' ? item.entityId : null);
    const customerId = item.data?.customerId || (item.entityType === 'customer' ? item.entityId : null);
    const variantId = item.data?.variantId || (item.entityType === 'variant' ? item.entityId : null);
    const returnId = item.data?.returnId || (item.type === 'refund_request' ? item.entityId : null);

    if (returnId) {
      go(`/admin/returns/${returnId}`);
    } else if (orderId) {
      go(`/admin/orders/${orderId}`);
    } else if (productId) {
      go(`/admin/products/${productId}`);
    } else if (variantId || item.type === 'low_stock') {
      const sku = item.data?.sku;
      go(sku ? `/admin/inventory?search=${encodeURIComponent(sku)}` : `/admin/inventory`);
    } else if (customerId) {
      go(`/admin/customers/${customerId}`);
    } else if (item.type === 'new_review' || item.entityType === 'review') {
      go('/admin/reviews');
    } else {
      go('/admin/notifications');
    }
  };

  return (
    <div className="relative inline-block" ref={containerRef}>
      <button
        className="admin-icon-button admin-notification-button"
        type="button"
        aria-label="Notifications"
        onClick={() => setIsOpen((prev) => !prev)}
      >
        <AdminIcon name="bell" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#B04F3D] px-1 text-[9px] font-bold text-white shadow-sm">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 z-50 mt-2 w-80 sm:w-96 rounded-xl border border-[#DDD6CC] bg-white shadow-2xl ring-1 ring-black/5">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[#ECE7E0] bg-[#FAF8F5] px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-[#1B1816]">Notifications</span>
              {unreadCount > 0 && (
                <span className="rounded-full bg-[#F9EEEB] px-2 py-0.5 text-[10px] font-bold text-[#B04F3D]">
                  {unreadCount} unread
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="text-[10px] font-semibold text-[#766247] hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-[380px] overflow-y-auto divide-y divide-[#F0ECE6]">
            {notifications.length === 0 ? (
              <div className="py-12 text-center text-xs text-[#8A847C]">
                No notifications right now.
              </div>
            ) : (
              notifications.map((item) => (
                <div
                  key={item._id}
                  onClick={() => handleNotificationClick(item)}
                  className={`flex cursor-pointer items-start gap-3 p-3.5 transition hover:bg-[#F9F7F4] ${
                    !item.isRead ? 'bg-[#FCFAF8]' : ''
                  }`}
                >
                  <div className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border border-[#E8E1D8] bg-[#F4EFEA] text-[#675544]">
                    {item.type === 'new_order' && <AdminIcon name="orders" size={14} />}
                    {item.type === 'low_stock' && <AdminIcon name="warning" size={14} />}
                    {item.type === 'failed_payment' && <AdminIcon name="x" size={14} />}
                    {item.type === 'new_customer' && <AdminIcon name="customers" size={14} />}
                    {item.type === 'system' && <AdminIcon name="sliders" size={14} />}
                    {![
                      'new_order',
                      'low_stock',
                      'failed_payment',
                      'new_customer',
                      'system',
                    ].includes(item.type) && <AdminIcon name="bell" size={14} />}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <p
                        className={`text-xs truncate ${
                          !item.isRead ? 'font-bold text-[#1B1816]' : 'font-medium text-[#423D38]'
                        }`}
                      >
                        {item.title}
                      </p>
                      <span className="text-[9px] text-[#9A948C] flex-shrink-0">
                        {formatRelativeTime(item.createdAt)}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[11px] text-[#6F6962] line-clamp-2">
                      {item.message}
                    </p>
                  </div>

                  {!item.isRead && (
                    <button
                      type="button"
                      title="Mark as read"
                      onClick={(e) => handleMarkAsRead(item._id, e)}
                      className="mt-1 flex-shrink-0 text-[#9A948C] hover:text-[#1B1816]"
                    >
                      <AdminIcon name="check" size={14} />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Footer view all link */}
          <div className="border-t border-[#ECE7E0] bg-[#FAF8F5] p-2.5 text-center">
            <button
              type="button"
              className="text-xs font-bold text-[#766247] hover:underline"
              onClick={() => {
                setIsOpen(false);
                go('/admin/notifications');
              }}
            >
              View all notifications →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
