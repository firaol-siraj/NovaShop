import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { AdminIcon } from './AdminLayout';

function ModalBackdrop({ children, onClose, maxWidth = '540px' }) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        background: 'rgba(18, 15, 13, 0.65)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        animation: 'fadeIn 0.15s ease-out',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth,
          background: 'var(--bg-surface, #FFFFFF)',
          border: '1px solid var(--border-default, #E9E3DB)',
          borderRadius: '12px',
          boxShadow: 'var(--shadow-xl, 0 20px 25px -5px rgba(0, 0, 0, 0.2))',
          color: 'var(--text-primary, #1B1816)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '90vh',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    document.body
  );
}

/**
 * Reject Return Request Modal (Requires rejection reason)
 */
export function AdminRejectReturnModal({ isOpen, onClose, returnObj, onConfirm, isSubmitting }) {
  const [reasonCategory, setReasonCategory] = useState('Does not meet return policy criteria');
  const [details, setDetails] = useState('');
  const [error, setError] = useState('');

  if (!isOpen || !returnObj) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    const finalReason = details.trim() ? `${reasonCategory}: ${details.trim()}` : reasonCategory;
    if (!finalReason) {
      setError('Please provide a reason for rejection.');
      return;
    }
    onConfirm({ reason: finalReason });
  };

  return (
    <ModalBackdrop onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-subtle, #EEE9E2)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: 'var(--text-primary, #1B1816)' }}>
              Reject Return Request #{returnObj.returnNumber || returnObj.id}
            </h3>
            <button
              type="button"
              onClick={onClose}
              style={{ background: 'transparent', border: 0, cursor: 'pointer', color: 'var(--text-muted, #8A8070)' }}
            >
              <AdminIcon name="close" size={16} />
            </button>
          </div>
          <p style={{ margin: '6px 0 0', fontSize: '13px', color: 'var(--text-secondary, #736B5E)' }}>
            This will mark the return request as rejected and notify the customer via email with your explanation.
          </p>
        </div>

        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto' }}>
          {error && (
            <div style={{ padding: '10px 14px', borderRadius: '6px', background: 'var(--admin-red-soft, #FDE8E8)', color: 'var(--admin-red, #DB3030)', fontSize: '12px', fontWeight: 500 }}>
              {error}
            </div>
          )}

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px', color: 'var(--text-primary)' }}>
              Rejection Reason *
            </label>
            <select
              value={reasonCategory}
              onChange={(e) => setReasonCategory(e.target.value)}
              style={{
                width: '100%',
                height: '38px',
                padding: '0 12px',
                borderRadius: '6px',
                border: '1px solid var(--border-default, #E9E3DB)',
                background: 'var(--bg-surface-raised, #FBFAF8)',
                color: 'var(--text-primary, #1B1816)',
                fontSize: '13px',
                outline: 'none',
              }}
            >
              <option value="Does not meet return policy criteria">Does not meet return policy criteria</option>
              <option value="Return policy window expired (over 14 days)">Return policy window expired (over 14 days)</option>
              <option value="Item returned damaged or modified by user">Item returned damaged or modified by user</option>
              <option value="Missing original tags, packaging or parts">Missing original tags, packaging or parts</option>
              <option value="Unauthorized or non-refundable clearance item">Unauthorized or non-refundable clearance item</option>
              <option value="Other">Other reason</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px', color: 'var(--text-primary)' }}>
              Additional Customer Notice (Optional)
            </label>
            <textarea
              rows={3}
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Add specific details or instructions for the customer..."
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '6px',
                border: '1px solid var(--border-default, #E9E3DB)',
                background: 'var(--bg-surface-raised, #FBFAF8)',
                color: 'var(--text-primary, #1B1816)',
                fontSize: '13px',
                fontFamily: 'var(--font-sans)',
                outline: 'none',
                resize: 'vertical',
                boxSizing: 'border-box',
              }}
            />
          </div>
        </div>

        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border-subtle, #EEE9E2)', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            style={{
              padding: '8px 16px',
              borderRadius: '6px',
              border: '1px solid var(--border-default, #E9E3DB)',
              background: 'transparent',
              color: 'var(--text-primary, #1B1816)',
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            style={{
              padding: '8px 18px',
              borderRadius: '6px',
              border: 'none',
              background: 'var(--admin-red, #DB3030)',
              color: '#FFFFFF',
              fontSize: '13px',
              fontWeight: 600,
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              opacity: isSubmitting ? 0.7 : 1,
            }}
          >
            {isSubmitting ? 'Rejecting...' : 'Reject Return'}
          </button>
        </div>
      </form>
    </ModalBackdrop>
  );
}

/**
 * Receive & Restock Modal (Optionally restocks items to inventory)
 */
export function AdminReceiveRestockModal({ isOpen, onClose, returnObj, onConfirm, isSubmitting }) {
  const items = useMemo(() => returnObj?.items || [], [returnObj]);
  const [restockMap, setRestockMap] = useState({});
  const [inspectionNote, setInspectionNote] = useState('Items received and inspected at central depot.');

  useEffect(() => {
    if (items.length > 0) {
      const initial = {};
      items.forEach((item, idx) => {
        initial[item._id || idx] = true;
      });
      setRestockMap(initial);
    }
  }, [items]);

  if (!isOpen || !returnObj) return null;

  const toggleItem = (key) => {
    setRestockMap((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const restockItems = items.map((item, idx) => ({
      itemIndex: idx,
      productId: item.product?._id || item.product,
      sku: item.sku,
      qty: item.qty,
      shouldRestock: Boolean(restockMap[item._id || idx]),
    }));
    onConfirm({ restockItems, note: inspectionNote });
  };

  return (
    <ModalBackdrop onClose={onClose} maxWidth="600px">
      <form onSubmit={handleSubmit}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-subtle, #EEE9E2)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: 'var(--text-primary, #1B1816)' }}>
              Confirm Receipt &amp; Restock: #{returnObj.returnNumber || returnObj.id}
            </h3>
            <button
              type="button"
              onClick={onClose}
              style={{ background: 'transparent', border: 0, cursor: 'pointer', color: 'var(--text-muted, #8A8070)' }}
            >
              <AdminIcon name="close" size={16} />
            </button>
          </div>
          <p style={{ margin: '6px 0 0', fontSize: '13px', color: 'var(--text-secondary, #736B5E)' }}>
            Mark this package as received at depot. Choose which returned items to restore back into inventory.
          </p>
        </div>

        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '8px', color: 'var(--text-primary)' }}>
              Returned Items &amp; Restock Options
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {items.map((item, idx) => {
                const key = item._id || idx;
                const isChecked = Boolean(restockMap[key]);
                return (
                  <div
                    key={key}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-default, #E9E3DB)',
                      background: 'var(--bg-surface-raised, #FBFAF8)',
                    }}
                  >
                    <div>
                      <strong style={{ display: 'block', fontSize: '13px', color: 'var(--text-primary)' }}>
                        {item.productName || item.name}
                      </strong>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        {item.variantName || item.variant || 'Standard'} · SKU: {item.sku || 'N/A'} · Qty: {item.qty}
                      </span>
                    </div>

                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '12px', cursor: 'pointer', userSelect: 'none' }}>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleItem(key)}
                        style={{ accentColor: 'var(--admin-primary, #1B1816)' }}
                      />
                      <span>Restock ({item.qty} units)</span>
                    </label>
                  </div>
                );
              })}
            </div>
            <span style={{ display: 'block', marginTop: '6px', fontSize: '11px', color: 'var(--text-muted)' }}>
              Restocked items will be recorded in Inventory Movement history as <code>return_restore</code>.
            </span>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px', color: 'var(--text-primary)' }}>
              Depot Inspection Note
            </label>
            <input
              type="text"
              value={inspectionNote}
              onChange={(e) => setInspectionNote(e.target.value)}
              style={{
                width: '100%',
                height: '38px',
                padding: '0 12px',
                borderRadius: '6px',
                border: '1px solid var(--border-default, #E9E3DB)',
                background: 'var(--bg-surface-raised, #FBFAF8)',
                color: 'var(--text-primary, #1B1816)',
                fontSize: '13px',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>
        </div>

        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border-subtle, #EEE9E2)', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            style={{
              padding: '8px 16px',
              borderRadius: '6px',
              border: '1px solid var(--border-default, #E9E3DB)',
              background: 'transparent',
              color: 'var(--text-primary, #1B1816)',
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            style={{
              padding: '8px 18px',
              borderRadius: '6px',
              border: '1px solid var(--color-primary, #1B1816)',
              background: 'var(--color-primary, #1B1816)',
              color: 'var(--color-primary-contrast, #FFFFFF)',
              fontSize: '13px',
              fontWeight: 600,
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              opacity: isSubmitting ? 0.7 : 1,
            }}
          >
            {isSubmitting ? 'Processing...' : 'Confirm Receipt & Restock'}
          </button>
        </div>
      </form>
    </ModalBackdrop>
  );
}

/**
 * Issue Refund Modal (Validated against remaining refundable amount, idempotent)
 */
export function AdminProcessRefundModal({ isOpen, onClose, returnObj, onConfirm, isSubmitting }) {
  const suggestedAmount = returnObj?.refundAmountUSD ?? returnObj?.amount ?? 0;
  const maxRefundable = returnObj?.order?.totalPrice
    ? Math.max(0, returnObj.order.totalPrice - (returnObj.order.refundedAmountUSD || 0))
    : suggestedAmount;

  const [refundType, setRefundType] = useState('full');
  const [customAmount, setCustomAmount] = useState(String(suggestedAmount));
  const [includeShipping, setIncludeShipping] = useState(false);
  const [refundMethod, setRefundMethod] = useState(returnObj?.refundMethod || 'Original payment method');
  const [refundReference, setRefundReference] = useState('');
  const [error, setError] = useState('');

  if (!isOpen || !returnObj) return null;

  const amountToRefund = refundType === 'full' ? Number(suggestedAmount) : Number(customAmount || 0);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (isNaN(amountToRefund) || amountToRefund <= 0) {
      setError('Please enter a valid refund amount greater than 0.');
      return;
    }

    if (amountToRefund > maxRefundable + 0.01) {
      setError(`Refund amount ($${amountToRefund.toFixed(2)}) cannot exceed maximum refundable ($${maxRefundable.toFixed(2)}).`);
      return;
    }

    setError('');
    onConfirm({
      amountUSD: amountToRefund,
      refundMethod,
      includeShipping,
      refundReference: refundReference.trim(),
      note: `Refund issued via ${refundMethod}. Ref: ${refundReference.trim() || 'Auto'}`,
    });
  };

  return (
    <ModalBackdrop onClose={onClose} maxWidth="560px">
      <form onSubmit={handleSubmit}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-subtle, #EEE9E2)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: 'var(--text-primary, #1B1816)' }}>
              Issue Refund: #{returnObj.returnNumber || returnObj.id}
            </h3>
            <button
              type="button"
              onClick={onClose}
              style={{ background: 'transparent', border: 0, cursor: 'pointer', color: 'var(--text-muted, #8A8070)' }}
            >
              <AdminIcon name="close" size={16} />
            </button>
          </div>
          <p style={{ margin: '6px 0 0', fontSize: '13px', color: 'var(--text-secondary, #736B5E)' }}>
            Process refund for customer <strong>{returnObj.customerName || returnObj.customer}</strong>.
          </p>
        </div>

        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto' }}>
          {error && (
            <div style={{ padding: '10px 14px', borderRadius: '6px', background: 'var(--admin-red-soft, #FDE8E8)', color: 'var(--admin-red, #DB3030)', fontSize: '12px', fontWeight: 500 }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: '12px' }}>
            <label
              style={{
                flex: 1,
                padding: '12px',
                borderRadius: '8px',
                border: `1.5px solid ${refundType === 'full' ? 'var(--admin-primary, #1B1816)' : 'var(--border-default, #E9E3DB)'}`,
                background: refundType === 'full' ? 'var(--bg-surface-sunken, #F8F6F3)' : 'var(--bg-surface, #FFFFFF)',
                cursor: 'pointer',
              }}
            >
              <input
                type="radio"
                name="refundType"
                checked={refundType === 'full'}
                onChange={() => setRefundType('full')}
                style={{ marginRight: '8px' }}
              />
              <strong style={{ fontSize: '13px', color: 'var(--text-primary)' }}>Full Items Refund</strong>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                ${Number(suggestedAmount).toFixed(2)}
              </div>
            </label>

            <label
              style={{
                flex: 1,
                padding: '12px',
                borderRadius: '8px',
                border: `1.5px solid ${refundType === 'partial' ? 'var(--admin-primary, #1B1816)' : 'var(--border-default, #E9E3DB)'}`,
                background: refundType === 'partial' ? 'var(--bg-surface-sunken, #F8F6F3)' : 'var(--bg-surface, #FFFFFF)',
                cursor: 'pointer',
              }}
            >
              <input
                type="radio"
                name="refundType"
                checked={refundType === 'partial'}
                onChange={() => setRefundType('partial')}
                style={{ marginRight: '8px' }}
              />
              <strong style={{ fontSize: '13px', color: 'var(--text-primary)' }}>Partial Refund</strong>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                Custom amount
              </div>
            </label>
          </div>

          {refundType === 'partial' && (
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px', color: 'var(--text-primary)' }}>
                Refund Amount (USD) *
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                max={maxRefundable}
                value={customAmount}
                onChange={(e) => setCustomAmount(e.target.value)}
                style={{
                  width: '100%',
                  height: '38px',
                  padding: '0 12px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-default, #E9E3DB)',
                  background: 'var(--bg-surface-raised, #FBFAF8)',
                  color: 'var(--text-primary, #1B1816)',
                  fontSize: '14px',
                  fontWeight: 600,
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
              <small style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                Remaining refundable on order: ${Number(maxRefundable).toFixed(2)}
              </small>
            </div>
          )}

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px', color: 'var(--text-primary)' }}>
              Refund Method
            </label>
            <select
              value={refundMethod}
              onChange={(e) => setRefundMethod(e.target.value)}
              style={{
                width: '100%',
                height: '38px',
                padding: '0 12px',
                borderRadius: '6px',
                border: '1px solid var(--border-default, #E9E3DB)',
                background: 'var(--bg-surface-raised, #FBFAF8)',
                color: 'var(--text-primary, #1B1816)',
                fontSize: '13px',
                outline: 'none',
              }}
            >
              <option value="Original payment method">Original payment method (Chapa / Card)</option>
              <option value="Store credit">Store credit</option>
              <option value="Manual bank transfer">Manual bank transfer (Recorded)</option>
              <option value="Cash / Depot">Cash / In-person depot refund</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px', color: 'var(--text-primary)' }}>
              Payment Reference / Gateway Tx ID (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. CHP-REF-99214 or Bank Tx Reference"
              value={refundReference}
              onChange={(e) => setRefundReference(e.target.value)}
              style={{
                width: '100%',
                height: '38px',
                padding: '0 12px',
                borderRadius: '6px',
                border: '1px solid var(--border-default, #E9E3DB)',
                background: 'var(--bg-surface-raised, #FBFAF8)',
                color: 'var(--text-primary, #1B1816)',
                fontSize: '13px',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '12px', cursor: 'pointer', userSelect: 'none' }}>
            <input
              type="checkbox"
              checked={includeShipping}
              onChange={(e) => setIncludeShipping(e.target.checked)}
              style={{ accentColor: 'var(--admin-primary, #1B1816)' }}
            />
            <span>Include original shipping fee in refund</span>
          </label>
        </div>

        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border-subtle, #EEE9E2)', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            style={{
              padding: '8px 16px',
              borderRadius: '6px',
              border: '1px solid var(--border-default, #E9E3DB)',
              background: 'transparent',
              color: 'var(--text-primary, #1B1816)',
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            style={{
              padding: '8px 18px',
              borderRadius: '6px',
              border: '1px solid var(--color-primary, #1B1816)',
              background: 'var(--color-primary, #1B1816)',
              color: 'var(--color-primary-contrast, #FFFFFF)',
              fontSize: '13px',
              fontWeight: 600,
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              opacity: isSubmitting ? 0.7 : 1,
            }}
          >
            {isSubmitting ? 'Processing...' : `Issue Refund ($${amountToRefund.toFixed(2)})`}
          </button>
        </div>
      </form>
    </ModalBackdrop>
  );
}

/**
 * Printable Return Slip Modal (Force light theme styling for physical prints)
 */
export function AdminPrintReturnSlipModal({ isOpen, onClose, returnObj }) {
  const rawItems = returnObj?.items;
  const items = useMemo(() => {
    if (Array.isArray(rawItems) && rawItems.length > 0) return rawItems;
    if (typeof rawItems === 'string' && rawItems.trim()) {
      return [{
        name: rawItems,
        productName: rawItems,
        qty: returnObj?.itemsCount || 1,
        sku: 'RMA-ITEM',
        refundValue: returnObj?.refundAmountUSD || returnObj?.amount || 0,
      }];
    }
    return [{
      name: 'Returned Item',
      productName: 'Returned Item',
      qty: 1,
      sku: 'RMA-ITEM',
      refundValue: returnObj?.refundAmountUSD || returnObj?.amount || 0,
    }];
  }, [rawItems, returnObj]);

  const totalAmount = returnObj?.refundAmountUSD || returnObj?.amount || 0;

  if (!isOpen || !returnObj) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <ModalBackdrop onClose={onClose} maxWidth="720px">
      <div style={{ padding: '16px 24px', borderBottom: '1px solid #E9E3DB', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#F8F6F3' }}>
        <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: '#1B1816' }}>
          Print Return Slip #{returnObj.returnNumber || returnObj.id}
        </h3>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            onClick={handlePrint}
            style={{
              padding: '6px 14px',
              borderRadius: '6px',
              border: 'none',
              background: '#1B1816',
              color: '#FFFFFF',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <AdminIcon name="print" size={13} /> Print Slip
          </button>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'transparent', border: 0, cursor: 'pointer', color: '#8A8070' }}
          >
            <AdminIcon name="close" size={16} />
          </button>
        </div>
      </div>

      <div
        id="printable-return-slip"
        style={{
          padding: '36px',
          background: '#FFFFFF',
          color: '#1B1816',
          fontFamily: 'var(--font-sans, system-ui, sans-serif)',
          overflowY: 'auto',
          lineHeight: 1.5,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #1B1816', paddingBottom: '16px', marginBottom: '24px' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 700, letterSpacing: '-0.02em', textTransform: 'uppercase' }}>
              NovaShop
            </h1>
            <div style={{ fontSize: '12px', color: '#666', marginTop: '2px' }}>
              Return Merchandise Authorization (RMA) Slip
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '18px', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
              #{returnObj.returnNumber || returnObj.id}
            </div>
            <div style={{ fontSize: '11px', color: '#666' }}>
              Issued: {new Date(returnObj.requestedAt || returnObj.createdAt || Date.now()).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
            </div>
            <div style={{ display: 'inline-block', marginTop: '6px' }}>
              <svg width="140" height="38" viewBox="0 0 140 38" aria-label="RMA Barcode">
                <rect x="0" y="0" width="3" height="28" fill="#1B1816" />
                <rect x="5" y="0" width="1" height="28" fill="#1B1816" />
                <rect x="8" y="0" width="4" height="28" fill="#1B1816" />
                <rect x="15" y="0" width="2" height="28" fill="#1B1816" />
                <rect x="19" y="0" width="5" height="28" fill="#1B1816" />
                <rect x="26" y="0" width="2" height="28" fill="#1B1816" />
                <rect x="30" y="0" width="1" height="28" fill="#1B1816" />
                <rect x="33" y="0" width="4" height="28" fill="#1B1816" />
                <rect x="39" y="0" width="2" height="28" fill="#1B1816" />
                <rect x="43" y="0" width="3" height="28" fill="#1B1816" />
                <rect x="48" y="0" width="5" height="28" fill="#1B1816" />
                <rect x="55" y="0" width="1" height="28" fill="#1B1816" />
                <rect x="58" y="0" width="4" height="28" fill="#1B1816" />
                <rect x="64" y="0" width="2" height="28" fill="#1B1816" />
                <rect x="68" y="0" width="4" height="28" fill="#1B1816" />
                <rect x="74" y="0" width="3" height="28" fill="#1B1816" />
                <rect x="79" y="0" width="1" height="28" fill="#1B1816" />
                <rect x="82" y="0" width="4" height="28" fill="#1B1816" />
                <rect x="88" y="0" width="2" height="28" fill="#1B1816" />
                <rect x="92" y="0" width="5" height="28" fill="#1B1816" />
                <rect x="99" y="0" width="1" height="28" fill="#1B1816" />
                <rect x="102" y="0" width="3" height="28" fill="#1B1816" />
                <rect x="107" y="0" width="4" height="28" fill="#1B1816" />
                <rect x="113" y="0" width="2" height="28" fill="#1B1816" />
                <rect x="117" y="0" width="5" height="28" fill="#1B1816" />
                <rect x="124" y="0" width="2" height="28" fill="#1B1816" />
                <rect x="128" y="0" width="4" height="28" fill="#1B1816" />
                <rect x="134" y="0" width="3" height="28" fill="#1B1816" />
                <text x="70" y="36" textAnchor="middle" fontSize="8" fontFamily="monospace" fill="#555">
                  *{returnObj.returnNumber || returnObj.id}*
                </text>
              </svg>
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px', fontSize: '12px' }}>
          <div style={{ padding: '12px', background: '#F8F6F3', borderRadius: '6px', border: '1px solid #EEE' }}>
            <strong style={{ display: 'block', fontSize: '11px', textTransform: 'uppercase', color: '#888', marginBottom: '4px' }}>Customer Details</strong>
            <div style={{ fontWeight: 600 }}>{returnObj.customerName || returnObj.customer}</div>
            <div>{returnObj.customerEmail || returnObj.email}</div>
            <div>Order: #{returnObj.orderNumber || returnObj.orderId || '-'}</div>
          </div>

          <div style={{ padding: '12px', background: '#F8F6F3', borderRadius: '6px', border: '1px solid #EEE' }}>
            <strong style={{ display: 'block', fontSize: '11px', textTransform: 'uppercase', color: '#888', marginBottom: '4px' }}>Return Depot Address</strong>
            <div style={{ fontWeight: 600 }}>NovaShop Central Logistics Depot</div>
            <div>Bole International Logistics Park, Unit 4B</div>
            <div>Addis Ababa, Ethiopia</div>
          </div>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '24px', fontSize: '12px' }}>
          <thead>
            <tr style={{ borderBottom: '1.5px solid #1B1816', textAlign: 'left' }}>
              <th style={{ padding: '8px 0' }}>Item Details</th>
              <th style={{ padding: '8px 0' }}>SKU</th>
              <th style={{ padding: '8px 0', textAlign: 'center' }}>Qty</th>
              <th style={{ padding: '8px 0', textAlign: 'right' }}>Refund Value</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it, idx) => (
              <tr key={idx} style={{ borderBottom: '1px solid #EEE' }}>
                <td style={{ padding: '10px 0' }}>
                  <strong>{it.productName || it.name}</strong>
                  {it.variantName && <div style={{ fontSize: '11px', color: '#666' }}>{it.variantName}</div>}
                  <div style={{ fontSize: '11px', color: '#888' }}>Reason: {it.reason || returnObj.reason || 'Not specified'}</div>
                </td>
                <td style={{ padding: '10px 0', color: '#666' }}>{it.sku || 'N/A'}</td>
                <td style={{ padding: '10px 0', textAlign: 'center' }}>{it.qty}</td>
                <td style={{ padding: '10px 0', textAlign: 'right', fontWeight: 600 }}>
                  ${Number(it.refundValue || (it.unitPrice || it.price) * it.qty || 0).toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan="3" style={{ padding: '12px 0 0', textAlign: 'right', fontWeight: 600 }}>Total Authorized Refund:</td>
              <td style={{ padding: '12px 0 0', textAlign: 'right', fontWeight: 700, fontSize: '14px' }}>
                ${Number(totalAmount).toFixed(2)}
              </td>
            </tr>
          </tfoot>
        </table>

        <div style={{ borderTop: '1px dashed #CCC', paddingTop: '16px', fontSize: '11px', color: '#555' }}>
          <strong>Instructions for Return:</strong>
          <ol style={{ margin: '6px 0 0', paddingLeft: '18px' }}>
            <li>Please insert this RMA slip inside your package before sealing it.</li>
            <li>Ensure all items are returned in their original condition with tags and packaging intact.</li>
            <li>Our prepaid courier service will contact you for pickup, or you may drop the parcel at the depot address above.</li>
            <li>Refunds will be issued upon depot receipt and quality inspection.</li>
          </ol>
        </div>
      </div>
    </ModalBackdrop>
  );
}
