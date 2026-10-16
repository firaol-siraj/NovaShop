import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';

/* ── Icons ─────────────────────────────────────────── */
const SearchIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
  </svg>
);
const ArrowRight = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 12h14" /><path d="m13 5 7 7-7 7" />
  </svg>
);
const ChevronRight = ({ open }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
    style={{ transform: open ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 220ms ease', flexShrink: 0 }}>
    <path d="m9 18 6-6-6-6" />
  </svg>
);
const MailIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect width="20" height="16" x="2" y="4" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
  </svg>
);
const CloseIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M18 6 6 18M6 6l12 12" />
  </svg>
);

/* category icons as inline SVG */
const OrderIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12H3l9-9 9 9h-2" /><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" /><path d="M9 21V12h6v9" /></svg>
);
const ShipIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 17H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11v12H5Z" /><path d="M9 17h9a2 2 0 0 0 2-2V9l-3-4h-8v12Z" /><circle cx="7.5" cy="19.5" r="1.5" /><circle cx="17.5" cy="19.5" r="1.5" /></svg>
);
const AccountIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
);
const PayIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="14" x="2" y="5" rx="2" /><path d="M2 10h20" /></svg>
);
const LockIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
);

/* ── Data ───────────────────────────────────────────── */
const CATEGORIES = [
  { id: 'orders', Icon: OrderIcon, title: 'Orders & Tracking', desc: 'Track an existing order or view your purchase history.', route: '/account/orders', protected: true },
  { id: 'shipping', Icon: ShipIcon, title: 'Shipping & Returns', desc: 'Delivery options, transit times, and return policies.', route: '/shipping-returns', protected: false },
  { id: 'account', Icon: AccountIcon, title: 'Account', desc: 'Manage your profile, saved addresses, and security.', route: '/account', protected: true },
  { id: 'payments', Icon: PayIcon, title: 'Payments & Invoicing', desc: 'Payment methods, receipts, and billing inquiries.', route: '/account/payments', protected: true },
  { id: 'security', Icon: LockIcon, title: 'Password & Security', desc: 'Reset your password or update your login credentials.', route: '/account/settings', protected: true },
];

const FAQS = [
  {
    id: 'tracking',
    q: 'How can I track my order?',
    a: 'Once your order ships, you\'ll receive a confirmation email with a tracking link. You can also view live status anytime by going to Account → Orders.',
  },
  {
    id: 'return',
    q: 'How do I request a return?',
    a: 'Start a return from Account → Orders within 30 days of delivery. Select the item(s) you\'d like to return, print the prepaid label, and drop it at any partner courier point.',
  },
  {
    id: 'details',
    q: 'How do I change my account details?',
    a: 'Go to Account → Profile → Edit Profile to update your name, email address, or phone number. Changes take effect immediately.',
  },
  {
    id: 'password',
    q: 'How do I reset my password?',
    a: 'Go to Account → Settings → Security and choose "Update Password". If you\'re signed out, use the "Forgot password?" link on the login screen and we\'ll email you a reset link.',
  },
];

/* ── Styles / tokens ────────────────────────────────── */
const T = {
  bg: '#FAF7F2',
  surface: '#FDFBF7',
  border: 'rgba(27,24,22,0.12)',
  espresso: '#231E1B',
  muted: '#6E6962',
  inputBg: '#F6F0E9',
};

const inputBase = {
  fontFamily: 'var(--font-sans)',
  fontSize: '14px',
  color: T.espresso,
  background: T.inputBg,
  border: `1px solid ${T.border}`,
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
  transition: 'border-color 180ms ease, box-shadow 180ms ease',
};

/* ── FAQ row ────────────────────────────────────────── */
function FaqRow({ item }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ borderBottom: `1px solid ${T.border}` }}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
        style={{
          width: '100%', textAlign: 'left', background: 'none', border: 'none',
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: '16px', padding: '20px 0',
          fontFamily: 'var(--font-sans)', fontSize: '14px', fontWeight: 500,
          color: T.espresso, letterSpacing: '0.01em',
        }}
      >
        {item.q}
        <ChevronRight open={open} />
      </button>
      <div style={{
        overflow: 'hidden',
        maxHeight: open ? '300px' : '0',
        transition: 'max-height 240ms ease',
      }}>
        <p style={{
          margin: 0, padding: '0 0 20px',
          fontFamily: 'var(--font-sans)', fontSize: '14px',
          lineHeight: 1.7, color: T.muted,
        }}>
          {item.a}
        </p>
      </div>
    </div>
  );
}

/* ── Contact modal ──────────────────────────────────── */
function ContactModal({ onClose }) {
  const [form, setForm] = useState({ name: '', email: '', order: '', message: '' });
  const [errors, setErrors] = useState({});
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const set = (key) => (e) => {
    setForm(f => ({ ...f, [key]: e.target.value }));
    if (errors[key]) setErrors(er => ({ ...er, [key]: '' }));
  };

  const submit = (e) => {
    e.preventDefault();
    const next = {};
    if (!form.name.trim()) next.name = 'Name is required.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) next.email = 'Valid email required.';
    if (!form.message.trim()) next.message = 'Message is required.';
    setErrors(next);
    if (Object.keys(next).length) return;
    setSending(true);
    setTimeout(() => { setSending(false); setSent(true); }, 900);
  };

  const fieldStyle = (err) => ({
    ...inputBase, padding: '12px 14px', borderRadius: 0,
    borderColor: err ? '#B55247' : T.border,
    boxShadow: err ? '0 0 0 3px rgba(181,82,71,0.08)' : 'none',
  });

  const labelStyle = {
    display: 'block', marginBottom: '8px',
    fontFamily: 'var(--font-sans)', fontSize: '10px',
    letterSpacing: '0.15em', textTransform: 'uppercase',
    fontWeight: 600, color: '#7A726C',
  };

  const errStyle = { marginTop: '6px', color: '#B55247', fontFamily: 'var(--font-sans)', fontSize: '12px' };

  return (
    <div
      role="dialog" aria-modal="true" aria-label="Contact us"
      style={{
        position: 'fixed', inset: 0, zIndex: 999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '20px',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* backdrop */}
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(27,24,22,0.45)', backdropFilter: 'blur(3px)' }} onClick={onClose} />

      <div style={{
        position: 'relative', zIndex: 1,
        background: T.surface, width: '100%', maxWidth: '480px',
        padding: '36px', boxShadow: '0 24px 64px rgba(0,0,0,0.18)',
        animation: 'hpFadeUp 0.28s ease',
      }}>
        <button
          type="button" onClick={onClose} aria-label="Close"
          style={{ position: 'absolute', top: '18px', right: '18px', background: 'none', border: 'none', cursor: 'pointer', color: T.muted, display: 'flex' }}
        >
          <CloseIcon />
        </button>

        <h2 style={{ margin: '0 0 6px', fontFamily: 'var(--font-serif)', fontSize: '24px', fontWeight: 400, color: T.espresso }}>
          Contact Us
        </h2>
        <p style={{ margin: '0 0 28px', fontFamily: 'var(--font-sans)', fontSize: '13px', color: T.muted }}>
          Fill in the form and we'll get back to you within 1 business day.
        </p>

        {sent ? (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <div style={{ fontSize: '36px', marginBottom: '14px' }}>✓</div>
            <p style={{ fontFamily: 'var(--font-serif)', fontSize: '18px', color: T.espresso, margin: '0 0 8px' }}>Message sent</p>
            <p style={{ fontFamily: 'var(--font-sans)', fontSize: '13px', color: T.muted, margin: 0 }}>
              We'll get back to you within 1 business day.
            </p>
          </div>
        ) : (
          <form onSubmit={submit} noValidate style={{ display: 'grid', gap: '18px' }}>
            <div>
              <label style={labelStyle} htmlFor="c-name">Name</label>
              <input id="c-name" type="text" value={form.name} onChange={set('name')} style={fieldStyle(errors.name)} placeholder="Your name" autoComplete="name" />
              {errors.name && <div style={errStyle}>{errors.name}</div>}
            </div>
            <div>
              <label style={labelStyle} htmlFor="c-email">Email</label>
              <input id="c-email" type="email" value={form.email} onChange={set('email')} style={fieldStyle(errors.email)} placeholder="you@example.com" autoComplete="email" />
              {errors.email && <div style={errStyle}>{errors.email}</div>}
            </div>
            <div>
              <label style={labelStyle} htmlFor="c-order">Order Number <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional)</span></label>
              <input id="c-order" type="text" value={form.order} onChange={set('order')} style={fieldStyle(false)} placeholder="#NS-0000" />
            </div>
            <div>
              <label style={labelStyle} htmlFor="c-msg">Message</label>
              <textarea
                id="c-msg" rows={4} value={form.message} onChange={set('message')}
                style={{ ...fieldStyle(errors.message), resize: 'vertical', minHeight: '96px', padding: '12px 14px' }}
                placeholder="How can we help?"
              />
              {errors.message && <div style={errStyle}>{errors.message}</div>}
            </div>
            <button
              type="submit" disabled={sending}
              style={{
                width: '100%', minHeight: '46px',
                background: T.espresso, color: '#FDFBF7',
                border: 'none', borderRadius: 0, cursor: sending ? 'wait' : 'pointer',
                fontFamily: 'var(--font-sans)', fontSize: '11px',
                letterSpacing: '0.14em', textTransform: 'uppercase',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                opacity: sending ? 0.85 : 1, transition: 'opacity 180ms',
              }}
            >
              {sending ? 'Sending…' : <><MailIcon /> Send Message</>}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   MAIN PAGE
══════════════════════════════════════════════════════ */
export default function HelpPage({ go }) {
  const { isAuthenticated } = useAuth();
  const [query, setQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const searchRef = useRef(null);

  const handleCategoryClick = (category) => {
    if (category.protected && !isAuthenticated) {
      go(`/login?redirect=${category.route}`);
      return;
    }
    go(category.route);
  };

  /* Cmd/Ctrl+K → focus search */
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const q = query.trim().toLowerCase();
  const filteredFaqs = q
    ? FAQS.filter(f => f.q.toLowerCase().includes(q) || f.a.toLowerCase().includes(q))
    : FAQS;

  const isMac = typeof navigator !== 'undefined' && /Mac/.test(navigator.platform);

  return (
    <>
      <style>{`
        @keyframes hpFadeUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .hp-cat-card:hover { border-color: rgba(27,24,22,0.4) !important; }
        .hp-cat-card:hover .hp-arrow { transform: translateX(3px); }
        .hp-arrow { transition: transform 200ms ease; }

        @media (max-width: 1023px) {
          .hp-cat-grid { grid-template-columns: repeat(2, 1fr) !important; }
        }
        @media (max-width: 767px) {
          .hp-cat-grid { grid-template-columns: 1fr !important; }
          .hp-container { padding-left: 20px !important; padding-right: 20px !important; }
          .hp-search-wrap { padding: 36px 20px 28px !important; }
        }
      `}</style>

      <div style={{ background: T.bg, minHeight: '60vh' }}>

        {/* ── Search bar ───────────────────────────────── */}
        <div className="hp-search-wrap" style={{ background: T.surface, borderBottom: `1px solid ${T.border}`, padding: '52px 20px 40px', textAlign: 'center' }}>
          <h1 style={{ margin: '0 0 28px', fontFamily: 'var(--font-serif)', fontSize: 'clamp(28px, 3vw, 36px)', fontWeight: 400, color: T.espresso, letterSpacing: '-0.03em' }}>
            How can we help?
          </h1>

          <div style={{ position: 'relative', maxWidth: '540px', margin: '0 auto' }}>
            {/* search icon */}
            <span style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: T.muted, display: 'flex', pointerEvents: 'none' }}>
              <SearchIcon />
            </span>

            <input
              ref={searchRef}
              type="search"
              id="help-search"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search help topics"
              aria-label="Search help topics"
              style={{
                ...inputBase,
                padding: '15px 80px 15px 48px',
                borderRadius: '0',
                fontSize: '15px',
                background: '#fff',
                border: `1px solid rgba(27,24,22,0.18)`,
                boxShadow: '0 2px 12px rgba(27,24,22,0.06)',
              }}
              onFocus={e => { e.target.style.borderColor = T.espresso; e.target.style.boxShadow = '0 0 0 3px rgba(27,24,22,0.07)'; }}
              onBlur={e => { e.target.style.borderColor = 'rgba(27,24,22,0.18)'; e.target.style.boxShadow = '0 2px 12px rgba(27,24,22,0.06)'; }}
            />

            {/* keyboard hint */}
            <span style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', display: 'flex', gap: '4px', alignItems: 'center', pointerEvents: 'none' }}>
              {[isMac ? '⌘' : 'Ctrl', 'K'].map(k => (
                <span key={k} style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', color: T.muted, border: `1px solid ${T.border}`, borderRadius: '3px', padding: '2px 5px', background: '#f0ece5', lineHeight: 1.5 }}>{k}</span>
              ))}
            </span>
          </div>
        </div>

        {/* ── Main content ─────────────────────────────── */}
        <div className="hp-container" style={{ maxWidth: '860px', margin: '0 auto', padding: '52px 32px 72px' }}>

          {/* Category grid — only show when not searching */}
          {!q && (
            <section aria-label="Help categories" style={{ marginBottom: '56px' }}>
              <div
                className="hp-cat-grid"
                style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '18px' }}
              >
                {CATEGORIES.map(({ id, Icon, title, desc, route, protected: isProtected }) => (
                  <button
                    key={id}
                    type="button"
                    className="hp-cat-card"
                    onClick={() => handleCategoryClick({ route, protected: isProtected })}
                    style={{
                      background: T.surface, border: `1px solid ${T.border}`,
                      borderRadius: '0', padding: '22px 20px',
                      textAlign: 'left', cursor: 'pointer',
                      display: 'flex', flexDirection: 'column', gap: '12px',
                      transition: 'border-color 200ms ease',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <span style={{ color: T.espresso }}><Icon /></span>
                      <span className="hp-arrow" style={{ color: T.muted }}><ArrowRight /></span>
                    </div>
                    <div>
                      <div style={{ fontFamily: 'var(--font-sans)', fontSize: '13px', fontWeight: 600, color: T.espresso, marginBottom: '6px', letterSpacing: '0.01em' }}>{title}</div>
                      <div style={{ fontFamily: 'var(--font-sans)', fontSize: '12px', color: T.muted, lineHeight: 1.6 }}>{desc}</div>
                    </div>
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* ── FAQ accordion ───────────────────────── */}
          <section aria-label="Popular questions">
            <div style={{ borderTop: q ? 'none' : `1px solid ${T.border}`, paddingTop: q ? 0 : '48px' }}>
              <h2 style={{ margin: '0 0 8px', fontFamily: 'var(--font-serif)', fontSize: 'clamp(22px, 2.4vw, 28px)', fontWeight: 400, color: T.espresso, letterSpacing: '-0.03em' }}>
                {q ? `Results for "${query}"` : 'Popular questions'}
              </h2>
              {!q && <div style={{ width: '40px', height: '1px', background: T.espresso, marginBottom: '28px' }} />}
              {q && <div style={{ marginBottom: '24px' }} />}
            </div>

            {filteredFaqs.length === 0 ? (
              <div style={{ padding: '40px 0', textAlign: 'center', color: T.muted, fontFamily: 'var(--font-sans)', fontSize: '14px' }}>
                No results for <strong style={{ color: T.espresso }}>"{query}"</strong>. Try a different search term.
              </div>
            ) : (
              <div>
                {filteredFaqs.map(item => <FaqRow key={item.id} item={item} />)}
              </div>
            )}
          </section>

          {/* ── Still need help card ─────────────────── */}
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '60px' }}>
            <div style={{
              width: '100%', maxWidth: '480px',
              background: '#F0EBE2', border: `1px solid ${T.border}`,
              padding: '36px 32px', textAlign: 'center',
            }}>
              <h2 style={{ margin: '0 0 10px', fontFamily: 'var(--font-serif)', fontSize: '24px', fontWeight: 400, color: T.espresso }}>
                Still need help?
              </h2>
              <p style={{ margin: '0 0 6px', fontFamily: 'var(--font-sans)', fontSize: '13px', color: T.muted, lineHeight: 1.6 }}>
                Our team is here to assist with any questions.
              </p>
              <p style={{ margin: '0 0 24px', fontFamily: 'var(--font-sans)', fontSize: '11px', color: T.muted, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                support@novashop.com · Monday – Friday
              </p>
              <button
                type="button"
                onClick={() => setShowModal(true)}
                style={{
                  background: T.espresso, color: '#FDFBF7',
                  border: 'none', borderRadius: 0, cursor: 'pointer',
                  fontFamily: 'var(--font-sans)', fontSize: '11px',
                  letterSpacing: '0.14em', textTransform: 'uppercase',
                  padding: '13px 28px',
                  display: 'inline-flex', alignItems: 'center', gap: '8px',
                  transition: 'opacity 180ms',
                }}
                onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
                onMouseLeave={e => e.currentTarget.style.opacity = '1'}
              >
                <MailIcon /> Contact Us
              </button>
            </div>
          </div>

        </div>
      </div>

      {showModal && <ContactModal onClose={() => setShowModal(false)} />}
    </>
  );
}
