import { useState } from 'react';
import { createPortal } from 'react-dom';
import { AdminIcon } from './AdminLayout';

/**
 * Confirmation dialog for Blocking or Unblocking a customer account.
 * For blocking, a reason is required and explained that login is revoked and security email dispatched.
 */
export function BlockCustomerModal({ customer, isOpen, onClose, onConfirm }) {
  const [reason, setReason] = useState('Suspicious activity or policy violation');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen || !customer) return null;

  const isBlocked = customer.status === 'blocked' || customer.status === 'deactivated' || customer.isDeactivated;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isBlocked && !reason.trim()) {
      setError('Please provide a reason for blocking this customer.');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      await onConfirm(reason.trim());
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to update account status.');
    } finally {
      setSubmitting(false);
    }
  };

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
      aria-labelledby="block-dialog-title"
    >
      <div
        style={{
          width: '100%',
          maxWidth: '480px',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-default)',
          borderRadius: '12px',
          boxShadow: 'var(--shadow-lg)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '18px 22px',
            borderBottom: '1px solid var(--border-subtle)',
            background: isBlocked ? 'var(--bg-surface-raised)' : 'var(--color-danger-soft)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ color: isBlocked ? 'var(--color-success)' : 'var(--color-danger)' }}>
              <AdminIcon name={isBlocked ? 'check' : 'alert'} size={20} />
            </span>
            <h2
              id="block-dialog-title"
              style={{
                margin: 0,
                fontSize: '16px',
                fontWeight: 600,
                fontFamily: 'var(--font-serif)',
                color: isBlocked ? 'var(--text-primary)' : 'var(--color-danger)',
              }}
            >
              {isBlocked ? 'Reactivate Customer Account' : 'Block Customer Account'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            style={{
              background: 'transparent',
              border: 0,
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '4px',
            }}
          >
            <AdminIcon name="close" size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '20px 22px' }}>
          {error && (
            <div
              role="alert"
              style={{
                marginBottom: '14px',
                padding: '8px 12px',
                borderRadius: '6px',
                background: 'var(--color-danger-soft)',
                color: 'var(--color-danger)',
                fontSize: '12px',
              }}
            >
              {error}
            </div>
          )}

          <p style={{ margin: '0 0 16px', fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            {isBlocked ? (
              <>
                Are you sure you want to reactivate the account for <strong>{customer.name}</strong> ({customer.email})?
                The customer will regain storefront sign-in and checkout access.
              </>
            ) : (
              <>
                Blocking will revoke all active browser sessions, immediately prevent <strong>{customer.name}</strong> ({customer.email}) from logging in or placing orders, and send a security notice to their email.
              </>
            )}
          </p>

          {!isBlocked && (
            <div style={{ marginBottom: '18px' }}>
              <label
                htmlFor="block-reason-input"
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
                Reason for Blocking <span style={{ color: 'var(--color-danger)' }}>*</span>
              </label>
              <textarea
                id="block-reason-input"
                required
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Explain the reason for this administrative suspension..."
                style={{
                  width: '100%',
                  padding: '9px 11px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-input)',
                  background: 'var(--bg-input)',
                  color: 'var(--text-primary)',
                  fontSize: '13px',
                  fontFamily: 'var(--font-sans)',
                  outline: 'none',
                  resize: 'vertical',
                }}
              />
            </div>
          )}

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: '10px',
              paddingTop: '12px',
              borderTop: '1px solid var(--border-subtle)',
            }}
          >
            <button
              type="button"
              className="admin-action-button"
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || (!isBlocked && !reason.trim())}
              className={`admin-action-button ${isBlocked ? 'is-primary' : 'is-danger'}`}
              style={{
                background: !isBlocked ? 'var(--color-danger)' : undefined,
                color: !isBlocked ? '#FFFFFF' : undefined,
                borderColor: !isBlocked ? 'var(--color-danger)' : undefined,
              }}
            >
              {submitting
                ? 'Processing…'
                : isBlocked
                ? 'Reactivate Account'
                : 'Confirm & Block Account'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}

/**
 * Safe delete dialog:
 * - If customer has orders or activity records, hard delete is blocked and offers "Anonymize and deactivate"
 *   with required email confirmation.
 * - If customer has 0 records, offers permanent deletion.
 */
export function SafeDeleteCustomerModal({
  customer,
  isOpen,
  onClose,
  onConfirmPermanentDelete,
  onConfirmAnonymize,
}) {
  const [typedEmail, setTypedEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen || !customer) return null;

  const orderCount = Number(customer.orders || customer.ordersCount || customer.paidOrdersCount || 0);
  const hasRecords = orderCount > 0;

  const handlePermanentSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await onConfirmPermanentDelete();
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to delete customer.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAnonymizeSubmit = async (e) => {
    e.preventDefault();
    if (typedEmail.trim().toLowerCase() !== String(customer.email).trim().toLowerCase()) {
      setError('Please type the exact email address to confirm anonymization.');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      await onConfirmAnonymize();
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to anonymize customer record.');
    } finally {
      setSubmitting(false);
    }
  };

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
      aria-labelledby="delete-dialog-title"
    >
      <div
        style={{
          width: '100%',
          maxWidth: '520px',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-default)',
          borderRadius: '12px',
          boxShadow: 'var(--shadow-lg)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '18px 22px',
            borderBottom: '1px solid var(--border-subtle)',
            background: 'var(--color-danger-soft)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ color: 'var(--color-danger)' }}>
              <AdminIcon name="trash" size={20} />
            </span>
            <h2
              id="delete-dialog-title"
              style={{
                margin: 0,
                fontSize: '16px',
                fontWeight: 600,
                fontFamily: 'var(--font-serif)',
                color: 'var(--color-danger)',
              }}
            >
              {hasRecords ? 'Anonymize & Deactivate Customer' : 'Permanently Delete Customer'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            style={{
              background: 'transparent',
              border: 0,
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '4px',
            }}
          >
            <AdminIcon name="close" size={16} />
          </button>
        </div>

        {hasRecords ? (
          <form onSubmit={handleAnonymizeSubmit} style={{ padding: '20px 22px' }}>
            {error && (
              <div
                role="alert"
                style={{
                  marginBottom: '14px',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  background: 'var(--color-danger-soft)',
                  color: 'var(--color-danger)',
                  fontSize: '12px',
                }}
              >
                {error}
              </div>
            )}

            <div
              style={{
                padding: '12px 14px',
                borderRadius: '8px',
                background: 'var(--color-warning-soft)',
                color: 'var(--color-warning)',
                fontSize: '12px',
                lineHeight: 1.5,
                marginBottom: '16px',
              }}
            >
              <strong>Accounting & Regulatory Protection:</strong> This customer has {orderCount} order(s) on file.
              To preserve sales history, payments, and tax invoices, hard deletion is prohibited.
            </div>

            <p style={{ margin: '0 0 16px', fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Proceeding will scrub all personal identifying information (name, email, phone, addresses),
              revoke sessions, and mark the account as deactivated while safely keeping order invoices for accounting.
            </p>

            <div style={{ marginBottom: '18px' }}>
              <label
                htmlFor="confirm-email-input"
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
                Type customer email (<strong>{customer.email}</strong>) to confirm:
              </label>
              <input
                id="confirm-email-input"
                type="text"
                required
                value={typedEmail}
                onChange={(e) => setTypedEmail(e.target.value)}
                placeholder={customer.email}
                style={{
                  width: '100%',
                  height: '38px',
                  padding: '0 12px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-input)',
                  background: 'var(--bg-input)',
                  color: 'var(--text-primary)',
                  fontSize: '13px',
                  fontFamily: 'var(--font-sans)',
                  outline: 'none',
                }}
              />
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                gap: '10px',
                paddingTop: '12px',
                borderTop: '1px solid var(--border-subtle)',
              }}
            >
              <button
                type="button"
                className="admin-action-button"
                onClick={onClose}
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || typedEmail.trim().toLowerCase() !== String(customer.email).trim().toLowerCase()}
                className="admin-action-button is-danger"
                style={{
                  background: 'var(--color-danger)',
                  color: '#FFFFFF',
                  borderColor: 'var(--color-danger)',
                }}
              >
                {submitting ? 'Anonymizing…' : 'Anonymize and Deactivate'}
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handlePermanentSubmit} style={{ padding: '20px 22px' }}>
            {error && (
              <div
                role="alert"
                style={{
                  marginBottom: '14px',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  background: 'var(--color-danger-soft)',
                  color: 'var(--color-danger)',
                  fontSize: '12px',
                }}
              >
                {error}
              </div>
            )}

            <p style={{ margin: '0 0 18px', fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Are you sure you want to permanently delete <strong>{customer.name}</strong> ({customer.email})?
              This customer has no orders, payments, or support tickets. This action cannot be undone.
            </p>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                gap: '10px',
                paddingTop: '12px',
                borderTop: '1px solid var(--border-subtle)',
              }}
            >
              <button
                type="button"
                className="admin-action-button"
                onClick={onClose}
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="admin-action-button is-danger"
                style={{
                  background: 'var(--color-danger)',
                  color: '#FFFFFF',
                  borderColor: 'var(--color-danger)',
                }}
              >
                {submitting ? 'Deleting…' : 'Permanently Delete'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>,
    document.body
  );
}
