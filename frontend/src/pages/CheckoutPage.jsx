import { useMemo, useState } from 'react';
import { useCart } from '../context/CartContext';

const SHIPPING_OPTIONS = [
  { id: 'standard', label: 'Standard Delivery', note: '3–5 business days', price: 0 },
  { id: 'express', label: 'Express Delivery', note: '1–2 business days', price: 25 },
];

const PAYMENT_OPTIONS = ['CREDIT / DEBIT', 'APPLE PAY', 'GOOGLE PAY'];

function formatCurrency(value) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value || 0);
}

function formatCardNumber(value) {
  const cleaned = value.replace(/\D/g, '').slice(0, 16);
  return cleaned.replace(/(.{4})/g, '$1 ').trim();
}

function formatExpiry(value) {
  const cleaned = value.replace(/\D/g, '').slice(0, 4);
  if (cleaned.length <= 2) return cleaned;
  return `${cleaned.slice(0, 2)} / ${cleaned.slice(2)}`;
}

function formatCvc(value) {
  return value.replace(/\D/g, '').slice(0, 4);
}

function getCardBrand(number) {
  const digits = (number || '').replace(/\s/g, '');
  if (/^4/.test(digits)) return 'Visa';
  if (/^(5[1-5]|2[2-7])/.test(digits)) return 'Mastercard';
  if (/^3[47]/.test(digits)) return 'Amex';
  return 'Card';
}

export default function CheckoutPage({ go }) {
  const {
    items,
    subtotal,
    promoDiscount,
    appliedPromo,
    openCart,
    closeCart,
    clearCart,
    placeOrder,
  } = useCart();

  const [currentStep, setCurrentStep] = useState('checkout');
  const [shippingMethod, setShippingMethod] = useState('standard');
  const [paymentMethod, setPaymentMethod] = useState('CREDIT / DEBIT');
  const [billingSameAsShipping, setBillingSameAsShipping] = useState(true);
  const [cardNumber, setCardNumber] = useState('4111 8290 1204 8832');
  const [expiry, setExpiry] = useState('09 / 29');
  const [cvc, setCvc] = useState('•••');
  const [cardName, setCardName] = useState('ALEX MORGAN');
  const [email, setEmail] = useState('alex@example.com');
  const [firstName, setFirstName] = useState('Alex');
  const [lastName, setLastName] = useState('Morgan');
  const [country, setCountry] = useState('United States');
  const [street, setStreet] = useState('125 Mercer Street');
  const [apartment, setApartment] = useState('Apt 4B');
  const [city, setCity] = useState('New York');
  const [state, setState] = useState('NY');
  const [zip, setZip] = useState('10013');
  const [phone, setPhone] = useState('+1 (212) 555-0148');
  const [errors, setErrors] = useState({});

  const shipping = useMemo(
    () => SHIPPING_OPTIONS.find((option) => option.id === shippingMethod)?.price || 0,
    [shippingMethod]
  );

  const total = subtotal + shipping - promoDiscount;

  const cardBrand = getCardBrand(cardNumber);

  const validate = () => {
    const nextErrors = {};
    if (!email.trim() || !email.includes('@')) nextErrors.email = 'Valid email is required';
    if (!firstName.trim()) nextErrors.firstName = 'First name is required';
    if (!lastName.trim()) nextErrors.lastName = 'Last name is required';
    if (!street.trim()) nextErrors.street = 'Street address is required';
    if (!city.trim()) nextErrors.city = 'City is required';
    if (!country.trim()) nextErrors.country = 'Country is required';
    if (!phone.trim()) nextErrors.phone = 'Phone number is required';

    if (paymentMethod === 'CREDIT / DEBIT') {
      const digits = cardNumber.replace(/\D/g, '');
      if (digits.length < 15 || digits.length > 16) nextErrors.cardNumber = 'Enter a valid card number';
      const expiryDigits = expiry.replace(/\D/g, '');
      if (expiryDigits.length !== 4) nextErrors.expiry = 'Enter a valid expiry date';
      if (cvc.replace(/\D/g, '').length < 3) nextErrors.cvc = 'Security code is required';
      if (!cardName.trim()) nextErrors.cardName = 'Name on card is required';
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!validate()) return;

    const orderId = `NS-${String(Math.floor(10000 + Math.random() * 90000))}`;
    const orderPayload = {
      id: orderId,
      orderId,
      createdAt: new Date().toISOString(),
      status: 'placed',
      items: items.map((item) => ({ ...item })),
      subtotal,
      shippingMethod: SHIPPING_OPTIONS.find((option) => option.id === shippingMethod)?.label || 'Standard Delivery',
      shippingPrice: shipping,
      shippingLabel: shipping === 0 ? 'Complimentary' : formatCurrency(shipping),
      promoDiscount,
      appliedPromo,
      total,
      email,
      firstName,
      lastName,
      fullName: `${firstName} ${lastName}`,
      country,
      address: street,
      address2: apartment,
      city,
      state,
      postalCode: zip,
      phone,
      paymentMethod: paymentMethod === 'CREDIT / DEBIT' ? `${cardBrand} ending in •••• ${cardNumber.replace(/\D/g, '').slice(-4)}` : paymentMethod,
      cardLast4: cardNumber.replace(/\D/g, '').slice(-4),
      deliveryWindow: {
        start: new Date(Date.now() + 12 * 24 * 60 * 60 * 1000),
        end: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      },
    };

    placeOrder(orderPayload);
    clearCart();
    setCurrentStep('confirmation');
    go('/checkout/confirmation');
  };

  if (items.length === 0 && currentStep !== 'confirmation') {
    return (
      <div style={{ minHeight: '100vh', background: '#F9F5F0', padding: '40px 24px' }}>
        <div style={{ maxWidth: '520px', margin: '0 auto', textAlign: 'center' }}>
          <div style={{ marginBottom: '18px', fontFamily: 'var(--font-sans)', fontSize: '11px', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#7A726C' }}>Checkout</div>
          <h1 style={{ margin: '0 0 14px', fontFamily: 'var(--font-serif)', fontSize: '44px', fontStyle: 'italic', color: '#1B1816' }}>Your bag is empty</h1>
          <p style={{ margin: '0 0 26px', fontFamily: 'var(--font-sans)', fontSize: '14px', lineHeight: 1.7, color: '#665F5B' }}>Add a piece from the collection to continue to checkout.</p>
          <button
            type="button"
            onClick={() => go('/shop')}
            style={{ border: 'none', background: '#1B1816', color: '#FDFBF7', padding: '14px 22px', borderRadius: '999px', fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase', cursor: 'pointer' }}
          >
            Continue Shopping
          </button>
        </div>
      </div>
    );
  }

  if (currentStep === 'confirmation') {
    return (
      <div style={{ minHeight: '100vh', background: '#F9F5F0', padding: '28px 24px 60px' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '18px', borderBottom: '1px solid rgba(27,24,22,0.1)', paddingBottom: '18px', marginBottom: '36px', flexWrap: 'wrap' }}>
            <button onClick={() => go('/')} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'var(--font-serif)', fontSize: '22px', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#1B1816' }}>NOVASHOP</button>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontFamily: 'var(--font-sans)', fontSize: '11px', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#7A726C', whiteSpace: 'nowrap', overflowX: 'auto' }}>
              <span>1. BAG</span>
              <span>→</span>
              <span>2. CHECKOUT</span>
              <span>→</span>
              <span style={{ fontWeight: 700, color: '#1B1816', borderBottom: '1px solid #1B1816', paddingBottom: '2px' }}>3. CONFIRMATION</span>
            </div>
          </header>

          <div style={{ maxWidth: '780px', margin: '0 auto', background: '#F8F4EE', border: '1px solid rgba(27,24,22,0.08)', borderRadius: '24px', padding: '32px 28px', textAlign: 'center' }}>
            <div style={{ marginBottom: '18px', fontFamily: 'var(--font-sans)', fontSize: '11px', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#227B51' }}>Order confirmed</div>
            <h2 style={{ margin: 0, fontFamily: 'var(--font-serif)', fontSize: 'clamp(34px, 4vw, 54px)', fontStyle: 'italic', color: '#1B1816', lineHeight: 1.06 }}>Thank you for your order.</h2>
            <p style={{ margin: '16px auto 0', maxWidth: '420px', fontFamily: 'var(--font-sans)', fontSize: '14px', lineHeight: 1.7, color: '#655E5A' }}>Your purchase is now being prepared with care. You’ll receive a confirmation email shortly.</p>
            <div style={{ marginTop: '28px', display: 'inline-flex', alignItems: 'center', gap: '12px', padding: '10px 16px', borderRadius: '999px', background: '#F1E9E0', color: '#1B1816', fontFamily: 'var(--font-sans)', fontSize: '12px', letterSpacing: '0.12em', textTransform: 'uppercase' }}>Order # NOVA-10284</div>
            <div style={{ marginTop: '28px', display: 'flex', justifyContent: 'center', gap: '18px', flexWrap: 'wrap' }}>
              <button onClick={() => go('/')} style={{ border: 'none', background: '#1B1816', color: '#FDFBF7', padding: '14px 20px', borderRadius: '999px', fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase', cursor: 'pointer' }}>Continue Shopping</button>
              <button onClick={() => openCart()} style={{ border: '1px solid rgba(27,24,22,0.14)', background: 'transparent', color: '#1B1816', padding: '14px 20px', borderRadius: '999px', fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase', cursor: 'pointer' }}>View Bag</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F9F5F0', padding: '28px 24px 40px' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <header style={{ borderBottom: '1px solid rgba(27,24,22,0.08)', paddingBottom: '18px', marginBottom: '28px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '18px', flexWrap: 'wrap' }}>
            <button onClick={() => go('/')} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'var(--font-serif)', fontSize: '22px', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#1B1816' }}>NOVASHOP</button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', fontFamily: 'var(--font-sans)', fontSize: '11px', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#7A726C', overflowX: 'auto' }}>
              <button onClick={() => openCart()} style={{ background: 'none', border: 'none', padding: 0, color: '#7A726C', cursor: 'pointer', textDecoration: 'underline' }}>1. BAG</button>
              <span>→</span>
              <span style={{ fontWeight: 700, color: '#1B1816', borderBottom: '1px solid #1B1816', paddingBottom: '2px' }}>2. CHECKOUT</span>
              <span>→</span>
              <span>3. CONFIRMATION</span>
            </div>
          </div>

          <div style={{ marginTop: '18px' }}>
            <button onClick={() => openCart()} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: '#1B1816', fontFamily: 'var(--font-sans)', fontSize: '11px', letterSpacing: '0.14em', textTransform: 'uppercase' }}>← Return to Shopping Bag</button>
          </div>
        </header>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '18px', marginBottom: '32px', gap: '16px', flexWrap: 'wrap' }}>
          <h1 style={{ margin: 0, fontFamily: 'var(--font-serif)', fontSize: 'clamp(36px, 4vw, 56px)', fontStyle: 'italic', fontWeight: 400, color: '#1B1816', letterSpacing: '-0.04em' }}>Checkout</h1>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.45fr) minmax(300px, 420px)', gap: '28px', alignItems: 'start' }}>
          <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '22px' }} noValidate>
            <section style={{ background: '#F8F4EE', border: '1px solid rgba(27,24,22,0.08)', borderRadius: '18px', padding: '22px 22px 18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ width: '26px', height: '26px', borderRadius: '50%', background: '#1B1816', color: '#FDFBF7', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-sans)', fontSize: '11px', fontWeight: 700 }}>01</span>
                  <h3 style={{ margin: 0, fontFamily: 'var(--font-sans)', fontSize: '11px', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#1B1816' }}>Contact Information</h3>
                </div>
                <button type="button" style={{ background: 'none', border: 'none', color: '#1B1816', fontFamily: 'var(--font-sans)', fontSize: '11px', letterSpacing: '0.12em', textTransform: 'uppercase', cursor: 'pointer', padding: 0 }}>Sign In</button>
              </div>

              <div style={{ display: 'grid', gap: '16px' }}>
                <label style={{ display: 'grid', gap: '8px' }}>
                  <span style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#7A726C' }}>Email Address</span>
                  <input value={email} onChange={(e) => setEmail(e.target.value)} style={{ width: '100%', border: `1px solid ${errors.email ? '#A14A3F' : 'rgba(27,24,22,0.14)'}`, borderRadius: '10px', background: '#FDFBF7', padding: '13px 14px', fontFamily: 'var(--font-sans)', color: '#1B1816', fontSize: '14px', outline: 'none', boxShadow: '0 0 0 0 transparent', transition: 'border-color 0.15s ease', focus: 'border-color:#1B1816' }} />
                  {errors.email && <span style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', color: '#A14A3F' }}>{errors.email}</span>}
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontFamily: 'var(--font-sans)', fontSize: '13px', color: '#1B1816' }}>
                  <input type="checkbox" defaultChecked style={{ accentColor: '#1B1816', width: '16px', height: '16px' }} />
                  <span>Send me NovaShop updates</span>
                </label>
              </div>
            </section>

            <section style={{ background: '#F8F4EE', border: '1px solid rgba(27,24,22,0.08)', borderRadius: '18px', padding: '22px 22px 18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '18px' }}>
                <span style={{ width: '26px', height: '26px', borderRadius: '50%', background: '#1B1816', color: '#FDFBF7', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-sans)', fontSize: '11px', fontWeight: 700 }}>02</span>
                <h3 style={{ margin: 0, fontFamily: 'var(--font-sans)', fontSize: '11px', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#1B1816' }}>Delivery Address</h3>
              </div>

              <div style={{ display: 'grid', gap: '16px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '16px' }}>
                  <label style={{ display: 'grid', gap: '8px' }}>
                    <span style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#7A726C' }}>First Name</span>
                    <input value={firstName} onChange={(e) => setFirstName(e.target.value)} style={{ width: '100%', border: `1px solid ${errors.firstName ? '#A14A3F' : 'rgba(27,24,22,0.14)'}`, borderRadius: '10px', background: '#FDFBF7', padding: '13px 14px', fontFamily: 'var(--font-sans)', color: '#1B1816', fontSize: '14px', outline: 'none' }} />
                  </label>
                  <label style={{ display: 'grid', gap: '8px' }}>
                    <span style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#7A726C' }}>Last Name</span>
                    <input value={lastName} onChange={(e) => setLastName(e.target.value)} style={{ width: '100%', border: `1px solid ${errors.lastName ? '#A14A3F' : 'rgba(27,24,22,0.14)'}`, borderRadius: '10px', background: '#FDFBF7', padding: '13px 14px', fontFamily: 'var(--font-sans)', color: '#1B1816', fontSize: '14px', outline: 'none' }} />
                  </label>
                </div>

                <label style={{ display: 'grid', gap: '8px' }}>
                  <span style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#7A726C' }}>Country / Region</span>
                  <select value={country} onChange={(e) => setCountry(e.target.value)} style={{ width: '100%', border: `1px solid ${errors.country ? '#A14A3F' : 'rgba(27,24,22,0.14)'}`, borderRadius: '10px', background: '#FDFBF7', padding: '13px 14px', fontFamily: 'var(--font-sans)', color: '#1B1816', fontSize: '14px', outline: 'none' }}>
                    <option>United States</option>
                    <option>United Kingdom</option>
                    <option>France</option>
                    <option>Italy</option>
                    <option>Germany</option>
                  </select>
                </label>

                <label style={{ display: 'grid', gap: '8px' }}>
                  <span style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#7A726C' }}>Street Address</span>
                  <input value={street} onChange={(e) => setStreet(e.target.value)} style={{ width: '100%', border: `1px solid ${errors.street ? '#A14A3F' : 'rgba(27,24,22,0.14)'}`, borderRadius: '10px', background: '#FDFBF7', padding: '13px 14px', fontFamily: 'var(--font-sans)', color: '#1B1816', fontSize: '14px', outline: 'none' }} />
                </label>

                <label style={{ display: 'grid', gap: '8px' }}>
                  <span style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#7A726C' }}>Apartment, Suite, Unit (optional)</span>
                  <input value={apartment} onChange={(e) => setApartment(e.target.value)} style={{ width: '100%', border: '1px solid rgba(27,24,22,0.14)', borderRadius: '10px', background: '#FDFBF7', padding: '13px 14px', fontFamily: 'var(--font-sans)', color: '#1B1816', fontSize: '14px', outline: 'none' }} />
                </label>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '16px' }}>
                  <label style={{ display: 'grid', gap: '8px' }}>
                    <span style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#7A726C' }}>City</span>
                    <input value={city} onChange={(e) => setCity(e.target.value)} style={{ width: '100%', border: `1px solid ${errors.city ? '#A14A3F' : 'rgba(27,24,22,0.14)'}`, borderRadius: '10px', background: '#FDFBF7', padding: '13px 14px', fontFamily: 'var(--font-sans)', color: '#1B1816', fontSize: '14px', outline: 'none' }} />
                  </label>
                  <label style={{ display: 'grid', gap: '8px' }}>
                    <span style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#7A726C' }}>Region / State</span>
                    <input value={state} onChange={(e) => setState(e.target.value)} style={{ width: '100%', border: '1px solid rgba(27,24,22,0.14)', borderRadius: '10px', background: '#FDFBF7', padding: '13px 14px', fontFamily: 'var(--font-sans)', color: '#1B1816', fontSize: '14px', outline: 'none' }} />
                  </label>
                  <label style={{ display: 'grid', gap: '8px' }}>
                    <span style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#7A726C' }}>Postal / Zip</span>
                    <input value={zip} onChange={(e) => setZip(e.target.value)} style={{ width: '100%', border: '1px solid rgba(27,24,22,0.14)', borderRadius: '10px', background: '#FDFBF7', padding: '13px 14px', fontFamily: 'var(--font-sans)', color: '#1B1816', fontSize: '14px', outline: 'none' }} />
                  </label>
                </div>

                <label style={{ display: 'grid', gap: '8px' }}>
                  <span style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#7A726C' }}>Phone Number</span>
                  <input value={phone} onChange={(e) => setPhone(e.target.value)} style={{ width: '100%', border: `1px solid ${errors.phone ? '#A14A3F' : 'rgba(27,24,22,0.14)'}`, borderRadius: '10px', background: '#FDFBF7', padding: '13px 14px', fontFamily: 'var(--font-sans)', color: '#1B1816', fontSize: '14px', outline: 'none' }} />
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontFamily: 'var(--font-sans)', fontSize: '13px', color: '#1B1816' }}>
                  <input type="checkbox" defaultChecked style={{ accentColor: '#1B1816', width: '16px', height: '16px' }} />
                  <span>Save this address to my account</span>
                </label>
              </div>
            </section>

            <section style={{ background: '#F8F4EE', border: '1px solid rgba(27,24,22,0.08)', borderRadius: '18px', padding: '22px 22px 18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '18px' }}>
                <span style={{ width: '26px', height: '26px', borderRadius: '50%', background: '#1B1816', color: '#FDFBF7', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-sans)', fontSize: '11px', fontWeight: 700 }}>03</span>
                <h3 style={{ margin: 0, fontFamily: 'var(--font-sans)', fontSize: '11px', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#1B1816' }}>Shipping Method</h3>
              </div>

              <div style={{ display: 'grid', gap: '12px' }}>
                {SHIPPING_OPTIONS.map((option) => {
                  const active = shippingMethod === option.id;
                  return (
                    <label key={option.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', background: active ? '#F3EEE8' : 'transparent', border: `1px solid ${active ? '#1B1816' : 'rgba(27,24,22,0.14)'}`, borderRadius: '12px', padding: '14px 16px', cursor: 'pointer' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <input type="radio" checked={active} onChange={() => setShippingMethod(option.id)} style={{ accentColor: '#1B1816', width: '16px', height: '16px' }} />
                        <div>
                          <div style={{ fontFamily: 'var(--font-sans)', fontSize: '14px', color: '#1B1816', fontWeight: 600 }}>{option.label}</div>
                          <div style={{ fontFamily: 'var(--font-sans)', fontSize: '12px', color: '#7A726C', marginTop: '2px' }}>{option.note}</div>
                        </div>
                      </div>
                      <div style={{ fontFamily: 'var(--font-sans)', fontSize: '13px', fontWeight: 700, color: '#1B1816' }}>{option.price === 0 ? 'FREE' : formatCurrency(option.price)}</div>
                    </label>
                  );
                })}
              </div>
            </section>

            <section style={{ background: '#F8F4EE', border: '1px solid rgba(27,24,22,0.08)', borderRadius: '18px', padding: '22px 22px 18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '18px' }}>
                <span style={{ width: '26px', height: '26px', borderRadius: '50%', background: '#1B1816', color: '#FDFBF7', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-sans)', fontSize: '11px', fontWeight: 700 }}>04</span>
                <h3 style={{ margin: 0, fontFamily: 'var(--font-sans)', fontSize: '11px', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#1B1816' }}>Payment</h3>
              </div>

              <div style={{ display: 'flex', gap: '8px', background: '#F0EAE5', borderRadius: '999px', padding: '6px', marginBottom: '18px' }}>
                {PAYMENT_OPTIONS.map((option) => {
                  const active = paymentMethod === option;
                  return (
                    <button key={option} type="button" onClick={() => setPaymentMethod(option)} style={{ flex: 1, borderRadius: '999px', border: active ? '1px solid rgba(27,24,22,0.14)' : '1px solid transparent', background: active ? '#FDFBF7' : 'transparent', color: '#1B1816', fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', padding: '11px 12px', cursor: 'pointer' }}>{option}</button>
                  );
                })}
              </div>

              {paymentMethod === 'CREDIT / DEBIT' ? (
                <div style={{ display: 'grid', gap: '16px' }}>
                  <label style={{ display: 'grid', gap: '8px' }}>
                    <span style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#7A726C' }}>Card Number</span>
                    <div style={{ position: 'relative' }}>
                      <input value={cardNumber} onChange={(e) => setCardNumber(formatCardNumber(e.target.value))} style={{ width: '100%', border: `1px solid ${errors.cardNumber ? '#A14A3F' : 'rgba(27,24,22,0.14)'}`, borderRadius: '10px', background: '#FDFBF7', padding: '13px 42px 13px 14px', fontFamily: 'var(--font-sans)', color: '#1B1816', fontSize: '14px', outline: 'none' }} />
                      <span style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', fontFamily: 'var(--font-sans)', fontSize: '11px', color: '#1B1816', fontWeight: 700 }}>{cardBrand}</span>
                    </div>
                  </label>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <label style={{ display: 'grid', gap: '8px' }}>
                      <span style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#7A726C' }}>Expiration Date</span>
                      <input value={expiry} onChange={(e) => setExpiry(formatExpiry(e.target.value))} style={{ width: '100%', border: `1px solid ${errors.expiry ? '#A14A3F' : 'rgba(27,24,22,0.14)'}`, borderRadius: '10px', background: '#FDFBF7', padding: '13px 14px', fontFamily: 'var(--font-sans)', color: '#1B1816', fontSize: '14px', outline: 'none' }} />
                    </label>
                    <label style={{ display: 'grid', gap: '8px' }}>
                      <span style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#7A726C' }}>Security Code</span>
                      <input value={cvc} onChange={(e) => setCvc(formatCvc(e.target.value))} style={{ width: '100%', border: `1px solid ${errors.cvc ? '#A14A3F' : 'rgba(27,24,22,0.14)'}`, borderRadius: '10px', background: '#FDFBF7', padding: '13px 14px', fontFamily: 'var(--font-sans)', color: '#1B1816', fontSize: '14px', outline: 'none' }} />
                    </label>
                  </div>

                  <label style={{ display: 'grid', gap: '8px' }}>
                    <span style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#7A726C' }}>Name on Card</span>
                    <input value={cardName} onChange={(e) => setCardName(e.target.value.toUpperCase())} style={{ width: '100%', border: `1px solid ${errors.cardName ? '#A14A3F' : 'rgba(27,24,22,0.14)'}`, borderRadius: '10px', background: '#FDFBF7', padding: '13px 14px', fontFamily: 'var(--font-sans)', color: '#1B1816', fontSize: '14px', outline: 'none' }} />
                  </label>

                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontFamily: 'var(--font-sans)', fontSize: '13px', color: '#1B1816' }}>
                    <input type="checkbox" checked={billingSameAsShipping} onChange={() => setBillingSameAsShipping((prev) => !prev)} style={{ accentColor: '#1B1816', width: '16px', height: '16px' }} />
                    <span>Billing address is the same as shipping address</span>
                  </label>

                  {!billingSameAsShipping && (
                    <div style={{ display: 'grid', gap: '16px', paddingTop: '6px' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '16px' }}>
                        <label style={{ display: 'grid', gap: '8px' }}>
                          <span style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#7A726C' }}>First Name</span>
                          <input defaultValue="Alex" style={{ width: '100%', border: '1px solid rgba(27,24,22,0.14)', borderRadius: '10px', background: '#FDFBF7', padding: '13px 14px', fontFamily: 'var(--font-sans)', color: '#1B1816', fontSize: '14px', outline: 'none' }} />
                        </label>
                        <label style={{ display: 'grid', gap: '8px' }}>
                          <span style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#7A726C' }}>Last Name</span>
                          <input defaultValue="Morgan" style={{ width: '100%', border: '1px solid rgba(27,24,22,0.14)', borderRadius: '10px', background: '#FDFBF7', padding: '13px 14px', fontFamily: 'var(--font-sans)', color: '#1B1816', fontSize: '14px', outline: 'none' }} />
                        </label>
                      </div>
                      <label style={{ display: 'grid', gap: '8px' }}>
                        <span style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#7A726C' }}>Street Address</span>
                        <input defaultValue="125 Mercer Street" style={{ width: '100%', border: '1px solid rgba(27,24,22,0.14)', borderRadius: '10px', background: '#FDFBF7', padding: '13px 14px', fontFamily: 'var(--font-sans)', color: '#1B1816', fontSize: '14px', outline: 'none' }} />
                      </label>
                    </div>
                  )}

                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontFamily: 'var(--font-sans)', fontSize: '12px', color: '#5B5552' }}>
                    <span style={{ display: 'inline-flex', width: '16px', height: '16px', borderRadius: '50%', alignItems: 'center', justifyContent: 'center', background: '#E5DDD6', color: '#1B1816', fontSize: '11px', fontWeight: 700 }}>🔒</span>
                    <span>Secure payment · Your payment information is encrypted</span>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  <button type="button" style={{ width: '100%', maxWidth: '260px', background: '#1B1816', color: '#FDFBF7', border: 'none', borderRadius: '999px', padding: '14px 18px', fontFamily: 'var(--font-sans)', fontSize: '11px', letterSpacing: '0.14em', textTransform: 'uppercase', cursor: 'pointer' }}>{paymentMethod === 'APPLE PAY' ? 'Pay' : 'G Pay'}</button>
                </div>
              )}
            </section>

            <footer style={{ borderTop: '1px solid rgba(27,24,22,0.08)', paddingTop: '16px', display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: '12px', fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#7A726C' }}>
              <span>US (USD $)</span>
              <span>© 2026 NovaShop. All rights reserved.</span>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', flexWrap: 'wrap' }}>
                <span>Privacy Policy</span>
                <span>·</span>
                <span>Terms of Service</span>
                <span>·</span>
                <span>Contact</span>
              </div>
            </footer>
          </form>

          <aside style={{ position: 'sticky', top: '20px', background: '#F8F4EE', border: '1px solid rgba(27,24,22,0.08)', borderRadius: '18px', padding: '22px 18px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '18px' }}>
              <h2 style={{ margin: 0, fontFamily: 'var(--font-serif)', fontSize: '28px', fontStyle: 'italic', color: '#1B1816', letterSpacing: '-0.04em' }}>Order Summary</h2>
              <span style={{ background: '#1B1816', color: '#FDFBF7', borderRadius: '999px', padding: '5px 10px', fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase' }}>{items.length} Items</span>
            </div>

            <div style={{ display: 'grid', gap: '16px' }}>
              {items.map((item) => (
                <div key={item.id} style={{ display: 'grid', gridTemplateColumns: '60px 1fr auto', gap: '10px', paddingBottom: '14px', borderBottom: '1px solid rgba(27,24,22,0.08)' }}>
                  <div style={{ position: 'relative', width: '60px', height: '60px', borderRadius: '10px', overflow: 'hidden', background: '#EFEAE4' }}>
                    <img src={item.image} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <span style={{ position: 'absolute', left: '6px', bottom: '6px', background: 'rgba(27,24,22,0.8)', color: '#FDFBF7', borderRadius: '999px', padding: '3px 6px', fontFamily: 'var(--font-sans)', fontSize: '8px', letterSpacing: '0.08em', textTransform: 'uppercase' }}>QTY {item.qty}</span>
                  </div>
                  <div>
                    <div style={{ fontFamily: 'var(--font-sans)', fontSize: '14px', fontWeight: 700, color: '#1B1816', lineHeight: 1.35 }}>{item.name}</div>
                    <div style={{ fontFamily: 'var(--font-sans)', fontSize: '12px', color: '#7A726C', marginTop: '4px' }}>{item.color} · Size {item.size}</div>
                  </div>
                  <div style={{ fontFamily: 'var(--font-sans)', fontSize: '14px', fontWeight: 700, color: '#1B1816', whiteSpace: 'nowrap' }}>{formatCurrency(item.price * item.qty)}</div>
                </div>
              ))}
            </div>

            {appliedPromo && (
              <div style={{ marginTop: '18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', padding: '10px 12px', background: '#EEF5EF', borderRadius: '10px', fontFamily: 'var(--font-sans)', fontSize: '12px', color: '#1B1816' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ color: '#227B51' }}>✓</span>
                  <span>{appliedPromo} (-{formatCurrency(promoDiscount)})</span>
                </div>
                <button type="button" onClick={() => {}} style={{ background: 'none', border: 'none', color: '#1B1816', cursor: 'pointer', fontSize: '14px' }}>✕</button>
              </div>
            )}

            <div style={{ marginTop: '18px', display: 'grid', gap: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontFamily: 'var(--font-sans)', fontSize: '14px', color: '#1B1816' }}>
                <span>Subtotal</span>
                <strong>{formatCurrency(subtotal)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontFamily: 'var(--font-sans)', fontSize: '14px', color: '#1B1816' }}>
                <span>Shipping</span>
                <strong style={{ color: shipping === 0 ? '#227B51' : '#1B1816' }}>{shipping === 0 ? 'FREE' : formatCurrency(shipping)}</strong>
              </div>
              {appliedPromo && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontFamily: 'var(--font-sans)', fontSize: '14px', color: '#1B1816' }}>
                  <span>Promo Discount</span>
                  <strong>-{formatCurrency(promoDiscount)}</strong>
                </div>
              )}
            </div>

            <div style={{ borderTop: '1px solid rgba(27,24,22,0.08)', margin: '18px 0 14px' }} />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '10px' }}>
              <span style={{ fontFamily: 'var(--font-sans)', fontSize: '14px', color: '#1B1816', fontWeight: 600 }}>Total</span>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                <span style={{ fontFamily: 'var(--font-sans)', fontSize: '32px', fontWeight: 700, color: '#1B1816', lineHeight: 1 }}>{formatCurrency(total)}</span>
                <span style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#7A726C' }}>USD</span>
              </div>
            </div>
            <div style={{ marginTop: '8px', fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#7A726C' }}>VAT & duties included</div>

            <button type="submit" onClick={handleSubmit} style={{ width: '100%', marginTop: '20px', border: 'none', background: '#1B1816', color: '#FDFBF7', borderRadius: '999px', padding: '16px 18px', fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase', cursor: 'pointer' }}>Place Order →</button>

            <p style={{ margin: '18px 0 0', textAlign: 'center', fontFamily: 'var(--font-sans)', fontSize: '11px', lineHeight: 1.7, color: '#716B66' }}>
              By placing your order, you agree to NovaShop's <a href="#" style={{ color: '#1B1816' }}>Terms of Service</a> and <a href="#" style={{ color: '#1B1816' }}>Privacy Policy</a>.
            </p>
          </aside>
        </div>
      </div>
    </div>
  );
}
