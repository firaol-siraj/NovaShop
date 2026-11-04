import { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { orderApi } from '../lib/api/orderApi';
import { addressApi } from '../lib/api/addressApi';
import { userApi } from '../lib/api/userApi';
import { shippingApi } from '../lib/api/shippingApi';
import settingsApi from '../lib/api/settingsApi';
import { getSessionId, trackBeginCheckout } from '../lib/tracker';

const SHIPPING_OPTIONS = [
  { id: 'standard', label: 'Standard Delivery', note: '3–5 business days', price: 0 },
  { id: 'express', label: 'Express Delivery', note: '1–2 business days', price: 25 },
];

const PAYMENT_METHODS = [
  {
    id: 'Chapa',
    title: 'Chapa Hosted Checkout',
    badge: 'Sandbox / Test Mode',
    description: 'Pay securely via Debit/Credit Cards, Telebirr, and Mobile Money powered by Chapa.',
    icon: '💳',
  },
  {
    id: 'Cash on Delivery',
    title: 'Cash on Delivery',
    badge: 'Pay Upon Arrival',
    description: 'Pay in cash directly to the courier upon delivery of your garments.',
    icon: '📦',
  },
];

function formatCurrency(value) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value || 0);
}

/**
 * Authoritatively normalizes user-entered phone number into standard Ethiopian E.164 (+251...).
 * Strips leading '#', handles domestic inputs (09..., 07...), and prevents invalid prefixes.
 */
function normalizeEthiopianPhone(input) {
  if (!input) return '';
  let cleaned = String(input).trim().replace(/[\s\-()]/g, '');
  if (cleaned.startsWith('#')) {
    cleaned = '+' + cleaned.slice(1);
  }
  if (/^\+21\d{8,9}$/.test(cleaned)) {
    cleaned = '+251' + cleaned.slice(3);
  } else if (/^21\d{8,9}$/.test(cleaned)) {
    cleaned = '+251' + cleaned.slice(2);
  } else if (/^0[79]\d{8}$/.test(cleaned)) {
    cleaned = '+251' + cleaned.slice(1);
  } else if (/^[79]\d{8}$/.test(cleaned)) {
    cleaned = '+251' + cleaned;
  } else if (/^251[79]\d{8}$/.test(cleaned)) {
    cleaned = '+' + cleaned;
  }
  return cleaned;
}

export default function CheckoutPage({ go }) {
  const { user, isAuthenticated } = useAuth();
  const {
    items,
    subtotal,
    promoDiscount,
    appliedPromo,
    applyPromoCode,
    removePromoCode,
    openCart,
    placeOrder,
    refreshCart,
  } = useCart();

  const [shippingOptions, setShippingOptions] = useState(SHIPPING_OPTIONS);
  const [shippingQuote, setShippingQuote] = useState(null);
  const [loadingShippingQuote, setLoadingShippingQuote] = useState(false);
  const [shippingMethod, setShippingMethod] = useState('standard');
  const [paymentMethod, setPaymentMethod] = useState('Chapa');

  // Saved addresses state for logged-in user
  const [savedAddresses, setSavedAddresses] = useState([]);
  const [selectedAddressId, setSelectedAddressId] = useState('new');
  const [loadingAddresses, setLoadingAddresses] = useState(false);

  // Contact & Shipping info fields (all fully editable)
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [country, setCountry] = useState('Ethiopia');
  const [street, setStreet] = useState('');
  const [apartment, setApartment] = useState('');
  const [city, setCity] = useState('Addis Ababa');
  const [state, setState] = useState('Addis Ababa');
  const [zip, setZip] = useState('1000');
  const [phone, setPhone] = useState('');

  // Checkboxes
  const [saveAddressToAccount, setSaveAddressToAccount] = useState(false);
  const [updateProfileInfo, setUpdateProfileInfo] = useState(false);

  const [errors, setErrors] = useState({});
  const [promoCodeInput, setPromoCodeInput] = useState('');
  const [promoError, setPromoError] = useState('');
  const [isApplyingPromo, setIsApplyingPromo] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [pendingOrder, setPendingOrder] = useState(null);

  // Total distinct & item count calculation
  const totalItemCount = useMemo(() => {
    return (items || []).reduce((sum, item) => sum + (Number(item.qty || item.quantity) || 1), 0);
  }, [items]);

  // Load user saved addresses and auto-prefill if authenticated
  const loadSavedAddresses = useCallback(async () => {
    if (!isAuthenticated || !user) return;
    setLoadingAddresses(true);
    try {
      const res = await addressApi.getAddresses();
      if (res.success && Array.isArray(res.data) && res.data.length > 0) {
        setSavedAddresses(res.data);
        const def = res.data.find((a) => a.isDefault) || res.data[0];
        if (def) {
          setSelectedAddressId(def._id);
          setStreet(def.street || '');
          setApartment(def.street2 || '');
          setCity(def.city || 'Addis Ababa');
          setState(def.state || def.city || 'Addis Ababa');
          setZip(def.postalCode || '1000');
          setCountry(def.country || 'Ethiopia');
          if (def.phone && !phone) {
            setPhone(def.phone);
          }
          if (def.firstName && !firstName) {
            setFirstName(def.firstName);
          }
          if (def.lastName && !lastName) {
            setLastName(def.lastName);
          }
        }
      }
    } catch (err) {
      console.warn('Unable to load saved addresses:', err);
    } finally {
      setLoadingAddresses(false);
    }
  }, [isAuthenticated, user, phone, firstName, lastName]);

  // Initial prefill from auth user
  useEffect(() => {
    if (isAuthenticated && user) {
      if (user.email && !email) setEmail(user.email);
      if (user.firstName && !firstName) setFirstName(user.firstName);
      else if (user.name && !firstName) {
        const parts = user.name.split(' ');
        setFirstName(parts[0] || '');
        if (!lastName) setLastName(parts.slice(1).join(' ') || '');
      }
      if (user.lastName && !lastName) setLastName(user.lastName);
      if (user.phone && !phone) setPhone(normalizeEthiopianPhone(user.phone));

      loadSavedAddresses();
    }
  }, [isAuthenticated, user, loadSavedAddresses, email, firstName, lastName, phone]);

  // When user selects a different saved address from dropdown/picker
  const handleSelectSavedAddress = (addressId) => {
    setSelectedAddressId(addressId);
    if (addressId === 'new') {
      setStreet('');
      setApartment('');
      setCity('Addis Ababa');
      setState('Addis Ababa');
      setZip('1000');
      setCountry('Ethiopia');
      return;
    }

    const found = savedAddresses.find((a) => a._id === addressId);
    if (found) {
      setStreet(found.street || '');
      setApartment(found.street2 || '');
      setCity(found.city || 'Addis Ababa');
      setState(found.state || found.city || 'Addis Ababa');
      setZip(found.postalCode || '1000');
      setCountry(found.country || 'Ethiopia');
      if (found.phone) setPhone(found.phone);
      if (found.firstName) setFirstName(found.firstName);
      if (found.lastName) setLastName(found.lastName);
    }
  };

  useEffect(() => {
    let isCancelled = false;
    const fetchShippingQuote = async () => {
      setLoadingShippingQuote(true);
      try {
        const quote = await shippingApi.getQuote({
          country: country.trim() || 'Ethiopia',
          region: state.trim() || city.trim() || 'Addis Ababa',
          cartTotalUSD: subtotal,
        });

        const rawOptions = Array.isArray(quote)
          ? quote
          : Array.isArray(quote?.options)
          ? quote.options
          : Array.isArray(quote?.data)
          ? quote.data
          : [];

        if (isCancelled || rawOptions.length === 0) return;
        setShippingQuote(quote);

        const dynamicOpts = rawOptions.map((opt) => ({
          id: opt.id || opt.code || String(opt.rateId || opt.methodId),
          label: opt.name || opt.label,
          note: `${opt.carrier ? `${opt.carrier} · ` : ''}${opt.estimatedDelivery || opt.deliveryWindow || ''}`,
          price: opt.priceUSD !== undefined ? opt.priceUSD : (opt.price || 0),
          priceETB: opt.priceETB,
          rateId: opt.rateId,
          methodId: opt.methodId || opt.id,
          carrier: opt.carrier,
        }));

        if (dynamicOpts.length > 0) {
          setShippingOptions(dynamicOpts);
          if (!dynamicOpts.some((o) => o.id === shippingMethod)) {
            setShippingMethod(dynamicOpts[0].id);
          }
        }
      } catch (err) {
        console.warn('Dynamic shipping quote unavailable, fallback to default:', err);
      } finally {
        if (!isCancelled) setLoadingShippingQuote(false);
      }
    };

    fetchShippingQuote();
    return () => {
      isCancelled = true;
    };
  }, [country, city, state, subtotal]);

  const shipping = useMemo(
    () => shippingOptions.find((option) => option.id === shippingMethod)?.price ?? (SHIPPING_OPTIONS.find((option) => option.id === shippingMethod)?.price || 0),
    [shippingOptions, shippingMethod]
  );

  const [storeSettings, setStoreSettings] = useState(null);

  useEffect(() => {
    let isMounted = true;
    settingsApi.getPublicSettings().then((res) => {
      const data = res.data?.data || res.data;
      if (isMounted && data) {
        setStoreSettings(data);
      }
    }).catch(() => {});
    return () => { isMounted = false; };
  }, []);

  const taxConfig = storeSettings?.tax || { collectTax: true, includeTax: false, chargeShipping: true, defaultRate: 15, taxName: 'VAT' };
  const freeShippingThreshold = storeSettings?.freeShippingThreshold ?? 300;
  const netSubtotal = Math.max(0, subtotal - promoDiscount);

  const taxCalculation = useMemo(() => {
    if (!taxConfig.collectTax) {
      return { taxPrice: 0, taxName: taxConfig.taxName || 'VAT', rate: 0, included: false };
    }
    const rate = Number(taxConfig.defaultRate) || 15;
    if (taxConfig.includeTax) {
      const taxAmount = Number((netSubtotal - netSubtotal / (1 + rate / 100)).toFixed(2));
      return { taxPrice: taxAmount, taxName: taxConfig.taxName || 'VAT', rate, included: true };
    } else {
      const taxItem = Number(((netSubtotal * rate) / 100).toFixed(2));
      const taxShip = taxConfig.chargeShipping ? Number(((shipping * rate) / 100).toFixed(2)) : 0;
      return { taxPrice: Number((taxItem + taxShip).toFixed(2)), taxName: taxConfig.taxName || 'VAT', rate, included: false };
    }
  }, [taxConfig, netSubtotal, shipping]);

  const total = useMemo(() => {
    if (taxCalculation.included) {
      return Math.max(0, netSubtotal + shipping);
    }
    return Math.max(0, netSubtotal + shipping + taxCalculation.taxPrice);
  }, [netSubtotal, shipping, taxCalculation]);

  const trackedCheckoutRef = useRef(false);
  useEffect(() => {
    if (!trackedCheckoutRef.current && totalItemCount > 0) {
      trackBeginCheckout(total, totalItemCount);
      trackedCheckoutRef.current = true;
    }
  }, [total, totalItemCount]);

  const validate = () => {
    const nextErrors = {};
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      nextErrors.email = 'Valid email is required (e.g. customer@example.com)';
    }
    if (!firstName.trim()) nextErrors.firstName = 'First name is required';
    if (!lastName.trim()) nextErrors.lastName = 'Last name is required';
    if (!street.trim()) nextErrors.street = 'Street address is required';
    if (!city.trim()) nextErrors.city = 'City is required';
    if (!country.trim()) nextErrors.country = 'Country is required';

    // Phone validation & normalization check
    const normalized = normalizeEthiopianPhone(phone);
    if (!phone.trim()) {
      nextErrors.phone = 'Phone number is required';
    } else if (!normalized || !( /^\+251[79]\d{8}$/.test(normalized) || /^\+[1-9]\d{7,14}$/.test(normalized) )) {
      nextErrors.phone = 'Enter a valid phone number (e.g. 0911 223 344 or +251 911 223 344)';
    }

    if (!zip.trim()) nextErrors.zip = 'Postal / Zip code is required';

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (event) => {
    if (event) event.preventDefault();
    if (isSubmitting) return;

    setSubmitError('');

    if (!isAuthenticated || !user) {
      try {
        sessionStorage.setItem('novashop_redirect_after_login', '/checkout');
      } catch {
        // ignore
      }
      go('/login');
      return;
    }

    if (!validate()) {
      return;
    }

    // If an order has already been created and we are retrying Chapa payment, re-initialize directly
    if (pendingOrder && paymentMethod === 'Chapa') {
      await handleRetryPayment(pendingOrder);
      return;
    }

    setIsSubmitting(true);

    try {
      const normalizedPhone = normalizeEthiopianPhone(phone);

      const orderPayload = {
        orderItems: items.map((item) => ({
          name: item.name,
          qty: Number(item.qty || item.quantity || 1),
          product: item.productId || item.product,
          variant: item.variantId || item.variant || null,
          image: item.image || '',
          price: Number(item.price) || 0,
          sku: item.sku || '',
          size: item.size || '',
          color: item.color || '',
        })),
        shippingAddress: {
          recipientName: `${firstName.trim()} ${lastName.trim()}`,
          phone: normalizedPhone,
          address: street.trim(),
          address2: apartment.trim(),
          city: city.trim(),
          state: state.trim(),
          postalCode: zip.trim(),
          country: country.trim(),
        },
        paymentMethod: paymentMethod === 'Cash on Delivery' ? 'Cash' : 'Chapa',
        shippingPrice: shipping,
        taxPrice: taxCalculation.taxPrice,
        shippingMethod: shippingOptions.find((o) => o.id === shippingMethod)?.label || (shippingMethod === 'express' ? 'Express Delivery' : 'Standard Delivery'),
        discountCode: appliedPromo ? appliedPromo : undefined,
        sessionId: getSessionId(),
      };

      const res = await orderApi.createOrder(orderPayload);

      if (!res.success || !res.data) {
        throw new Error(res.message || 'Failed to place order. Please check item stock.');
      }

      const createdOrder = res.data;
      placeOrder(createdOrder);

      // 1. Optionally save this address to account if checkbox was checked
      if (saveAddressToAccount && isAuthenticated) {
        try {
          await addressApi.createAddress({
            label: selectedAddressId === 'new' ? 'Checkout Address' : 'Home',
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            phone: normalizedPhone,
            street: street.trim(),
            street2: apartment.trim(),
            city: city.trim(),
            state: state.trim() || city.trim(),
            postalCode: zip.trim(),
            country: country.trim(),
            isDefault: savedAddresses.length === 0,
          });
        } catch (addrErr) {
          console.warn('Unable to auto-save address to account:', addrErr);
        }
      }

      // 2. Only update user's profile if checkbox was explicitly checked
      if (updateProfileInfo && isAuthenticated) {
        try {
          await userApi.updateProfile({
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            phone: normalizedPhone,
          });
          window.dispatchEvent(new Event('novashop:user-updated'));
        } catch (profileErr) {
          console.warn('Unable to update profile contact info:', profileErr);
        }
      }

      // Handle Online Payment (Chapa)
      if (paymentMethod === 'Chapa') {
        setPendingOrder(createdOrder);
        try {
          const returnUrl = `${window.location.origin}/checkout/confirmation?orderId=${createdOrder._id}`;
          const initRes = await orderApi.initializePayment(createdOrder._id, {
            paymentMethod: 'Chapa',
            returnUrl,
          });

          if (initRes.success && initRes.data?.checkoutUrl) {
            // Redirect customer directly to Chapa hosted payment checkout
            window.location.href = initRes.data.checkoutUrl;
            return;
          }

          throw new Error("We couldn't start your payment. Please try again.");
        } catch (paymentErr) {
          const errMsg =
            paymentErr.response?.data?.message ||
            paymentErr.message ||
            "We couldn't start your payment. Please try again.";
          setSubmitError(errMsg);
          // Never navigate away to confirmation page on failed initialize; keep user on checkout with retry button
        }
      } else {
        // Cash on Delivery
        if (typeof refreshCart === 'function') {
          await refreshCart();
        }
        go(`/checkout/confirmation?orderId=${createdOrder._id}`);
      }
    } catch (err) {
      const message =
        err.response?.data?.message ||
        err.message ||
        'An unexpected error occurred during order submission. Please try again.';
      setSubmitError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRetryPayment = async (orderToRetry = pendingOrder) => {
    if (!orderToRetry?._id || isSubmitting) return;

    setIsSubmitting(true);
    setSubmitError('');

    try {
      const returnUrl = `${window.location.origin}/checkout/confirmation?orderId=${orderToRetry._id}`;
      const initRes = await orderApi.initializePayment(orderToRetry._id, {
        paymentMethod: 'Chapa',
        returnUrl,
      });

      if (initRes.success && initRes.data?.checkoutUrl) {
        window.location.href = initRes.data.checkoutUrl;
        return;
      }

      throw new Error("We couldn't start your payment. Please try again.");
    } catch (paymentErr) {
      const errMsg =
        paymentErr.response?.data?.message ||
        paymentErr.message ||
        "We couldn't start your payment. Please try again.";
      setSubmitError(errMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (items.length === 0) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg-main)', color: 'var(--text-primary)', padding: '60px 24px' }}>
        <div style={{ maxWidth: '520px', margin: '0 auto', textAlign: 'center' }}>
          <div style={{ marginBottom: '18px', fontFamily: 'var(--font-sans)', fontSize: '11px', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Checkout</div>
          <h1 style={{ margin: '0 0 14px', fontFamily: 'var(--font-serif)', fontSize: '44px', fontStyle: 'italic', color: 'var(--text-primary)' }}>Your bag is empty</h1>
          <p style={{ margin: '0 0 26px', fontFamily: 'var(--font-sans)', fontSize: '14px', lineHeight: 1.7, color: 'var(--text-secondary)' }}>Add items from the collection to proceed with checkout.</p>
          <button
            type="button"
            onClick={() => go('/shop')}
            style={{ border: 'none', background: 'var(--color-primary)', color: 'var(--color-primary-contrast)', padding: '14px 24px', borderRadius: '999px', fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase', cursor: 'pointer' }}
          >
            Explore Collection →
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="checkout-page-container">
      <style>{`
        .checkout-page-container {
          min-height: 100vh;
          background: var(--bg-main);
          color: var(--text-primary);
          padding: 28px 24px 40px;
        }
        .checkout-grid {
          display: grid;
          grid-template-columns: minmax(0, 1.4fr) minmax(300px, 0.9fr);
          gap: 32px;
          align-items: start;
        }
        .checkout-name-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 14px;
        }
        .checkout-location-grid {
          display: grid;
          grid-template-columns: 1.2fr 1fr 1fr;
          gap: 14px;
        }
        .checkout-aside {
          background: var(--bg-surface);
          border: 1px solid var(--border-default);
          border-radius: 18px;
          padding: 24px;
          position: sticky;
          top: 24px;
        }

        @media (max-width: 1023px) {
          .checkout-grid {
            grid-template-columns: 1fr;
            gap: 24px;
          }
          .checkout-aside {
            position: static;
          }
        }

        @media (max-width: 767px) {
          .checkout-page-container {
            padding: 16px 16px calc(24px + env(safe-area-inset-bottom, 0px));
          }
          .checkout-input {
            font-size: 16px !important;
          }
        }

        @media (max-width: 639px) {
          .checkout-name-grid {
            grid-template-columns: 1fr;
          }
          .checkout-location-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        {/* Header */}
        <header style={{ borderBottom: '1px solid var(--border-default)', paddingBottom: '18px', marginBottom: '28px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '18px', flexWrap: 'wrap' }}>
            <button
              onClick={() => go('/')}
              style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'var(--font-serif)', fontSize: '22px', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--text-primary)' }}
            >
              NOVASHOP
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', fontFamily: 'var(--font-sans)', fontSize: '11px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)', overflowX: 'auto' }}>
              <button onClick={() => openCart()} style={{ background: 'none', border: 'none', padding: 0, color: 'var(--text-muted)', cursor: 'pointer', textDecoration: 'underline' }}>1. BAG</button>
              <span>→</span>
              <span style={{ fontWeight: 700, color: 'var(--text-primary)', borderBottom: '1px solid var(--text-primary)', paddingBottom: '2px' }}>2. CHECKOUT</span>
              <span>→</span>
              <span>3. CONFIRMATION</span>
            </div>
          </div>

          <div style={{ marginTop: '18px' }}>
            <button
              onClick={() => openCart()}
              style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--text-primary)', fontFamily: 'var(--font-sans)', fontSize: '11px', letterSpacing: '0.14em', textTransform: 'uppercase' }}
            >
              ← Return to Shopping Bag
            </button>
          </div>
        </header>

        {/* Auth prompt for guest users */}
        {!isAuthenticated && (
          <div style={{ background: 'var(--bg-surface-sunken)', border: '1px solid var(--border-default)', borderRadius: '14px', padding: '16px 20px', marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
            <div>
              <strong style={{ display: 'block', fontFamily: 'var(--font-sans)', fontSize: '13px', color: 'var(--text-primary)' }}>Have a NovaShop account?</strong>
              <span style={{ fontFamily: 'var(--font-sans)', fontSize: '12px', color: 'var(--text-secondary)' }}>Sign in to prefill your saved addresses and contact details automatically.</span>
            </div>
            <button
              type="button"
              onClick={() => {
                sessionStorage.setItem('novashop_redirect_after_login', '/checkout');
                go('/login');
              }}
              style={{ background: 'var(--color-primary)', color: 'var(--color-primary-contrast)', border: 'none', borderRadius: '999px', padding: '9px 18px', fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', cursor: 'pointer' }}
            >
              Sign In →
            </button>
          </div>
        )}

        {/* Global Error Notice */}
        {submitError && (
          <div style={{ background: 'var(--color-danger-soft)', border: '1px solid var(--color-danger)', borderRadius: '12px', padding: '16px 20px', marginBottom: '24px', fontFamily: 'var(--font-sans)', fontSize: '13px', color: 'var(--color-danger)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span>⚠️</span>
              <span>{submitError}</span>
            </div>
            {pendingOrder && paymentMethod === 'Chapa' && (
              <button
                type="button"
                onClick={() => handleRetryPayment(pendingOrder)}
                disabled={isSubmitting}
                style={{
                  border: 'none',
                  background: 'var(--color-danger)',
                  color: '#FFFFFF',
                  padding: '8px 18px',
                  borderRadius: '999px',
                  fontFamily: 'var(--font-sans)',
                  fontSize: '11px',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  fontWeight: 600,
                  cursor: isSubmitting ? 'not-allowed' : 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                {isSubmitting ? 'Connecting...' : 'Retry Payment via Chapa ↻'}
              </button>
            )}
          </div>
        )}

        <div className="checkout-grid">
          {/* Left Column: Form */}
          <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '28px' }}>
            {/* Contact Details */}
            <section style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: '18px', padding: '24px' }}>
              <div style={{ marginBottom: '18px' }}>
                <span style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Step 1 of 3</span>
                <h2 style={{ margin: '4px 0 0', fontFamily: 'var(--font-serif)', fontSize: '24px', fontStyle: 'italic', color: 'var(--text-primary)' }}>Contact Information</h2>
              </div>

              <div style={{ display: 'grid', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontFamily: 'var(--font-sans)', fontSize: '11px', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-primary)', marginBottom: '6px' }}>Email Address *</label>
                  <input
                    type="email"
                    className="checkout-input"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g. customer@example.com"
                    style={{ width: '100%', boxSizing: 'border-box', padding: '12px 14px', borderRadius: '8px', border: `1px solid ${errors.email ? 'var(--color-danger)' : 'var(--border-input)'}`, background: 'var(--bg-input)', color: 'var(--text-primary)', fontFamily: 'var(--font-sans)', fontSize: '14px' }}
                  />
                  {errors.email && <span style={{ color: 'var(--color-danger)', fontSize: '11px', marginTop: '4px', display: 'block' }}>{errors.email}</span>}
                </div>

                <div>
                  <label style={{ display: 'block', fontFamily: 'var(--font-sans)', fontSize: '11px', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-primary)', marginBottom: '6px' }}>Phone Number * (Ethiopian or International)</label>
                  <input
                    type="tel"
                    className="checkout-input"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="e.g. 0911 223 344 or +251 911 223 344"
                    style={{ width: '100%', boxSizing: 'border-box', padding: '12px 14px', borderRadius: '8px', border: `1px solid ${errors.phone ? 'var(--color-danger)' : 'var(--border-input)'}`, background: 'var(--bg-input)', color: 'var(--text-primary)', fontFamily: 'var(--font-sans)', fontSize: '14px' }}
                  />
                  {errors.phone ? (
                    <span style={{ color: 'var(--color-danger)', fontSize: '11px', marginTop: '4px', display: 'block' }}>{errors.phone}</span>
                  ) : (
                    <span style={{ color: 'var(--text-muted)', fontSize: '11px', marginTop: '4px', display: 'block' }}>Format: 09xxxxxxxx, 07xxxxxxxx, or +2519xxxxxxxx</span>
                  )}
                </div>

                {/* Profile update checkbox */}
                {isAuthenticated && (
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: '12px', color: 'var(--text-secondary)' }}>
                    <input
                      type="checkbox"
                      checked={updateProfileInfo}
                      onChange={(e) => setUpdateProfileInfo(e.target.checked)}
                      style={{ accentColor: 'var(--color-primary)', width: '15px', height: '15px' }}
                    />
                    <span>Update my profile contact details (name and phone) with these values</span>
                  </label>
                )}
              </div>
            </section>

            {/* Shipping Address */}
            <section style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: '18px', padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', flexWrap: 'wrap', gap: '10px' }}>
                <div>
                  <span style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Step 2 of 3</span>
                  <h2 style={{ margin: '4px 0 0', fontFamily: 'var(--font-serif)', fontSize: '24px', fontStyle: 'italic', color: 'var(--text-primary)' }}>Shipping Address</h2>
                </div>

                {/* Saved Address Picker for logged in users */}
                {isAuthenticated && savedAddresses.length > 0 && (
                  <div>
                    <label style={{ display: 'block', fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '4px' }}>
                      Choose Saved Address
                    </label>
                    <select
                      value={selectedAddressId}
                      className="checkout-input"
                      onChange={(e) => handleSelectSavedAddress(e.target.value)}
                      style={{
                        padding: '8px 12px',
                        borderRadius: '8px',
                        border: '1px solid var(--border-input)',
                        background: 'var(--bg-input)',
                        fontFamily: 'var(--font-sans)',
                        fontSize: '12px',
                        color: 'var(--text-primary)',
                        outline: 'none',
                      }}
                    >
                      {savedAddresses.map((addr) => (
                        <option key={addr._id} value={addr._id}>
                          {addr.label || 'Saved'} ({addr.street}, {addr.city}){addr.isDefault ? ' — Default' : ''}
                        </option>
                      ))}
                      <option value="new">+ Enter a new address</option>
                    </select>
                  </div>
                )}
              </div>

              <div style={{ display: 'grid', gap: '14px' }}>
                <div className="checkout-name-grid">
                  <div>
                    <label style={{ display: 'block', fontFamily: 'var(--font-sans)', fontSize: '11px', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-primary)', marginBottom: '6px' }}>First Name *</label>
                    <input
                      type="text"
                      className="checkout-input"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      style={{ width: '100%', boxSizing: 'border-box', padding: '12px 14px', borderRadius: '8px', border: `1px solid ${errors.firstName ? 'var(--color-danger)' : 'var(--border-input)'}`, background: 'var(--bg-input)', color: 'var(--text-primary)', fontFamily: 'var(--font-sans)', fontSize: '14px' }}
                    />
                    {errors.firstName && <span style={{ color: 'var(--color-danger)', fontSize: '11px', marginTop: '4px', display: 'block' }}>{errors.firstName}</span>}
                  </div>
                  <div>
                    <label style={{ display: 'block', fontFamily: 'var(--font-sans)', fontSize: '11px', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-primary)', marginBottom: '6px' }}>Last Name *</label>
                    <input
                      type="text"
                      className="checkout-input"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      style={{ width: '100%', boxSizing: 'border-box', padding: '12px 14px', borderRadius: '8px', border: `1px solid ${errors.lastName ? 'var(--color-danger)' : 'var(--border-input)'}`, background: 'var(--bg-input)', color: 'var(--text-primary)', fontFamily: 'var(--font-sans)', fontSize: '14px' }}
                    />
                    {errors.lastName && <span style={{ color: 'var(--color-danger)', fontSize: '11px', marginTop: '4px', display: 'block' }}>{errors.lastName}</span>}
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontFamily: 'var(--font-sans)', fontSize: '11px', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-primary)', marginBottom: '6px' }}>Street Address *</label>
                  <input
                    type="text"
                    className="checkout-input"
                    value={street}
                    onChange={(e) => setStreet(e.target.value)}
                    placeholder="e.g. Bole Road, House #402"
                    style={{ width: '100%', boxSizing: 'border-box', padding: '12px 14px', borderRadius: '8px', border: `1px solid ${errors.street ? 'var(--color-danger)' : 'var(--border-input)'}`, background: 'var(--bg-input)', color: 'var(--text-primary)', fontFamily: 'var(--font-sans)', fontSize: '14px' }}
                  />
                  {errors.street && <span style={{ color: 'var(--color-danger)', fontSize: '11px', marginTop: '4px', display: 'block' }}>{errors.street}</span>}
                </div>

                <div>
                  <label style={{ display: 'block', fontFamily: 'var(--font-sans)', fontSize: '11px', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-primary)', marginBottom: '6px' }}>Apartment, suite, unit (optional)</label>
                  <input
                    type="text"
                    className="checkout-input"
                    value={apartment}
                    onChange={(e) => setApartment(e.target.value)}
                    placeholder="e.g. Apt 3B"
                    style={{ width: '100%', boxSizing: 'border-box', padding: '12px 14px', borderRadius: '8px', border: '1px solid var(--border-input)', background: 'var(--bg-input)', color: 'var(--text-primary)', fontFamily: 'var(--font-sans)', fontSize: '14px' }}
                  />
                </div>

                <div className="checkout-location-grid">
                  <div>
                    <label style={{ display: 'block', fontFamily: 'var(--font-sans)', fontSize: '11px', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-primary)', marginBottom: '6px' }}>City *</label>
                    <input
                      type="text"
                      className="checkout-input"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      style={{ width: '100%', boxSizing: 'border-box', padding: '12px 14px', borderRadius: '8px', border: `1px solid ${errors.city ? 'var(--color-danger)' : 'var(--border-input)'}`, background: 'var(--bg-input)', color: 'var(--text-primary)', fontFamily: 'var(--font-sans)', fontSize: '14px' }}
                    />
                    {errors.city && <span style={{ color: 'var(--color-danger)', fontSize: '11px', marginTop: '4px', display: 'block' }}>{errors.city}</span>}
                  </div>
                  <div>
                    <label style={{ display: 'block', fontFamily: 'var(--font-sans)', fontSize: '11px', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-primary)', marginBottom: '6px' }}>State / Region</label>
                    <input
                      type="text"
                      className="checkout-input"
                      value={state}
                      onChange={(e) => setState(e.target.value)}
                      style={{ width: '100%', boxSizing: 'border-box', padding: '12px 14px', borderRadius: '8px', border: '1px solid var(--border-input)', background: 'var(--bg-input)', color: 'var(--text-primary)', fontFamily: 'var(--font-sans)', fontSize: '14px' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontFamily: 'var(--font-sans)', fontSize: '11px', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-primary)', marginBottom: '6px' }}>Postal Code *</label>
                    <input
                      type="text"
                      className="checkout-input"
                      value={zip}
                      onChange={(e) => setZip(e.target.value)}
                      style={{ width: '100%', boxSizing: 'border-box', padding: '12px 14px', borderRadius: '8px', border: `1px solid ${errors.zip ? 'var(--color-danger)' : 'var(--border-input)'}`, background: 'var(--bg-input)', color: 'var(--text-primary)', fontFamily: 'var(--font-sans)', fontSize: '14px' }}
                    />
                    {errors.zip && <span style={{ color: 'var(--color-danger)', fontSize: '11px', marginTop: '4px', display: 'block' }}>{errors.zip}</span>}
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontFamily: 'var(--font-sans)', fontSize: '11px', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-primary)', marginBottom: '6px' }}>Country *</label>
                  <input
                    type="text"
                    className="checkout-input"
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '12px 14px', borderRadius: '8px', border: `1px solid ${errors.country ? 'var(--color-danger)' : 'var(--border-input)'}`, background: 'var(--bg-input)', color: 'var(--text-primary)', fontFamily: 'var(--font-sans)', fontSize: '14px' }}
                  />
                  {errors.country && <span style={{ color: 'var(--color-danger)', fontSize: '11px', marginTop: '4px', display: 'block' }}>{errors.country}</span>}
                </div>

                {/* Save address checkbox */}
                {isAuthenticated && (
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: '13px', color: 'var(--text-primary)' }}>
                    <input
                      type="checkbox"
                      checked={saveAddressToAccount}
                      onChange={(e) => setSaveAddressToAccount(e.target.checked)}
                      style={{ accentColor: 'var(--color-primary)', width: '16px', height: '16px' }}
                    />
                    <span>Save this address to my account for future orders</span>
                  </label>
                )}
              </div>
            </section>

            {/* Payment Method Selection */}
            <section style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: '18px', padding: '24px' }}>
              <div style={{ marginBottom: '18px' }}>
                <span style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Step 3 of 3</span>
                <h2 style={{ margin: '4px 0 0', fontFamily: 'var(--font-serif)', fontSize: '24px', fontStyle: 'italic', color: 'var(--text-primary)' }}>Payment Method</h2>
              </div>

              <div style={{ display: 'grid', gap: '14px' }}>
                {PAYMENT_METHODS.map((method) => {
                  const isSelected = paymentMethod === method.id;
                  return (
                    <div
                      key={method.id}
                      onClick={() => setPaymentMethod(method.id)}
                      style={{
                        cursor: 'pointer',
                        padding: '16px 18px',
                        borderRadius: '12px',
                        border: `1.5px solid ${isSelected ? 'var(--color-primary)' : 'var(--border-default)'}`,
                        background: isSelected ? 'var(--bg-surface-raised)' : 'var(--bg-surface)',
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '14px',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <input
                        type="radio"
                        name="paymentMethod"
                        checked={isSelected}
                        onChange={() => setPaymentMethod(method.id)}
                        style={{ marginTop: '4px', accentColor: 'var(--color-primary)' }}
                      />
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '18px' }}>{method.icon}</span>
                          <strong style={{ fontFamily: 'var(--font-sans)', fontSize: '14px', color: 'var(--text-primary)' }}>{method.title}</strong>
                          <span style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.08em', textTransform: 'uppercase', background: 'var(--bg-surface-sunken)', padding: '2px 8px', borderRadius: '999px', color: 'var(--text-secondary)' }}>
                            {method.badge}
                          </span>
                        </div>
                        <p style={{ margin: '6px 0 0', fontFamily: 'var(--font-sans)', fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                          {method.description}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </form>

          {/* Right Column: Order Summary */}
          <aside className="checkout-aside">
            <h2 style={{ margin: '0 0 18px', fontFamily: 'var(--font-sans)', fontSize: '11px', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-primary)' }}>
              Order Summary ({totalItemCount} {totalItemCount === 1 ? 'item' : 'items'})
            </h2>

            {/* Item List */}
            <div style={{ maxHeight: '240px', overflowY: 'auto', display: 'grid', gap: '12px', paddingRight: '4px', marginBottom: '20px' }}>
              {items.map((item, idx) => (
                <div key={item.id || item.variantId || idx} style={{ display: 'grid', gridTemplateColumns: '50px 1fr auto', gap: '12px', alignItems: 'center' }}>
                  <img src={item.image || '/placeholder.jpg'} alt={item.name} style={{ width: '50px', height: '50px', objectFit: 'cover', borderRadius: '6px', background: 'var(--bg-surface-sunken)' }} />
                  <div>
                    <div style={{ fontFamily: 'var(--font-sans)', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.3 }}>{item.name}</div>
                    <div style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      {item.color ? `${item.color} · ` : ''}{item.size ? `Size ${item.size} · ` : ''}Qty {item.qty || item.quantity || 1}
                    </div>
                  </div>
                  <div style={{ fontFamily: 'var(--font-sans)', fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {formatCurrency((item.price || 0) * (item.qty || item.quantity || 1))}
                  </div>
                </div>
              ))}
            </div>

            {/* Shipping Options */}
            <div style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-primary)' }}>Delivery Speed</span>
                {shippingQuote?.freeShippingQualified && (
                  <span style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', color: 'var(--color-success)', fontWeight: 600 }}>Free shipping applied (${freeShippingThreshold}+ order)</span>
                )}
              </div>
              <div style={{ display: 'grid', gap: '8px' }}>
                {shippingOptions.map((opt) => (
                  <label
                    key={opt.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      border: `1px solid ${shippingMethod === opt.id ? 'var(--color-primary)' : 'var(--border-default)'}`,
                      background: shippingMethod === opt.id ? 'var(--bg-surface-raised)' : 'transparent',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <input
                        type="radio"
                        name="shippingOption"
                        checked={shippingMethod === opt.id}
                        onChange={() => setShippingMethod(opt.id)}
                        style={{ accentColor: 'var(--color-primary)' }}
                      />
                      <div>
                        <div style={{ fontFamily: 'var(--font-sans)', fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>{opt.label}</div>
                        <div style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', color: 'var(--text-muted)' }}>{opt.note}</div>
                      </div>
                    </div>
                    <span style={{ fontFamily: 'var(--font-sans)', fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)' }}>
                      {opt.price === 0 ? 'Free' : formatCurrency(opt.price)}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Promo Code Input Field */}
            <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '16px', marginBottom: '14px' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  className="checkout-input"
                  value={promoCodeInput}
                  onChange={(e) => {
                    setPromoCodeInput(e.target.value);
                    setPromoError('');
                  }}
                  placeholder="Discount code"
                  aria-label="Discount code"
                  disabled={isApplyingPromo || Boolean(appliedPromo)}
                  style={{
                    flex: 1,
                    padding: '10px 12px',
                    border: promoError ? '1px solid var(--color-danger)' : '1px solid var(--border-input)',
                    borderRadius: '8px',
                    background: appliedPromo ? 'var(--bg-surface-sunken)' : 'var(--bg-input)',
                    fontFamily: 'var(--font-sans)',
                    fontSize: '12px',
                    color: 'var(--text-primary)',
                    textTransform: 'uppercase',
                    outline: 'none',
                  }}
                />
                {appliedPromo ? (
                  <button
                    type="button"
                    onClick={() => {
                      removePromoCode();
                      setPromoCodeInput('');
                      setPromoError('');
                    }}
                    style={{
                      background: 'none',
                      border: '1px solid var(--border-default)',
                      borderRadius: '8px',
                      padding: '10px 14px',
                      fontFamily: 'var(--font-sans)',
                      fontSize: '11px',
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                      cursor: 'pointer',
                      color: 'var(--text-muted)',
                    }}
                  >
                    Remove
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={isApplyingPromo || !promoCodeInput.trim()}
                    onClick={async () => {
                      if (!promoCodeInput.trim()) return;
                      setIsApplyingPromo(true);
                      setPromoError('');
                      const result = await applyPromoCode(promoCodeInput);
                      if (!result.ok) {
                        setPromoError(result.message);
                      }
                      setIsApplyingPromo(false);
                    }}
                    style={{
                      background: 'var(--color-primary)',
                      color: 'var(--color-primary-contrast)',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '10px 18px',
                      fontFamily: 'var(--font-sans)',
                      fontSize: '11px',
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                      fontWeight: 600,
                      cursor: isApplyingPromo || !promoCodeInput.trim() ? 'not-allowed' : 'pointer',
                      opacity: isApplyingPromo || !promoCodeInput.trim() ? 0.6 : 1,
                    }}
                  >
                    {isApplyingPromo ? 'Applying…' : 'Apply'}
                  </button>
                )}
              </div>
              {promoError && (
                <p style={{ margin: '6px 0 0', fontFamily: 'var(--font-sans)', fontSize: '11px', color: 'var(--color-danger)' }}>
                  {promoError}
                </p>
              )}
              {appliedPromo && (
                <p style={{ margin: '6px 0 0', fontFamily: 'var(--font-sans)', fontSize: '11px', color: 'var(--color-success)' }}>
                  ✓ Code {appliedPromo} applied
                </p>
              )}
            </div>

            {/* Calculations */}
            <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '16px', display: 'grid', gap: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-sans)', fontSize: '13px', color: 'var(--text-secondary)' }}>
                <span>Subtotal</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-sans)', fontSize: '13px', color: 'var(--text-secondary)' }}>
                <span>Shipping</span>
                <span>{shipping === 0 ? 'Complimentary' : formatCurrency(shipping)}</span>
              </div>
              {taxCalculation && taxCalculation.taxPrice > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-sans)', fontSize: '13px', color: 'var(--text-secondary)' }}>
                  <span>{taxCalculation.taxName || 'Estimated Tax'} ({taxCalculation.rate}%)</span>
                  <span>{taxCalculation.included ? 'Included' : formatCurrency(taxCalculation.taxPrice)}</span>
                </div>
              )}
              {promoDiscount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-sans)', fontSize: '13px', color: 'var(--color-success)' }}>
                  <span>Promo ({appliedPromo})</span>
                  <span>-{formatCurrency(promoDiscount)}</span>
                </div>
              )}
              <div style={{ borderTop: '1px solid var(--border-default)', paddingTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ fontFamily: 'var(--font-sans)', fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>Total</span>
                <span style={{ fontFamily: 'var(--font-sans)', fontSize: '26px', fontWeight: 700, color: 'var(--text-primary)' }}>{formatCurrency(total)}</span>
              </div>
            </div>

            {/* Place Order CTA Button */}
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              style={{
                width: '100%',
                minHeight: '48px',
                marginTop: '22px',
                marginBottom: 'calc(10px + env(safe-area-inset-bottom, 0px))',
                background: 'var(--color-primary)',
                color: 'var(--color-primary-contrast)',
                border: 'none',
                borderRadius: '999px',
                padding: '16px 24px',
                fontFamily: 'var(--font-sans)',
                fontSize: '11px',
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                fontWeight: 600,
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                opacity: isSubmitting ? 0.75 : 1,
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              {isSubmitting
                ? 'Securing Order...'
                : pendingOrder && paymentMethod === 'Chapa'
                ? `Retry Payment via Chapa (${formatCurrency(total)}) ↻`
                : paymentMethod === 'Chapa'
                ? `Proceed to Payment (${formatCurrency(total)}) →`
                : `Place Order with Cash (${formatCurrency(total)}) →`}
            </button>

            <div style={{ marginTop: '14px', textAlign: 'center', fontFamily: 'var(--font-sans)', fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
              🔒 256-bit SSL encrypted checkout. Authoritative server verification for inventory &amp; prices.
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
