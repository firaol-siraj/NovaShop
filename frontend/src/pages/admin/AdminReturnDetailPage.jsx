import { useEffect, useMemo, useRef, useState } from 'react';
import { AdminIcon } from '../../components/admin/AdminLayout';
import AdminRowActionMenu from '../../components/admin/AdminRowActionMenu';
import returnApi from '../../lib/api/returnApi';
import { useAdminAuth } from '../../context/AdminAuthContext';
import {
  AdminRejectReturnModal,
  AdminReceiveRestockModal,
  AdminProcessRefundModal,
  AdminPrintReturnSlipModal,
} from '../../components/admin/AdminReturnModals';
import './admin-returndetail.css';

const PROGRESS_STEPS = [
  { key: 'requested', label: 'Requested' },
  { key: 'approved', label: 'Approved' },
  { key: 'received', label: 'Received' },
  { key: 'refunded', label: 'Refunded' },
];

const STATUS_META = {
  requested: { label: 'Requested', step: 0 },
  approved: { label: 'Approved', step: 1 },
  received: { label: 'Received', step: 2 },
  refunded: { label: 'Refunded', step: 3 },
  rejected: { label: 'Rejected', step: -1 },
};

const ITEM_SWATCHES = [
  'linear-gradient(145deg, #E7D9C3, #C9B291)',
  'linear-gradient(145deg, #D9C7B8, #AF957C)',
  'linear-gradient(145deg, #DCCFE0, #B6A0C4)',
  'linear-gradient(145deg, #CBD6C9, #9AAE9C)',
];

function formatCurrency(amount) {
  const num = Number(amount || 0);
  return `$${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(dateInput) {
  if (!dateInput) return '-';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
}

function formatShortDate(dateInput) {
  if (!dateInput) return '';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'short', day: '2-digit' });
}

function formatRelativeTime(dateInput) {
  if (!dateInput) return '-';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '-';
  const diffMs = Date.now() - d.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHour / 24);

  if (diffDays === 0) {
    if (diffHour === 0) {
      if (diffMin <= 1) return 'Just now';
      return `${diffMin}m ago`;
    }
    return `${diffHour}h ago`;
  }
  if (diffDays === 1) return '1 day ago';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 14) return '1 week ago';
  return `${Math.floor(diffDays / 7)} weeks ago`;
}

function FormattedReturnNumber({ id }) {
  if (!id) return null;
  const parts = String(id).split('-');
  if (parts.length > 1) {
    return (
      <span style={{ fontStyle: 'normal' }}>
        {parts.map((part, i) => (
          <span key={i}>
            {i > 0 && (
              <span
                className="rd-title-hyphen"
                style={{
                  fontFamily: 'var(--font-sans)',
                  fontStyle: 'normal',
                  display: 'inline-block',
                  margin: '0 1px',
                }}
              >
                -
              </span>
            )}
            {part}
          </span>
        ))}
      </span>
    );
  }
  return <span style={{ fontStyle: 'normal' }}>{id}</span>;
}

function ReturnStatusPill({ status }) {
  const meta = STATUS_META[status] || STATUS_META.requested;

  return (
    <span className={`rd-status-pill is-${status}`}>
      <i />
      {meta.label}
    </span>
  );
}

function ProgressTracker({ status, returnObj }) {
  const currentStep = STATUS_META[status]?.step ?? 0;

  const sublabels = useMemo(() => {
    const reqStr = formatShortDate(returnObj?.requestedAt) || 'Pending';
    const appStr = formatShortDate(returnObj?.approvedAt) || (status === 'requested' ? 'Pending' : '—');
    const recStr = formatShortDate(returnObj?.receivedAt) || (['requested', 'approved'].includes(status) ? 'Depot check' : '—');
    const refStr = formatShortDate(returnObj?.refundedAt) || (status === 'refunded' ? 'Completed' : 'Awaiting refund');

    return {
      requested: reqStr,
      approved: appStr,
      received: recStr,
      refunded: refStr,
    };
  }, [status, returnObj]);

  return (
    <div className={`rd-progress ${status === 'rejected' ? 'is-rejected' : ''}`}>
      {PROGRESS_STEPS.map((step, index) => {
        const isDone = status !== 'rejected' && index < currentStep;
        const isCurrent = status !== 'rejected' && index === currentStep;
        const isRejectedHalt = status === 'rejected' && index > 0;

        return (
          <div
            key={step.key}
            className={`rd-progress-step ${isDone ? 'is-done' : ''} ${
              isCurrent ? 'is-current' : ''
            } ${isRejectedHalt ? 'is-halted' : ''}`}
          >
            <div className="rd-progress-node">
              <span className="rd-progress-dot">
                {isDone && <AdminIcon name="check" size={11} />}
              </span>
              {index < PROGRESS_STEPS.length - 1 && (
                <span className="rd-progress-line" />
              )}
            </div>

            <div className="rd-progress-copy">
              <strong>{step.label}</strong>
              <small>{sublabels[step.key]}</small>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function AdminReturnDetailPage({ returnId, go }) {
  const { adminUser } = useAdminAuth();

  const canWriteReturns = useMemo(() => {
    if (!adminUser) return true;
    if (adminUser.adminRole === 'owner' || adminUser.adminRole === 'admin') return true;
    const perms = adminUser.permissions?.returns;
    if (Array.isArray(perms)) {
      return perms.includes('write') || perms.includes('manage') || perms.includes('delete');
    }
    return true;
  }, [adminUser]);

  const [returnObj, setReturnObj] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState([]);
  const [draftNote, setDraftNote] = useState('');
  const [auditExpanded, setAuditExpanded] = useState(true);
  const [notice, setNotice] = useState('');
  const [actionInProgress, setActionInProgress] = useState(false);

  // Modals
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [receiveModalOpen, setReceiveModalOpen] = useState(false);
  const [refundModalOpen, setRefundModalOpen] = useState(false);
  const [slipModalOpen, setSlipModalOpen] = useState(false);
  const [modalSubmitting, setModalSubmitting] = useState(false);

  const notify = (message) => {
    setNotice(message);
    window.setTimeout(() => setNotice(''), 2400);
  };

  const fetchReturnDetail = async () => {
    if (!returnId) return;
    setLoading(true);
    try {
      const data = await returnApi.getAdminReturnById(returnId);
      setReturnObj(data);
      if (data.adminNotes) {
        setNotes(
          data.adminNotes.map((n, idx) => ({
            id: n._id || idx,
            author: n.author || 'Admin',
            initials: n.author ? n.author.substring(0, 2).toUpperCase() : 'AD',
            timeAgo: formatRelativeTime(n.createdAt),
            body: n.body,
          })).reverse()
        );
      }
    } catch (err) {
      console.error('Failed to fetch return detail:', err);
      notify(`Return request ${returnId} not found`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReturnDetail();
  }, [returnId]);

  const handleBack = () => {
    if (window.history.length > 1) {
      window.history.back();
      return;
    }
    if (go) go('/admin/returns');
  };

  const handleApprove = async () => {
    if (!returnObj) return;
    setActionInProgress(true);
    try {
      await returnApi.approveReturn(returnObj.rawId || returnObj.id, {
        note: 'Approved by admin',
      });
      notify(`Return #${returnObj.id} approved — instructions sent.`);
      fetchReturnDetail();
    } catch (err) {
      notify(`Failed to approve return: ${err.message || 'Error'}`);
    } finally {
      setActionInProgress(false);
    }
  };

  const handleConfirmReject = async ({ reason }) => {
    if (!returnObj) return;
    setModalSubmitting(true);
    try {
      await returnApi.rejectReturn(returnObj.rawId || returnObj.id, { reason });
      notify(`Return #${returnObj.id} rejected.`);
      setRejectModalOpen(false);
      fetchReturnDetail();
    } catch (err) {
      notify(`Failed to reject return: ${err.message || 'Error'}`);
    } finally {
      setModalSubmitting(false);
    }
  };

  const handleConfirmReceive = async ({ restockItems, note }) => {
    if (!returnObj) return;
    setModalSubmitting(true);
    try {
      await returnApi.receiveReturn(returnObj.rawId || returnObj.id, {
        restock: true,
        restockItems,
        note,
      });
      notify(`Return #${returnObj.id} received and restocked.`);
      setReceiveModalOpen(false);
      fetchReturnDetail();
    } catch (err) {
      notify(`Failed to confirm receipt: ${err.message || 'Error'}`);
    } finally {
      setModalSubmitting(false);
    }
  };

  const handleConfirmRefund = async ({ amountUSD, refundMethod, includeShipping, refundReference, note }) => {
    if (!returnObj) return;
    setModalSubmitting(true);
    try {
      await returnApi.processRefund(returnObj.rawId || returnObj.id, {
        amountUSD,
        refundMethod,
        includeShipping,
        refundReference,
        note,
      });
      notify(`Return #${returnObj.id} refund of ${formatCurrency(amountUSD)} processed.`);
      setRefundModalOpen(false);
      fetchReturnDetail();
    } catch (err) {
      notify(`Failed to process refund: ${err.message || 'Error'}`);
    } finally {
      setModalSubmitting(false);
    }
  };

  const handleAddNote = async () => {
    if (!draftNote.trim() || !returnObj) return;

    try {
      await returnApi.addAdminNote(returnObj.rawId || returnObj.id, draftNote.trim());
      setNotes((current) => [
        {
          id: Date.now(),
          author: adminUser?.name || 'Admin',
          initials: adminUser?.name ? adminUser.name.substring(0, 2).toUpperCase() : 'AD',
          timeAgo: 'Just now',
          body: draftNote.trim(),
        },
        ...current,
      ]);
      setDraftNote('');
      notify('Note added to this return.');
    } catch (err) {
      notify('Failed to save note');
    }
  };

  const status = returnObj?.status || 'requested';
  const itemCount = returnObj?.items?.length || 0;

  const refundStatusLabel = useMemo(() => {
    if (status === 'rejected') return 'Refund rejected';
    if (status === 'refunded') return 'Refund issued';
    if (status === 'received') return 'Ready for refund';
    if (status === 'approved') return 'Authorized for refund';
    return 'Pending approval';
  }, [status]);

  const copyTracking = async () => {
    const trk = returnObj?.trackingNumber || returnObj?.tracking || 'Pending';
    try {
      await navigator.clipboard.writeText(trk);
      notify('Tracking number copied.');
    } catch {
      notify(`Tracking number: ${trk}`);
    }
  };

  const copyReturnNumber = async () => {
    const num = returnObj?.returnNumber || returnObj?.id || returnId;
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(num);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = num;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      notify(`Return number #${num} copied to clipboard.`);
    } catch {
      notify(`Return number: #${num}`);
    }
  };

  const handleViewOrder = () => {
    const orderKey = returnObj?.orderRef || returnObj?.orderNumber || returnObj?.orderId || returnObj?.order?._id || returnObj?.order;
    if (orderKey) {
      if (go) {
        go(`/admin/orders/${orderKey}`);
      } else {
        window.location.href = `/admin/orders/${orderKey}`;
      }
    } else {
      notify('No linked order found for this return.');
    }
  };

  const handleViewCustomer = () => {
    const custId = returnObj?.customer?._id || returnObj?.customer?.id || returnObj?.userId || returnObj?.user?._id || returnObj?.user;
    if (custId && custId !== 'null' && custId !== 'undefined') {
      if (go) {
        go(`/admin/customers/${custId}`);
      } else {
        window.location.href = `/admin/customers/${custId}`;
      }
    } else {
      notify('No registered customer profile linked to this guest return.');
    }
  };

  const handleMarkReceived = () => {
    if (!canWriteReturns) {
      notify('You do not have permission to receive returns.');
      return;
    }
    if (status === 'received') {
      notify('This return has already been marked as received.');
      return;
    }
    if (status === 'refunded') {
      notify('This return has already been received and refunded.');
      return;
    }
    if (status === 'rejected') {
      notify('Cannot mark a rejected return as received.');
      return;
    }
    if (status === 'requested') {
      notify('Return must be approved first before marking as received.');
      return;
    }
    setReceiveModalOpen(true);
  };

  if (loading && !returnObj) {
    return (
      <div className="admin-dashboard return-detail-page">
        <section className="admin-page-heading rd-heading">
          <div className="rd-heading-top">
            <button type="button" className="rd-back-link" onClick={handleBack}>
              <span>←</span>
              Returns &amp; Refunds
            </button>
          </div>
          <div className="rd-heading-row">
            <h1 className="admin-page-title">
              Loading Return <span className="rd-title-symbol" style={{ fontFamily: 'var(--font-sans)', fontStyle: 'normal' }}>#</span><FormattedReturnNumber id={returnId} />…
            </h1>
          </div>
        </section>
      </div>
    );
  }

  const customerName = returnObj?.customer?.name || returnObj?.customerName || 'Customer';
  const customerEmail = returnObj?.customer?.email || returnObj?.customerEmail || '-';
  const customerId = returnObj?.customer?._id || returnObj?.user?._id || returnObj?.user || '';
  const orderDisplayId = returnObj?.orderNumber || returnObj?.orderId || returnObj?.order?._id || '-';

  const customerInitials = customerName
    .split(' ')
    .filter(Boolean)
    .map((n) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase() || 'CU';

  return (
    <div className="admin-dashboard return-detail-page">
      {/* HEADER */}
      <section className="admin-page-heading rd-heading">
        <div className="rd-heading-top">
          <button type="button" className="rd-back-link" onClick={handleBack}>
            <span>←</span>
            Returns &amp; Refunds
          </button>
        </div>

        <div className="rd-heading-row">
          <div className="rd-heading-left">
            <div className="rd-title-row">
              {/* Fix title glyph bug: render '#' and hyphen in sans-serif so it renders clean 'Return #RT-2041' without glyph breaking */}
              <h1 className="admin-page-title">
                Return <span className="rd-title-symbol" style={{ fontFamily: 'var(--font-sans)', fontStyle: 'normal' }}>#</span><FormattedReturnNumber id={returnObj?.id || returnObj?.returnNumber || returnId} />
              </h1>
              <ReturnStatusPill status={status} />
            </div>

            <p className="admin-page-description">
              Requested {formatDate(returnObj?.requestedAt)} · Order{' '}
              <button
                type="button"
                className="rd-order-link"
                onClick={() => {
                  const targetKey = returnObj?.orderRef || String(orderDisplayId || '').replace(/^#/, '');
                  if (targetKey) {
                    if (go) go(`/admin/orders/${targetKey}`);
                    else window.location.href = `/admin/orders/${targetKey}`;
                  }
                }}
              >
                #{orderDisplayId}
              </button>
            </p>
          </div>

          <div className="admin-page-actions">
            {/* Shared Portal-Based Action Menu */}
            <AdminRowActionMenu
              title={`Return #${returnObj?.returnNumber || returnObj?.id || returnId}`}
              subtitle={`${customerName} · ${status.toUpperCase()}`}
              width={220}
              items={[
                {
                  id: 'order',
                  label: 'View order',
                  icon: 'bag',
                  onClick: handleViewOrder,
                },
                {
                  id: 'customer',
                  label: 'View customer',
                  icon: 'customers',
                  onClick: handleViewCustomer,
                },
                {
                  id: 'print',
                  label: 'Print return slip',
                  icon: 'print',
                  onClick: () => setSlipModalOpen(true),
                },
                { id: 'divider-workflow', isDivider: true },
                {
                  id: 'approve',
                  label: 'Approve return',
                  icon: 'check',
                  hidden: status !== 'requested' || !canWriteReturns,
                  onClick: handleApprove,
                },
                {
                  id: 'receive',
                  label: 'Mark received',
                  icon: 'package',
                  hidden: status !== 'approved' || !canWriteReturns,
                  onClick: () => setReceiveModalOpen(true),
                },
                {
                  id: 'refund',
                  label: 'Issue refund',
                  icon: 'credit-card',
                  hidden: status !== 'received' || !canWriteReturns,
                  onClick: () => setRefundModalOpen(true),
                },
                {
                  id: 'reject',
                  label: 'Reject return',
                  icon: 'x-circle',
                  danger: true,
                  hidden: status !== 'requested' || !canWriteReturns,
                  onClick: () => setRejectModalOpen(true),
                },
                { id: 'divider-copy', isDivider: true },
                {
                  id: 'copy',
                  label: 'Copy return number',
                  icon: 'copy',
                  onClick: copyReturnNumber,
                },
              ]}
            />

            {status === 'requested' && canWriteReturns && (
              <>
                <button
                  type="button"
                  className="admin-action-button"
                  disabled={actionInProgress}
                  onClick={() => setRejectModalOpen(true)}
                >
                  <AdminIcon name="stop" size={14} />
                  Reject return
                </button>

                <button
                  type="button"
                  className="admin-action-button is-primary"
                  disabled={actionInProgress}
                  onClick={handleApprove}
                >
                  <AdminIcon name="check" size={14} />
                  Approve return
                </button>
              </>
            )}

            {status === 'approved' && canWriteReturns && (
              <button
                type="button"
                className="admin-action-button is-primary"
                disabled={actionInProgress}
                onClick={() => setReceiveModalOpen(true)}
              >
                <AdminIcon name="check" size={14} />
                Receive &amp; Restock
              </button>
            )}

            {status === 'received' && canWriteReturns && (
              <button
                type="button"
                className="admin-action-button is-primary"
                disabled={actionInProgress}
                onClick={() => setRefundModalOpen(true)}
              >
                <AdminIcon name="credit-card" size={14} />
                Issue Refund
              </button>
            )}
          </div>
        </div>
      </section>

      <div className="rd-layout">
        {/* LEFT COLUMN */}
        <div className="rd-main-column">
          {/* PROGRESS */}
          <section className="rd-card rd-progress-card">
            <ProgressTracker status={status} returnObj={returnObj} />
          </section>

          {/* RETURNED ITEMS */}
          <section className="rd-card">
            <div className="rd-card-heading">
              <h2>Returned items</h2>
              <span className="rd-item-count">
                {itemCount} {itemCount === 1 ? 'item' : 'items'}
              </span>
            </div>

            <table className="rd-items-table">
              <thead>
                <tr>
                  <th>Item details</th>
                  <th>Qty</th>
                  <th>Price</th>
                  <th>Refund value</th>
                </tr>
              </thead>

              <tbody>
                {(returnObj?.items || []).map((item, index) => (
                  <tr key={item.id || item._id || index}>
                    <td>
                      <div className="rd-item-cell">
                        <div
                          className="rd-item-thumb"
                          style={{
                            background: item.image
                              ? 'transparent'
                              : ITEM_SWATCHES[index % ITEM_SWATCHES.length],
                          }}
                        >
                          {item.image ? (
                            <img
                              src={item.image}
                              alt={item.productName || item.name}
                              className="rd-item-img"
                              style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '12px' }}
                            />
                          ) : (
                            <AdminIcon name="package" size={18} />
                          )}
                        </div>

                        <div>
                          <strong>{item.productName || item.name}</strong>
                          <span>{item.variantName || item.variant || 'Standard'}</span>
                          <span className="rd-item-sku">SKU: {item.sku || 'N/A'}</span>
                        </div>
                      </div>
                    </td>
                    <td>{item.qty}</td>
                    <td>{formatCurrency(item.unitPrice || item.price)}</td>
                    <td>
                      <strong>{formatCurrency(item.refundValue || (item.unitPrice || item.price) * item.qty)}</strong>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          {/* RETURN REASON */}
          <section className="rd-card">
            <div className="rd-card-heading">
              <h2>Return reason</h2>
            </div>

            <div className="rd-reason-grid">
              <div className="rd-reason-field">
                <div className="rd-reason-icon">
                  <AdminIcon name="sliders" size={14} />
                </div>
                <span>Primary reason</span>
                <strong>{returnObj?.reason || 'Wrong size'}</strong>
              </div>

              <div className="rd-reason-field">
                <div className="rd-reason-icon">
                  <AdminIcon name="receipt" size={14} />
                </div>
                <span>Desired resolution</span>
                <strong>{returnObj?.resolution || 'Refund'}</strong>
              </div>
            </div>

            <div className="rd-statement">
              <span>Customer statement</span>
              <p>&ldquo;{returnObj?.customerNote || 'No additional details provided.'}&rdquo;</p>
            </div>
          </section>

          {/* REFUND SUMMARY */}
          <section className="rd-card">
            <div className="rd-card-heading">
              <h2>Refund summary</h2>
              <span
                className={`rd-refund-tag ${
                  status === 'rejected' ? 'is-rejected' : ''
                }`}
              >
                {refundStatusLabel}
              </span>
            </div>

            <div className="rd-refund-lines">
              <div className="rd-refund-line">
                <span>Items subtotal</span>
                <strong>{formatCurrency(returnObj?.refundAmountUSD || 0)}</strong>
              </div>

              <div className="rd-refund-line">
                <span>Shipping refunded</span>
                <strong>{formatCurrency(0)}</strong>
              </div>

              <div className="rd-refund-line">
                <span>
                  Restocking fee <em>(Waived)</em>
                </span>
                <strong>{formatCurrency(0)}</strong>
              </div>
            </div>

            <div className="rd-refund-total">
              <div className="rd-refund-total-inner">
                <span>Total refund</span>
                <strong>{formatCurrency(returnObj?.refundAmountUSD || 0)}</strong>
              </div>
            </div>

            <div className="rd-refund-method">
              <span>
                <AdminIcon name="receipt" size={15} />
                Refund method: {returnObj?.refundMethod || 'Original payment method'}
              </span>

              <span className="rd-processor-tag">
                {returnObj?.order?.paymentMethod === 'Chapa' ? 'Chapa Payments' : 'NovaShop Core'}
              </span>
            </div>
          </section>
        </div>

        {/* RIGHT COLUMN */}
        <aside className="rd-side-column">
          {/* CUSTOMER */}
          <section className="rd-card rd-side-card">
            <div className="rd-side-heading">
              <h3>Customer</h3>
              <button
                type="button"
                className="rd-text-link"
                onClick={() => go && customerId && go(`/admin/customers/${customerId}`)}
              >
                View profile
              </button>
            </div>

            <div className="rd-customer-row">
              <span className="rd-avatar">{customerInitials}</span>

              <div>
                <strong
                  style={{ cursor: customerId ? 'pointer' : 'default' }}
                  onClick={() => go && customerId && go(`/admin/customers/${customerId}`)}
                >
                  {customerName}
                </strong>
                <span>{customerEmail}</span>
              </div>
            </div>

            <div className="rd-side-stat">
              <span>Phone</span>
              <strong>{returnObj?.customer?.phone || returnObj?.order?.shippingAddress?.phone || '-'}</strong>
            </div>
          </section>

          {/* ORDER */}
          <section className="rd-card rd-side-card">
            <div className="rd-side-heading">
              <h3>Order</h3>
              <button
                type="button"
                className="rd-text-link"
                onClick={() => {
                  const targetKey = returnObj?.orderRef || String(orderDisplayId || '').replace(/^#/, '');
                  if (targetKey) {
                    if (go) go(`/admin/orders/${targetKey}`);
                    else window.location.href = `/admin/orders/${targetKey}`;
                  }
                }}
              >
                View order
              </button>
            </div>

            <div className="rd-order-row">
              <div>
                <strong
                  style={{ cursor: orderDisplayId !== '-' ? 'pointer' : 'default' }}
                  onClick={() => go && orderDisplayId !== '-' && go(`/admin/orders/${orderDisplayId}`)}
                >
                  #{orderDisplayId}
                </strong>
                <span>{formatDate(returnObj?.order?.createdAt || returnObj?.requestedAt)}</span>
              </div>

              <span className="rd-order-status-pill">{returnObj?.order?.status || returnObj?.order?.orderStatus || 'Delivered'}</span>
            </div>

            <div className="rd-side-stat">
              <span>Order total</span>
              <strong>{formatCurrency(returnObj?.order?.totalPrice || returnObj?.refundAmountUSD || 0)}</strong>
            </div>
          </section>

          {/* ADDRESSES */}
          <section className="rd-card rd-side-card">
            <h3>Addresses</h3>

            <div className="rd-address-block">
              <span>RETURN ADDRESS (DEPOT)</span>
              <p>NovaShop Central Returns Depot</p>
              <p>Bole International Logistics Park, Unit 4B</p>
              <p>Addis Ababa, Ethiopia</p>
            </div>

            <div className="rd-address-block">
              <span>CUSTOMER SHIPPING ADDRESS</span>
              <p>{customerName}</p>
              <p>{returnObj?.order?.shippingAddress?.address || returnObj?.customer?.address || 'Addis Ababa, Ethiopia'}</p>
            </div>
          </section>

          {/* INTERNAL NOTES */}
          <section className="rd-card rd-side-card">
            <div className="rd-side-heading">
              <h3>Internal notes</h3>
              <span className="rd-team-tag">Team only</span>
            </div>

            <p className="rd-notes-helper">
              Notes are confidential and will never be shared with clients.
            </p>

            <textarea
              className="rd-note-input"
              placeholder="Add a note about this return…"
              value={draftNote}
              onChange={(event) => setDraftNote(event.target.value)}
            />

            <button
              type="button"
              className="rd-add-note-button"
              onClick={handleAddNote}
              disabled={!draftNote.trim()}
            >
              Add note
            </button>

            {notes.length > 0 && (
              <div className="rd-notes-list">
                {notes.map((note) => (
                  <div className="rd-note" key={note.id}>
                    <span className="rd-avatar rd-avatar-small">
                      {note.initials}
                    </span>

                    <div>
                      <div className="rd-note-meta">
                        <strong>{note.author}</strong>
                        <span>{note.timeAgo}</span>
                      </div>
                      <p>{note.body}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* AUDIT DETAILS */}
          <section className="rd-card rd-side-card">
            <button
              type="button"
              className="rd-audit-toggle"
              onClick={() => setAuditExpanded((open) => !open)}
              aria-expanded={auditExpanded}
            >
              <span>Audit details</span>
              <span className="rd-audit-state">
                {auditExpanded ? 'Expanded' : 'Collapsed'}
                <span className={`rd-audit-chevron ${auditExpanded ? 'is-open' : ''}`}>
                  <AdminIcon name="chevron" size={13} />
                </span>
              </span>
            </button>

            {auditExpanded && (
              <div className="rd-audit-content">
                <div>
                  <span>Return ID</span>
                  <strong>{returnObj?.id || returnId}</strong>
                </div>

                <div>
                  <span>Return method</span>
                  <strong>{returnObj?.carrier || 'Prepaid Courier'}</strong>
                </div>

                <div>
                  <span>Tracking number</span>
                  <button
                    type="button"
                    className="rd-tracking-link"
                    onClick={copyTracking}
                  >
                    {returnObj?.trackingNumber || returnObj?.tracking || 'Pending'}
                    <AdminIcon name="copy" size={12} />
                  </button>
                </div>

                <div>
                  <span>Requested on</span>
                  <strong>{formatDate(returnObj?.requestedAt)}</strong>
                </div>

                <div>
                  <span>Resolution status</span>
                  <strong>{status.toUpperCase()}</strong>
                </div>
              </div>
            )}
          </section>
        </aside>
      </div>

      {/* Modals */}
      <AdminRejectReturnModal
        isOpen={rejectModalOpen}
        onClose={() => setRejectModalOpen(false)}
        returnObj={returnObj}
        onConfirm={handleConfirmReject}
        isSubmitting={modalSubmitting}
      />

      <AdminReceiveRestockModal
        isOpen={receiveModalOpen}
        onClose={() => setReceiveModalOpen(false)}
        returnObj={returnObj}
        onConfirm={handleConfirmReceive}
        isSubmitting={modalSubmitting}
      />

      <AdminProcessRefundModal
        isOpen={refundModalOpen}
        onClose={() => setRefundModalOpen(false)}
        returnObj={returnObj}
        onConfirm={handleConfirmRefund}
        isSubmitting={modalSubmitting}
      />

      <AdminPrintReturnSlipModal
        isOpen={slipModalOpen}
        onClose={() => setSlipModalOpen(false)}
        returnObj={returnObj}
      />

      {notice && (
        <div className="admin-toast" role="status">
          {notice}
        </div>
      )}
    </div>
  );
}
