import { useCallback, useEffect, useState } from 'react';
import adminApi from '../../lib/api/adminApi';
import { AdminIcon } from '../../components/admin/AdminLayout';
import { formatRelativeTime } from '../../lib/formatters';

export default function AdminNotificationsPage({ go }) {
  const [notifications, setNotifications] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 15, totalPages: 1 });
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters
  const [typeFilter, setTypeFilter] = useState('all');
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [notice, setNotice] = useState('');

  const notify = (msg) => {
    setNotice(msg);
    window.setTimeout(() => setNotice(''), 2800);
  };

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await adminApi.getPaginatedNotifications({
        page,
        limit: 15,
        type: typeFilter !== 'all' ? typeFilter : undefined,
        unreadOnly: unreadOnly || undefined,
      });

      if (res.data) {
        setNotifications(res.data);
        if (res.pagination) setPagination(res.pagination);
        if (res.unreadCount != null) setUnreadCount(res.unreadCount);
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to load notifications.');
    } finally {
      setLoading(false);
    }
  }, [page, typeFilter, unreadOnly]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const handleMarkAsRead = async (id, e) => {
    e?.stopPropagation();
    try {
      await adminApi.markNotificationRead(id);
      loadNotifications();
    } catch (err) {
      notify('Failed to mark notification read.');
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await adminApi.markAllNotificationsRead();
      notify('All notifications marked as read.');
      loadNotifications();
    } catch (err) {
      notify('Failed to mark notifications read.');
    }
  };

  const handleDelete = async (id, e) => {
    e?.stopPropagation();
    try {
      await adminApi.deleteNotification(id);
      notify('Notification removed.');
      loadNotifications();
    } catch (err) {
      notify('Failed to delete notification.');
    }
  };

  const handleItemClick = (item) => {
    if (!item.isRead) {
      adminApi.markNotificationRead(item._id).catch(() => {});
    }

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
    }
  };

  return (
    <div className="admin-dashboard p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <section className="admin-page-heading flex items-center justify-between">
        <div>
          <h1 className="admin-page-title">Notifications Center</h1>
          <p className="admin-page-description">
            Live alerts for orders, critical low stock, payments, and security notices.
          </p>
        </div>

        <div className="admin-page-actions">
          {unreadCount > 0 && (
            <button
              className="admin-action-button"
              type="button"
              onClick={handleMarkAllRead}
            >
              Mark all as read
            </button>
          )}
        </div>
      </section>

      {/* Filter Tabs & Toggle */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#EDE8E1] pb-3">
        <div className="flex flex-wrap gap-2 text-xs">
          {[
            { label: 'All Alerts', value: 'all' },
            { label: 'Orders', value: 'new_order' },
            { label: 'Low Stock', value: 'low_stock' },
            { label: 'Payments', value: 'failed_payment' },
            { label: 'Customers', value: 'new_customer' },
            { label: 'System', value: 'system' },
          ].map((tab) => (
            <button
              key={tab.value}
              type="button"
              className={`px-3 py-1.5 rounded-full font-semibold transition ${
                typeFilter === tab.value
                  ? 'bg-[#1B1816] text-white'
                  : 'bg-[#FAF8F5] text-[#766247] hover:bg-[#F2ECE4]'
              }`}
              onClick={() => {
                setTypeFilter(tab.value);
                setPage(1);
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <label className="flex items-center gap-2 text-xs font-semibold text-[#1B1816] cursor-pointer">
          <input
            type="checkbox"
            checked={unreadOnly}
            onChange={(e) => {
              setUnreadOnly(e.target.checked);
              setPage(1);
            }}
            className="rounded"
          />
          Unread only ({unreadCount})
        </label>
      </div>

      {error && (
        <div className="p-4 text-xs font-semibold text-[#B04F3D] bg-[#FDF4F2] border border-[#F5D5CE] rounded-lg">
          {error}
        </div>
      )}

      {/* Notification List */}
      <div className="bg-white rounded-xl border border-[#EDE8E1] divide-y divide-[#F0ECE6] shadow-sm overflow-hidden">
        {loading ? (
          <p className="py-16 text-center text-xs text-[#8A847C]">Loading notifications…</p>
        ) : notifications.length === 0 ? (
          <div className="py-16 text-center text-xs text-[#8A847C] space-y-2">
            <AdminIcon name="bell" size={24} className="mx-auto text-[var(--text-muted)]" />
            <p className="font-semibold text-[#1B1816]">No notifications found</p>
            <p>You have caught up with all alerts.</p>
          </div>
        ) : (
          notifications.map((item) => (
            <div
              key={item._id}
              onClick={() => handleItemClick(item)}
              className={`p-4 flex items-start justify-between gap-4 cursor-pointer transition hover:bg-[#FAF8F5] ${
                !item.isRead ? 'bg-[#FCFAF8]' : ''
              }`}
            >
              <div className="flex items-start gap-3.5">
                <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-[#E8E1D8] bg-[#F4EFEA] text-[#675544]">
                  {item.type === 'new_order' && <AdminIcon name="orders" size={16} />}
                  {item.type === 'low_stock' && <AdminIcon name="warning" size={16} />}
                  {item.type === 'failed_payment' && <AdminIcon name="x" size={16} />}
                  {item.type === 'new_customer' && <AdminIcon name="customers" size={16} />}
                  {item.type === 'system' && <AdminIcon name="sliders" size={16} />}
                  {![
                    'new_order',
                    'low_stock',
                    'failed_payment',
                    'new_customer',
                    'system',
                  ].includes(item.type) && <AdminIcon name="bell" size={16} />}
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <h3
                      className={`text-xs ${
                        !item.isRead ? 'font-bold text-[#1B1816]' : 'font-medium text-[#423D38]'
                      }`}
                    >
                      {item.title}
                    </h3>
                    {!item.isRead && (
                      <span className="w-2 h-2 rounded-full bg-[#B04F3D] inline-block" />
                    )}
                  </div>
                  <p className="text-xs text-[#6F6962] mt-0.5">{item.message}</p>
                  <span className="text-[10px] text-[#9A948C] block mt-1">
                    {formatRelativeTime(item.createdAt)} · {new Date(item.createdAt).toLocaleString()}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                {!item.isRead && (
                  <button
                    type="button"
                    title="Mark as read"
                    onClick={(e) => handleMarkAsRead(item._id, e)}
                    className="p-1 text-[#8A847C] hover:text-[#1B1816]"
                  >
                    <AdminIcon name="check" size={14} />
                  </button>
                )}
                <button
                  type="button"
                  title="Delete notification"
                  onClick={(e) => handleDelete(item._id, e)}
                  className="p-1 text-[#8A847C] hover:text-[#B04F3D]"
                >
                  <AdminIcon name="close" size={14} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-[#6F6962] pt-2">
          <span>
            Page {pagination.page} of {pagination.totalPages} ({pagination.total} alerts)
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              className="admin-action-button py-1"
              disabled={pagination.page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </button>
            <button
              type="button"
              className="admin-action-button py-1"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </button>
          </div>
        </div>
      )}

      {notice && <div className="admin-toast" role="status">{notice}</div>}
    </div>
  );
}
