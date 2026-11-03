import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AdminIcon } from './AdminLayout';
import adminApi from '../../lib/api/adminApi';

const EMAIL_TEMPLATES = {
  custom: {
    label: 'Custom message',
    subject: '',
    message: '',
  },
  order_update: {
    label: 'Order update',
    subject: 'Update regarding your recent order',
    message: 'Hello,\n\nWe are reaching out with an important update regarding your order.\n\nEverything is being carefully inspected and prepared for shipment. Please let us know if you have any questions.\n\nWarm regards,\nNovaShop Customer Care',
  },
  account_notice: {
    label: 'Account notice',
    subject: 'Important notice regarding your NovaShop account',
    message: 'Hello,\n\nThis is an official communication regarding your account status with NovaShop.\n\nPlease review your security settings or reply to this message directly if you need assistance.\n\nBest regards,\nNovaShop Support',
  },
};

export default function AdminSendEmailModal({
  customer,
  isOpen,
  onClose,
  onSuccess,
}) {
  const [template, setTemplate] = useState('custom');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [orderId, setOrderId] = useState('');
  const [customerOrders, setCustomerOrders] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  // Load customer orders for optional linking
  useEffect(() => {
    if (!isOpen || !customer?._id && !customer?.id) return;
    const cid = customer._id || customer.id;

    setLoadingOrders(true);
    adminApi
      .getCustomer(cid)
      .then((res) => {
        if (res.data?.orders) {
          setCustomerOrders(res.data.orders);
        }
      })
      .catch(() => {
        setCustomerOrders([]);
      })
      .finally(() => {
        setLoadingOrders(false);
      });
  }, [isOpen, customer]);

  // Handle template change
  const handleTemplateChange = (tplKey) => {
    setTemplate(tplKey);
    const chosen = EMAIL_TEMPLATES[tplKey];
    if (chosen) {
      if (chosen.subject) setSubject(chosen.subject);
      if (chosen.message) setMessage(chosen.message);
    }
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!subject.trim()) {
      setError('Please provide an email subject.');
      return;
    }
    if (!message.trim()) {
      setError('Please write an email message body.');
      return;
    }

    setSending(true);
    setError('');

    const cid = customer._id || customer.id;
    const idempotencyKey = `email_${cid}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    try {
      const res = await adminApi.sendCustomerEmail(cid, {
        subject: subject.trim(),
        message: message.trim(),
        template: template !== 'custom' ? template : undefined,
        orderId: orderId || undefined,
        idempotencyKey,
      });

      onSuccess?.(res.message || `Email dispatched to ${customer.email}`);
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to dispatch email.');
    } finally {
      setSending(false);
    }
  };

  if (!isOpen) return null;

  const charCount = message.length;
  const maxChars = 5000;

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-overlay)',
        backdropFilter: 'blur(3px)',
        padding: '16px',
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="send-email-title"
    >
      <div
        style={{
          width: '100%',
          maxWidth: '560px',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-default)',
          borderRadius: '14px',
          boxShadow: 'var(--shadow-lg)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '90vh',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '18px 24px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--bg-surface-raised)',
          }}
        >
          <div>
            <h2
              id="send-email-title"
              style={{
                margin: 0,
                fontSize: '18px',
                fontWeight: 600,
                fontFamily: 'var(--font-serif)',
                color: 'var(--text-primary)',
              }}
            >
              Send Customer Email
            </h2>
            <p
              style={{
                margin: '2px 0 0',
                fontSize: '11px',
                color: 'var(--text-secondary)',
              }}
            >
              Dispatches a transactional message with support reply threading.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            style={{
              background: 'transparent',
              border: 0,
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <AdminIcon name="close" size={16} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSend} style={{ padding: '20px 24px', overflowY: 'auto' }}>
          {error && (
            <div
              role="alert"
              style={{
                marginBottom: '16px',
                padding: '10px 14px',
                borderRadius: '8px',
                background: 'var(--color-danger-soft)',
                color: 'var(--color-danger)',
                fontSize: '12px',
                fontWeight: 500,
              }}
            >
              {error}
            </div>
          )}

          {/* Recipient info (read-only) */}
          <div style={{ marginBottom: '16px' }}>
            <label
              style={{
                display: 'block',
                fontSize: '11px',
                fontWeight: 700,
                color: 'var(--text-muted)',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                marginBottom: '6px',
              }}
            >
              Recipient
            </label>
            <div
              style={{
                padding: '9px 12px',
                borderRadius: '7px',
                border: '1px solid var(--border-input)',
                background: 'var(--bg-surface-sunken)',
                color: 'var(--text-primary)',
                fontSize: '13px',
                fontWeight: 500,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <span>{customer?.name || 'Customer'}</span>
              <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{customer?.email}</span>
            </div>
          </div>

          {/* Template Picker */}
          <div style={{ marginBottom: '16px' }}>
            <label
              htmlFor="email-template-select"
              style={{
                display: 'block',
                fontSize: '11px',
                fontWeight: 700,
                color: 'var(--text-muted)',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                marginBottom: '6px',
              }}
            >
              Message Template
            </label>
            <select
              id="email-template-select"
              value={template}
              onChange={(e) => handleTemplateChange(e.target.value)}
              style={{
                width: '100%',
                height: '38px',
                padding: '0 10px',
                borderRadius: '7px',
                border: '1px solid var(--border-input)',
                background: 'var(--bg-input)',
                color: 'var(--text-primary)',
                fontSize: '13px',
                fontFamily: 'var(--font-sans)',
                outline: 'none',
              }}
            >
              <option value="custom">Custom message (Blank)</option>
              <option value="order_update">Order update notice</option>
              <option value="account_notice">Account security & status notice</option>
            </select>
          </div>

          {/* Optional linked order */}
          {customerOrders.length > 0 && (
            <div style={{ marginBottom: '16px' }}>
              <label
                htmlFor="email-order-select"
                style={{
                  display: 'block',
                  fontSize: '11px',
                  fontWeight: 700,
                  color: 'var(--text-muted)',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  marginBottom: '6px',
                }}
              >
                Link to Order (Optional)
              </label>
              <select
                id="email-order-select"
                value={orderId}
                onChange={(e) => setOrderId(e.target.value)}
                style={{
                  width: '100%',
                  height: '38px',
                  padding: '0 10px',
                  borderRadius: '7px',
                  border: '1px solid var(--border-input)',
                  background: 'var(--bg-input)',
                  color: 'var(--text-primary)',
                  fontSize: '13px',
                  fontFamily: 'var(--font-sans)',
                  outline: 'none',
                }}
              >
                <option value="">None (General notice)</option>
                {customerOrders.map((ord) => (
                  <option key={ord._id} value={ord._id}>
                    Order #{ord.orderNumber || ord._id.slice(-6)} · ${Number(ord.totalPrice || 0).toFixed(2)} ({ord.status})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Subject */}
          <div style={{ marginBottom: '16px' }}>
            <label
              htmlFor="email-subject-input"
              style={{
                display: 'block',
                fontSize: '11px',
                fontWeight: 700,
                color: 'var(--text-muted)',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                marginBottom: '6px',
              }}
            >
              Subject <span style={{ color: 'var(--color-danger)' }}>*</span>
            </label>
            <input
              id="email-subject-input"
              type="text"
              required
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. Update regarding your recent inquiry"
              style={{
                width: '100%',
                height: '38px',
                padding: '0 12px',
                borderRadius: '7px',
                border: '1px solid var(--border-input)',
                background: 'var(--bg-input)',
                color: 'var(--text-primary)',
                fontSize: '13px',
                fontFamily: 'var(--font-sans)',
                outline: 'none',
              }}
            />
            <small style={{ display: 'block', marginTop: '4px', fontSize: '11px', color: 'var(--text-muted)' }}>
              Automatically prefixed with "NovaShop: [NS-T-xxxx]" for support tracking.
            </small>
          </div>

          {/* Message Body */}
          <div style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label
                htmlFor="email-message-input"
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  color: 'var(--text-muted)',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                }}
              >
                Message <span style={{ color: 'var(--color-danger)' }}>*</span>
              </label>
              <span
                style={{
                  fontSize: '11px',
                  color: charCount > maxChars ? 'var(--color-danger)' : 'var(--text-muted)',
                }}
              >
                {charCount} / {maxChars}
              </span>
            </div>
            <textarea
              id="email-message-input"
              required
              rows={6}
              maxLength={maxChars}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Write message to customer... Use **bold text** and paragraphs. Customer replies will land in Customer Support."
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '7px',
                border: '1px solid var(--border-input)',
                background: 'var(--bg-input)',
                color: 'var(--text-primary)',
                fontSize: '13px',
                fontFamily: 'var(--font-sans)',
                lineHeight: 1.5,
                outline: 'none',
                resize: 'vertical',
                minHeight: '130px',
              }}
            />
          </div>

          {/* Actions */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: '10px',
              paddingTop: '14px',
              borderTop: '1px solid var(--border-subtle)',
            }}
          >
            <button
              type="button"
              className="admin-action-button"
              onClick={onClose}
              disabled={sending}
              style={{ minHeight: '36px', padding: '0 16px', fontSize: '13px' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="admin-action-button is-primary"
              disabled={sending || !subject.trim() || !message.trim() || charCount > maxChars}
              style={{ minHeight: '36px', padding: '0 18px', fontSize: '13px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              {sending ? (
                <>Sending email…</>
              ) : (
                <>
                  <AdminIcon name="mail" size={14} /> Send Email
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
