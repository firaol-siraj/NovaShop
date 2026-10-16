import { useState, useEffect } from 'react';
import AccountLayout from '../components/account/AccountLayout';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';

function formatMoney(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(Number(value || 0));
}

// Mock payment methods data
const mockPaymentMethods = [
  {
    id: 'pm-1',
    network: 'Visa',
    lastFour: '8832',
    expiry: '12/2026',
    isDefault: true,
  },
  {
    id: 'pm-2',
    network: 'Mastercard',
    lastFour: '4456',
    expiry: '08/2025',
    isDefault: false,
  },
];

// Mock billing history data (from orders)
const mockBillingHistory = [
  {
    id: 'NS-2024-0142',
    date: '2024-09-25',
    amount: 830,
    paymentMethod: 'Visa •••• 8832',
    status: 'Paid',
  },
  {
    id: 'NS-2024-0098',
    date: '2024-08-12',
    amount: 440,
    paymentMethod: 'Mastercard •••• 4456',
    status: 'Paid',
  },
];

function CardIcon({ network }) {
  if (network === 'Visa') {
    return (
      <svg width="32" height="20" viewBox="0 0 32 20" fill="none" aria-hidden="true">
        <rect width="32" height="20" rx="2" fill="#1A1F71"/>
        <text x="6" y="14" fill="#fff" fontSize="8" fontWeight="bold" fontFamily="sans-serif">VISA</text>
      </svg>
    );
  }
  if (network === 'Mastercard') {
    return (
      <svg width="32" height="20" viewBox="0 0 32 20" fill="none" aria-hidden="true">
        <rect width="32" height="20" rx="2" fill="#000"/>
        <circle cx="12" cy="10" r="6" fill="#EB001B"/>
        <circle cx="20" cy="10" r="6" fill="#F79E1B"/>
      </svg>
    );
  }
  return (
    <svg width="32" height="20" viewBox="0 0 32 20" fill="none" aria-hidden="true">
      <rect width="32" height="20" rx="2" fill="#666"/>
    </svg>
  );
}

export default function PaymentsPage({ go, currentPath }) {
  const { orders } = useCart();
  const { user, isLoading } = useAuth();
  const [paymentMethods, setPaymentMethods] = useState(mockPaymentMethods);
  const [showAddModal, setShowAddModal] = useState(false);
  const [removingId, setRemovingId] = useState(null);
  const [settingDefaultId, setSettingDefaultId] = useState(null);
  const [userVersion, setUserVersion] = useState(0);

  useEffect(() => {
    if (!isLoading && !user) {
      go('/login?redirect=/account/payments');
    }
  }, [isLoading, user, go]);

  useEffect(() => {
    const handleUserUpdated = () => {
      setUserVersion((value) => value + 1);
    };
    window.addEventListener('novashop:user-updated', handleUserUpdated);
    return () => window.removeEventListener('novashop:user-updated', handleUserUpdated);
  }, []);

  const handleSetDefault = (id) => {
    setSettingDefaultId(id);
    setTimeout(() => {
      setPaymentMethods((current) =>
        current.map((pm) => ({ ...pm, isDefault: pm.id === id }))
      );
      setSettingDefaultId(null);
    }, 200);
  };

  const handleRemove = (id) => {
    setRemovingId(id);
    setTimeout(() => {
      setPaymentMethods((current) => current.filter((pm) => pm.id !== id));
      setRemovingId(null);
    }, 240);
  };

  const handleAddPayment = (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const newMethod = {
      id: `pm-${Date.now()}`,
      network: formData.get('network'),
      lastFour: formData.get('number').slice(-4),
      expiry: formData.get('expiry'),
      isDefault: paymentMethods.length === 0,
    };
    setPaymentMethods((current) => [...current, newMethod]);
    setShowAddModal(false);
    e.target.reset();
  };

  if (!user) return null;

  return (
    <AccountLayout go={go} currentPath={currentPath || '/account/payments'}>
      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '28px 0 18px', fontFamily: 'var(--font-sans)', fontSize: '11px', letterSpacing: '0.13em', textTransform: 'uppercase', color: '#8D837D', flexWrap: 'wrap' }}>
        <button type="button" onClick={() => go('/')} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: '#8D837D', fontFamily: 'inherit', letterSpacing: 'inherit', textTransform: 'inherit' }}>Home</button>
        <span style={{ margin: '0 10px', color: '#B9B1AB' }}>/</span>
        <button type="button" onClick={() => go('/account')} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: '#8D837D', fontFamily: 'inherit', letterSpacing: 'inherit', textTransform: 'inherit' }}>Account</button>
        <span style={{ margin: '0 10px', color: '#B9B1AB' }}>/</span>
        <span style={{ color: '#1B1816' }}>Payments & Invoicing</span>
      </div>

      {/* Page Header */}
      <section style={{ background: '#F7F2EA', border: '1px solid rgba(27,24,22,0.12)', borderRadius: '14px', padding: '26px 22px 22px' }}>
        <div>
          <div style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.16em', textTransform: 'uppercase', color: '#7A726C', marginBottom: '8px' }}>
            Payment Settings
          </div>
          <h2 style={{ margin: 0, fontFamily: 'var(--font-serif)', fontSize: 'clamp(30px, 3vw, 42px)', fontWeight: 500, letterSpacing: '-0.04em', color: '#1B1816' }}>
            Payments & Invoicing
          </h2>
          <p style={{ margin: '8px 0 0', fontFamily: 'var(--font-sans)', fontSize: '14px', color: '#6E6962', lineHeight: 1.6 }}>
            Manage your payment methods and view billing history.
          </p>
        </div>
      </section>

      {/* Saved Payment Methods */}
      <section style={{ background: '#F7F2EA', border: '1px solid rgba(27,24,22,0.12)', borderRadius: '14px', padding: '26px 22px 22px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', marginBottom: '20px' }}>
          <h3 style={{ margin: 0, fontFamily: 'var(--font-serif)', fontSize: '24px', color: '#1B1816', fontWeight: 500 }}>
            Saved Payment Methods
          </h3>
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            style={{
              background: '#1B1816',
              color: '#FDFBF7',
              border: 'none',
              borderRadius: '999px',
              padding: '10px 16px',
              cursor: 'pointer',
              fontFamily: 'var(--font-sans)',
              fontSize: '10px',
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
            }}
          >
            + Add Payment Method
          </button>
        </div>

        {paymentMethods.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', background: '#F0EBE2', borderRadius: '10px' }}>
            <p style={{ margin: '0 0 16px', fontFamily: 'var(--font-sans)', fontSize: '14px', color: '#6E6962' }}>
              No saved payment methods.
            </p>
            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              style={{
                background: '#1B1816',
                color: '#FDFBF7',
                border: 'none',
                borderRadius: '999px',
                padding: '12px 20px',
                cursor: 'pointer',
                fontFamily: 'var(--font-sans)',
                fontSize: '10px',
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
              }}
            >
              Add Payment Method
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {paymentMethods.map((method) => (
              <div
                key={method.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '16px',
                  padding: '18px 20px',
                  background: '#FDFBF7',
                  border: '1px solid rgba(27,24,22,0.10)',
                  borderRadius: '10px',
                  opacity: removingId === method.id ? 0 : 1,
                  transform: removingId === method.id ? 'translateX(8px)' : 'translateX(0)',
                  transition: 'opacity 240ms ease, transform 240ms ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <CardIcon network={method.network} />
                  <div>
                    <div style={{ fontFamily: 'var(--font-sans)', fontSize: '14px', fontWeight: 600, color: '#1B1816' }}>
                      {method.network} •••• {method.lastFour}
                    </div>
                    <div style={{ fontFamily: 'var(--font-sans)', fontSize: '12px', color: '#7A726C', marginTop: '2px' }}>
                      Expires {method.expiry}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {method.isDefault && (
                    <span style={{
                      fontFamily: 'var(--font-sans)',
                      fontSize: '9px',
                      letterSpacing: '0.12em',
                      textTransform: 'uppercase',
                      fontWeight: 700,
                      color: '#1B1816',
                      background: '#EFEAE4',
                      padding: '4px 8px',
                      borderRadius: '999px',
                    }}>
                      DEFAULT
                    </span>
                  )}

                  {!method.isDefault && (
                    <button
                      type="button"
                      onClick={() => handleSetDefault(method.id)}
                      disabled={settingDefaultId === method.id}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        fontFamily: 'var(--font-sans)',
                        fontSize: '10px',
                        letterSpacing: '0.12em',
                        textTransform: 'uppercase',
                        color: '#6E6962',
                        opacity: settingDefaultId === method.id ? 0.5 : 1,
                      }}
                    >
                      Set as Default
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => handleRemove(method.id)}
                    disabled={removingId === method.id}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      fontFamily: 'var(--font-sans)',
                      fontSize: '10px',
                      letterSpacing: '0.12em',
                      textTransform: 'uppercase',
                      color: '#6E6962',
                      opacity: removingId === method.id ? 0.5 : 1,
                    }}
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Billing History */}
      <section style={{ background: '#F7F2EA', border: '1px solid rgba(27,24,22,0.12)', borderRadius: '14px', padding: '26px 22px 22px' }}>
        <h3 style={{ margin: '0 0 20px', fontFamily: 'var(--font-serif)', fontSize: '24px', color: '#1B1816', fontWeight: 500 }}>
          Billing History
        </h3>

        {mockBillingHistory.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', background: '#F0EBE2', borderRadius: '10px' }}>
            <p style={{ margin: 0, fontFamily: 'var(--font-sans)', fontSize: '14px', color: '#6E6962' }}>
              No billing history yet.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1.5fr auto', gap: '12px', padding: '12px 16px', background: '#EFEAE4', fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 600, color: '#6E6962' }}>
              <span>Order ID</span>
              <span>Date</span>
              <span>Amount</span>
              <span>Payment Method</span>
              <span>Invoice</span>
            </div>

            {mockBillingHistory.map((invoice) => (
              <div
                key={invoice.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '2fr 1fr 1fr 1.5fr auto',
                  gap: '12px',
                  padding: '16px',
                  background: '#FDFBF7',
                  borderBottom: '1px solid rgba(27,24,22,0.08)',
                  fontFamily: 'var(--font-sans)',
                  fontSize: '13px',
                  color: '#1B1816',
                }}
              >
                <span style={{ fontWeight: 600 }}>{invoice.id}</span>
                <span style={{ color: '#6E6962' }}>{new Date(invoice.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                <span style={{ fontWeight: 600 }}>{formatMoney(invoice.amount)}</span>
                <span style={{ color: '#6E6962' }}>{invoice.paymentMethod}</span>
                <button
                  type="button"
                  style={{
                    background: 'none',
                    border: '1px solid rgba(27,24,22,0.2)',
                    borderRadius: '999px',
                    padding: '6px 12px',
                    cursor: 'pointer',
                    fontFamily: 'var(--font-sans)',
                    fontSize: '9px',
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    color: '#1B1816',
                  }}
                >
                  Download PDF
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Add Payment Modal */}
      {showAddModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Add payment method"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowAddModal(false); }}
        >
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(27,24,22,0.45)', backdropFilter: 'blur(3px)' }} />
          <div
            style={{
              position: 'relative',
              zIndex: 1,
              background: '#FDFBF7',
              width: '100%',
              maxWidth: '420px',
              padding: '32px',
              boxShadow: '0 24px 64px rgba(0,0,0,0.18)',
            }}
          >
            <button
              type="button"
              onClick={() => setShowAddModal(false)}
              aria-label="Close"
              style={{ position: 'absolute', top: '16px', right: '16px', background: 'none', border: 'none', cursor: 'pointer', color: '#6E6962', fontSize: '24px', lineHeight: 1 }}
            >
              ×
            </button>

            <h3 style={{ margin: '0 0 6px', fontFamily: 'var(--font-serif)', fontSize: '22px', color: '#1B1816' }}>
              Add Payment Method
            </h3>
            <p style={{ margin: '0 0 24px', fontFamily: 'var(--font-sans)', fontSize: '13px', color: '#6E6962' }}>
              Enter your card details below.
            </p>

            <form onSubmit={handleAddPayment} style={{ display: 'grid', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', fontWeight: 600, color: '#7A726C' }}>
                  Card Network
                </label>
                <select
                  name="network"
                  required
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid rgba(27,24,22,0.12)',
                    borderRadius: '8px',
                    fontFamily: 'var(--font-sans)',
                    fontSize: '14px',
                    color: '#1B1816',
                    background: '#F6F0E9',
                  }}
                >
                  <option value="">Select network</option>
                  <option value="Visa">Visa</option>
                  <option value="Mastercard">Mastercard</option>
                  <option value="Amex">American Express</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', fontWeight: 600, color: '#7A726C' }}>
                  Card Number
                </label>
                <input
                  type="text"
                  name="number"
                  required
                  placeholder="•••• •••• •••• ••••"
                  maxLength={19}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid rgba(27,24,22,0.12)',
                    borderRadius: '8px',
                    fontFamily: 'var(--font-sans)',
                    fontSize: '14px',
                    color: '#1B1816',
                    background: '#F6F0E9',
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', fontWeight: 600, color: '#7A726C' }}>
                    Expiry Date
                  </label>
                  <input
                    type="text"
                    name="expiry"
                    required
                    placeholder="MM/YY"
                    maxLength={5}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      border: '1px solid rgba(27,24,22,0.12)',
                      borderRadius: '8px',
                      fontFamily: 'var(--font-sans)',
                      fontSize: '14px',
                      color: '#1B1816',
                      background: '#F6F0E9',
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', fontWeight: 600, color: '#7A726C' }}>
                    CVC
                  </label>
                  <input
                    type="text"
                    name="cvc"
                    required
                    placeholder="•••"
                    maxLength={3}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      border: '1px solid rgba(27,24,22,0.12)',
                      borderRadius: '8px',
                      fontFamily: 'var(--font-sans)',
                      fontSize: '14px',
                      color: '#1B1816',
                      background: '#F6F0E9',
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', fontWeight: 600, color: '#7A726C' }}>
                  Name on Card
                </label>
                <input
                  type="text"
                  name="name"
                  required
                  placeholder="Cardholder name"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid rgba(27,24,22,0.12)',
                    borderRadius: '8px',
                    fontFamily: 'var(--font-sans)',
                    fontSize: '14px',
                    color: '#1B1816',
                    background: '#F6F0E9',
                  }}
                />
              </div>

              <button
                type="submit"
                style={{
                  width: '100%',
                  minHeight: '44px',
                  background: '#1B1816',
                  color: '#FDFBF7',
                  border: 'none',
                  borderRadius: '999px',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-sans)',
                  fontSize: '11px',
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                  fontWeight: 600,
                }}
              >
                Add Payment Method
              </button>
            </form>
          </div>
        </div>
      )}
    </AccountLayout>
  );
}
