import { useEffect, useMemo, useRef, useState } from 'react';
import { AdminIcon } from '../../components/admin/AdminLayout';
import './admin-returndetail.css';

const RETURN = {
  id: 'RT-2041',
  status: 'requested',
  requestedOn: 'Sep 30, 2026',
  requestedAt: '14:22',
  order: {
    id: 'NS-10431',
    date: 'Sep 09, 2026',
    status: 'Delivered',
    total: 2110,
  },
  customer: {
    name: 'Amelia Chen',
    initials: 'AC',
    email: 'amelia.chen@email.com',
    totalOrders: 15,
  },
  items: [
    {
      id: 1,
      name: 'Silk Slip Dress',
      variant: 'Champagne / S',
      sku: 'DR-8841-CH',
      qty: 1,
      price: 890,
      refundValue: 890,
    },
  ],
  reason: {
    primary: 'Wrong size',
    resolution: 'Refund to original card',
    statement:
      'Runs slightly small around the waistline. I would like to return it for a refund.',
  },
  refund: {
    itemsSubtotal: 890,
    shippingRefunded: 0,
    restockingFee: 0,
    restockingWaived: true,
    total: 890,
    method: 'Original payment method · Visa ending 4242',
    processor: 'Stripe Connect',
  },
  returnAddress: {
    label: 'Return address (depot)',
    lines: [
      'NovaShop Returns Depot',
      '1200 Industrial Way, Unit 4',
      'Newark, NJ 07105, United States',
    ],
  },
  shippingAddress: {
    label: 'Customer shipping address',
    lines: ['Amelia Chen', '18 Orchard Road', 'Singapore 238841, Singapore'],
  },
  audit: {
    returnId: 'RT-2041',
    returnMethod: 'Prepaid DHL label',
    trackingNumber: '1Z999999999999999',
    requestedOn: 'Sep 30, 2026, 14:22',
    lastUpdatedBy: 'Elena Vasquez',
  },
};

const INITIAL_NOTES = [
  {
    id: 1,
    author: 'Elena Vasquez',
    initials: 'EV',
    timeAgo: '2 hours ago',
    body: 'Customer requested a prepaid priority DHL label.',
  },
];

const PROGRESS_STEPS = [
  { key: 'requested', label: 'Requested' },
  { key: 'approved', label: 'Approved' },
  { key: 'received', label: 'Received' },
  { key: 'refunded', label: 'Refunded' },
];

const STEP_SUBLABEL = {
  requested: {
    requested: 'Sep 30',
    approved: 'Pending',
    received: 'Depot check',
    refunded: 'Awaiting refund',
  },
  approved: {
    requested: 'Sep 30',
    approved: 'Sep 30',
    received: 'Pending',
    refunded: 'Awaiting refund',
  },
  received: {
    requested: 'Sep 30',
    approved: 'Sep 30',
    received: 'Oct 02',
    refunded: 'Pending',
  },
  refunded: {
    requested: 'Sep 30',
    approved: 'Sep 30',
    received: 'Oct 02',
    refunded: 'Oct 03',
  },
  rejected: {
    requested: 'Sep 30',
    approved: '—',
    received: '—',
    refunded: '—',
  },
};

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
  return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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

function ProgressTracker({ status }) {
  const currentStep = STATUS_META[status]?.step ?? 0;
  const sublabels = STEP_SUBLABEL[status] || STEP_SUBLABEL.requested;

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

export default function AdminReturnDetailPage({ go }) {
  const [status, setStatus] = useState(RETURN.status);
  const [notes, setNotes] = useState(INITIAL_NOTES);
  const [draftNote, setDraftNote] = useState('');
  const [auditExpanded, setAuditExpanded] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [notice, setNotice] = useState('');

  const menuRef = useRef(null);

  useOutsideClick(menuRef, () => setMenuOpen(false));

  const notify = (message) => {
    setNotice(message);
    window.setTimeout(() => setNotice(''), 2400);
  };

  const handleBack = () => {
    if (go) go('/admin/returns');
  };

  const handleApprove = () => {
    setStatus('approved');
    notify(`Return #${RETURN.id} approved — refund scheduled.`);
  };

  const handleReject = () => {
    setStatus('rejected');
    setMenuOpen(false);
    notify(`Return #${RETURN.id} rejected.`);
  };

  const handleAddNote = () => {
    if (!draftNote.trim()) return;

    setNotes((current) => [
      {
        id: Date.now(),
        author: 'Elena Vasquez',
        initials: 'EV',
        timeAgo: 'Just now',
        body: draftNote.trim(),
      },
      ...current,
    ]);
    setDraftNote('');
    notify('Note added to this return.');
  };

  const handleMenuAction = (action) => {
    setMenuOpen(false);

    if (action === 'view-order') {
      if (go) go(`/admin/orders/${RETURN.order.id}`);
      return;
    }

    if (action === 'view-customer') {
      if (go) go('/admin/customers');
      return;
    }

    if (action === 'print') {
      notify('Preparing return slip for print…');
      return;
    }

    if (action === 'reject') {
      handleReject();
    }
  };

  const itemCount = RETURN.items.length;

  const canDecide = status === 'requested';

  const refundStatusLabel = useMemo(() => {
    if (status === 'rejected') return 'Refund rejected';
    if (status === 'refunded') return 'Refund issued';
    return 'Authorized for refund';
  }, [status]);

  const copyTracking = async () => {
    try {
      await navigator.clipboard.writeText(RETURN.audit.trackingNumber);
      notify('Tracking number copied.');
    } catch {
      notify(`Tracking number: ${RETURN.audit.trackingNumber}`);
    }
  };

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
              <h1 className="admin-page-title">Return #{RETURN.id}</h1>
              <ReturnStatusPill status={status} />
            </div>

            <p className="admin-page-description">
              Requested {RETURN.requestedOn} · Order{' '}
              <button
                type="button"
                className="rd-order-link"
                onClick={() => go && go(`/admin/orders/${RETURN.order.id}`)}
              >
                #{RETURN.order.id}
              </button>
            </p>
          </div>

          <div className="admin-page-actions">
            <div className="rd-menu-wrap" ref={menuRef}>
              <button
                type="button"
                className="products-row-menu-button"
                aria-label="More return actions"
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen((open) => !open)}
              >
                <AdminIcon name="more" size={16} />
              </button>

              {menuOpen && (
                <div className="rd-menu-panel" role="menu">
                  <button type="button" onClick={() => handleMenuAction('view-order')}>
                    <AdminIcon name="document" size={14} />
                    View order
                  </button>

                  <button
                    type="button"
                    onClick={() => handleMenuAction('view-customer')}
                  >
                    <AdminIcon name="customers" size={14} />
                    View customer
                  </button>

                  <button type="button" onClick={() => handleMenuAction('print')}>
                    <AdminIcon name="print" size={14} />
                    Print return slip
                  </button>

                  {canDecide && (
                    <>
                      <div className="rd-menu-divider" />
                      <button
                        type="button"
                        className="is-danger"
                        onClick={() => handleMenuAction('reject')}
                      >
                        <AdminIcon name="stop" size={14} />
                        Reject return
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>

            <button
              type="button"
              className="admin-action-button"
              disabled={!canDecide}
              onClick={handleReject}
            >
              <AdminIcon name="stop" size={14} />
              Reject return
            </button>

            <button
              type="button"
              className="admin-action-button is-primary"
              disabled={!canDecide}
              onClick={handleApprove}
            >
              <AdminIcon name="check" size={14} />
              Approve return
            </button>
          </div>
        </div>
      </section>

      <div className="rd-layout">
        {/* LEFT COLUMN */}
        <div className="rd-main-column">
          {/* PROGRESS */}
          <section className="rd-card rd-progress-card">
            <ProgressTracker status={status} />
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
                {RETURN.items.map((item, index) => (
                  <tr key={item.id}>
                    <td>
                      <div className="rd-item-cell">
                        <div
                          className="rd-item-thumb"
                          style={{
                            background:
                              ITEM_SWATCHES[index % ITEM_SWATCHES.length],
                          }}
                        >
                          <AdminIcon name="package" size={18} />
                        </div>

                        <div>
                          <strong>{item.name}</strong>
                          <span>{item.variant}</span>
                          <span className="rd-item-sku">SKU: {item.sku}</span>
                        </div>
                      </div>
                    </td>
                    <td>{item.qty}</td>
                    <td>{formatCurrency(item.price)}</td>
                    <td>
                      <strong>{formatCurrency(item.refundValue)}</strong>
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
                <strong>{RETURN.reason.primary}</strong>
              </div>

              <div className="rd-reason-field">
                <div className="rd-reason-icon">
                  <AdminIcon name="receipt" size={14} />
                </div>
                <span>Desired resolution</span>
                <strong>{RETURN.reason.resolution}</strong>
              </div>
            </div>

            <div className="rd-statement">
              <span>Customer statement</span>
              <p>&ldquo;{RETURN.reason.statement}&rdquo;</p>
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
                <strong>{formatCurrency(RETURN.refund.itemsSubtotal)}</strong>
              </div>

              <div className="rd-refund-line">
                <span>Shipping refunded</span>
                <strong>{formatCurrency(RETURN.refund.shippingRefunded)}</strong>
              </div>

              <div className="rd-refund-line">
                <span>
                  Restocking fee{' '}
                  {RETURN.refund.restockingWaived && (
                    <em>(Waived)</em>
                  )}
                </span>
                <strong>{formatCurrency(RETURN.refund.restockingFee)}</strong>
              </div>
            </div>

            <div className="rd-refund-total">
              <div className="rd-refund-total-inner">
                <span>Total refund</span>
                <strong>{formatCurrency(RETURN.refund.total)}</strong>
              </div>
            </div>

            <div className="rd-refund-method">
              <span>
                <AdminIcon name="receipt" size={15} />
                Refund method: {RETURN.refund.method}
              </span>

              <span className="rd-processor-tag">{RETURN.refund.processor}</span>
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
                onClick={() => go && go('/admin/customers')}
              >
                View profile
              </button>
            </div>

            <div className="rd-customer-row">
              <span className="rd-avatar">{RETURN.customer.initials}</span>

              <div>
                <strong>{RETURN.customer.name}</strong>
                <span>{RETURN.customer.email}</span>
              </div>
            </div>

            <div className="rd-side-stat">
              <span>Total orders</span>
              <strong>{RETURN.customer.totalOrders} orders</strong>
            </div>
          </section>

          {/* ORDER */}
          <section className="rd-card rd-side-card">
            <div className="rd-side-heading">
              <h3>Order</h3>
              <button
                type="button"
                className="rd-text-link"
                onClick={() => go && go(`/admin/orders/${RETURN.order.id}`)}
              >
                View order
              </button>
            </div>

            <div className="rd-order-row">
              <div>
                <strong>#{RETURN.order.id}</strong>
                <span>{RETURN.order.date}</span>
              </div>

              <span className="rd-order-status-pill">{RETURN.order.status}</span>
            </div>

            <div className="rd-side-stat">
              <span>Order total</span>
              <strong>{formatCurrency(RETURN.order.total)}</strong>
            </div>
          </section>

          {/* ADDRESSES */}
          <section className="rd-card rd-side-card">
            <h3>Addresses</h3>

            <div className="rd-address-block">
              <span>{RETURN.returnAddress.label.toUpperCase()}</span>
              {RETURN.returnAddress.lines.map((line) => (
                <p key={line}>{line}</p>
              ))}
            </div>

            <div className="rd-address-block">
              <span>{RETURN.shippingAddress.label.toUpperCase()}</span>
              {RETURN.shippingAddress.lines.map((line) => (
                <p key={line}>{line}</p>
              ))}
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
                  <strong>{RETURN.audit.returnId}</strong>
                </div>

                <div>
                  <span>Return method</span>
                  <strong>{RETURN.audit.returnMethod}</strong>
                </div>

                <div>
                  <span>Tracking number</span>
                  <button
                    type="button"
                    className="rd-tracking-link"
                    onClick={copyTracking}
                  >
                    {RETURN.audit.trackingNumber}
                    <AdminIcon name="copy" size={12} />
                  </button>
                </div>

                <div>
                  <span>Requested on</span>
                  <strong>{RETURN.audit.requestedOn}</strong>
                </div>

                <div>
                  <span>Last updated by</span>
                  <strong>{RETURN.audit.lastUpdatedBy}</strong>
                </div>
              </div>
            )}
          </section>
        </aside>
      </div>

      {notice && (
        <div className="admin-toast" role="status">
          {notice}
        </div>
      )}
    </div>
  );
}

function useOutsideClick(ref, onOutsideClick) {
  useEffect(() => {
    function handleClick(event) {
      if (ref.current && !ref.current.contains(event.target)) {
        onOutsideClick();
      }
    }

    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [ref, onOutsideClick]);
}