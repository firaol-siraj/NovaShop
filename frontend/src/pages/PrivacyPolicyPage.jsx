import { useState, useEffect, useRef } from 'react';

const T = {
  bg: '#FAF7F2',
  bgAlt: '#F2EDE5',
  espresso: '#231E1B',
  muted: '#6E6962',
  border: 'rgba(27,24,22,0.12)',
  terracotta: '#9B4A3A',
};

const SECTIONS = [
  { id: 'information-we-collect', num: '01', title: 'Information We Collect', heading: 'Information We Collect' },
  { id: 'how-we-use-information', num: '02', title: 'How We Use Information', heading: 'How We Use Your Information' },
  { id: 'cookies-technologies', num: '03', title: 'Cookies & Technologies', heading: 'Cookies & Similar Technologies' },
  { id: 'how-we-share-information', num: '04', title: 'How We Share Information', heading: 'How We Share Information' },
  { id: 'data-security', num: '05', title: 'Data Security', heading: 'Data Security' },
  { id: 'your-rights-choices', num: '06', title: 'Your Rights & Choices', heading: 'Your Rights and Choices' },
  { id: 'data-retention', num: '07', title: 'Data Retention', heading: 'Data Retention' },
  { id: 'childrens-privacy', num: '08', title: "Children's Privacy", heading: "Children's Privacy" },
  { id: 'changes-to-this-policy', num: '09', title: 'Changes to This Policy', heading: 'Changes to This Policy' },
  { id: 'contact-us', num: '10', title: 'Contact Us', heading: 'Questions or Privacy Requests' },
];

export default function PrivacyPolicyPage({ go }) {
  const [activeSection, setActiveSection] = useState('information-we-collect');
  const [mobileTocOpen, setMobileTocOpen] = useState(false);
  const [cookieModalOpen, setCookieModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);
  
  const [consent, setConsent] = useState({
    preferences: false,
    analytical: false,
  });

  useEffect(() => {
    try {
      const stored = localStorage.getItem('novashop_cookie_consent');
      if (stored) {
        setConsent(JSON.parse(stored));
      }
    } catch (err) {}
  }, []);

  const handleSaveCookies = () => {
    try {
      localStorage.setItem('novashop_cookie_consent', JSON.stringify(consent));
      setToastMessage('Preferences saved');
      setTimeout(() => setToastMessage(null), 3000);
    } catch (err) {}
    setCookieModalOpen(false);
  };

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        let maxVisible = 0;
        let mostVisibleId = '';
        
        // Find the section that takes up the most of the viewport
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio > maxVisible) {
            maxVisible = entry.intersectionRatio;
            mostVisibleId = entry.target.id;
          }
        });

        if (mostVisibleId) {
          setActiveSection(mostVisibleId);
        }
      },
      { rootMargin: '-100px 0px -40% 0px', threshold: [0, 0.25, 0.5, 0.75, 1] }
    );

    SECTIONS.forEach((s) => {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  const scrollToSection = (id) => {
    const el = document.getElementById(id);
    if (el) {
      const yOffset = -120; // Account for sticky navbar
      const y = el.getBoundingClientRect().top + window.scrollY + yOffset;
      window.scrollTo({ top: y, behavior: 'smooth' });
      setActiveSection(id);
      setMobileTocOpen(false);
    }
  };

  return (
    <>
      <style>{`
        .pp-container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 0 clamp(24px, 6vw, 48px);
        }
        
        .pp-layout {
          display: grid;
          grid-template-columns: 220px 1fr;
          gap: clamp(48px, 8vw, 96px);
          padding: 64px 0 120px;
          align-items: start;
        }

        .pp-sidebar {
          position: sticky;
          top: 120px;
        }

        .pp-mobile-toc { display: none; }
        .pp-tablet-toc { display: none; }

        .pp-section {
          scroll-margin-top: 120px;
          margin-bottom: 80px;
        }
        
        .pp-section:last-child {
          margin-bottom: 0;
        }

        .pp-card-grid-1 {
          display: flex;
          flex-direction: column;
          gap: 16px;
          margin-top: 32px;
        }

        .pp-card-grid-3 {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 24px;
          margin-top: 32px;
          margin-bottom: 24px;
        }

        .pp-card-grid-2 {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 24px;
          margin-top: 32px;
          margin-bottom: 32px;
        }

        .pp-row-card {
          display: flex;
          align-items: flex-start;
          gap: 16px;
          padding: 24px;
          background: ${T.bg};
          border: 1px solid ${T.border};
          border-radius: 8px;
        }

        @media (max-width: 1023px) {
          .pp-layout {
            grid-template-columns: 1fr;
            padding-top: 32px;
            gap: 48px;
          }
          .pp-sidebar { display: none; }
          .pp-tablet-toc {
            display: flex;
            position: sticky;
            top: 70px;
            z-index: 90;
            background: ${T.bg};
            padding: 16px 0;
            margin: 0 -24px;
            padding: 16px 24px;
            overflow-x: auto;
            border-bottom: 1px solid ${T.border};
            gap: 12px;
            -webkit-overflow-scrolling: touch;
            scrollbar-width: none;
          }
          .pp-tablet-toc::-webkit-scrollbar { display: none; }
          
          .pp-card-grid-3 { grid-template-columns: 1fr; }
          .pp-card-grid-2 { grid-template-columns: 1fr; }
        }

        @media (max-width: 767px) {
          .pp-tablet-toc { display: none; }
          .pp-mobile-toc {
            display: block;
            margin-bottom: 40px;
          }
          .pp-row-card {
            flex-direction: column;
          }
        }

        /* Toggle switch styles */
        .toggle-switch {
          position: relative;
          display: inline-block;
          width: 40px;
          height: 22px;
        }
        .toggle-switch input {
          opacity: 0;
          width: 0;
          height: 0;
        }
        .slider {
          position: absolute;
          cursor: pointer;
          top: 0; left: 0; right: 0; bottom: 0;
          background-color: #ccc;
          transition: .4s;
          border-radius: 34px;
        }
        .slider:before {
          position: absolute;
          content: "";
          height: 16px; width: 16px;
          left: 3px; bottom: 3px;
          background-color: white;
          transition: .4s;
          border-radius: 50%;
        }
        input:checked + .slider { background-color: ${T.espresso}; }
        input:disabled + .slider { background-color: ${T.muted}; cursor: not-allowed; }
        input:checked + .slider:before { transform: translateX(18px); }

        /* Toast animation */
        @keyframes slideUpFade {
          0% { opacity: 0; transform: translate(-50%, 20px); }
          100% { opacity: 1; transform: translate(-50%, 0); }
        }
      `}</style>

      {/* BREADCRUMB + META ROW */}
      <div style={{ background: T.bg, paddingTop: '32px' }}>
        <div className="pp-container">
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingBottom: '16px',
            borderBottom: `1px solid ${T.border}`,
            flexWrap: 'wrap',
            gap: '16px',
          }}>
            <div style={{
              fontFamily: 'var(--font-sans)',
              fontSize: '11px',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: T.muted,
            }}>
              <a href="#" onClick={(e) => { e.preventDefault(); go('/'); }} style={{ color: T.muted, textDecoration: 'none' }}>HOME</a>
              {' / '}
              <span style={{ color: T.espresso, fontWeight: 500 }}>PRIVACY POLICY</span>
            </div>
            
            <div style={{
              fontFamily: 'var(--font-sans)',
              fontSize: '11px',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: T.muted,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}>
              <span style={{ fontSize: '6px' }}>●</span>
              VERSION 3.4 • ACTIVE DOCUMENT
            </div>
          </div>
        </div>
      </div>

      <div style={{ background: T.bg }}>
        <div className="pp-container">
          {/* TABLET TOC (Horizontal scroll) */}
          <div className="pp-tablet-toc">
            {SECTIONS.map((s) => (
              <button
                key={s.id}
                onClick={() => scrollToSection(s.id)}
                style={{
                  background: activeSection === s.id ? T.espresso : 'transparent',
                  color: activeSection === s.id ? '#FFF' : T.muted,
                  border: `1px solid ${activeSection === s.id ? T.espresso : T.border}`,
                  borderRadius: '20px',
                  padding: '6px 16px',
                  fontSize: '12px',
                  fontFamily: 'var(--font-sans)',
                  whiteSpace: 'nowrap',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                {s.title}
              </button>
            ))}
          </div>

          <div className="pp-layout">
            {/* LEFT SIDEBAR (Desktop) / MOBILE ACCORDION */}
            <div>
              <div className="pp-mobile-toc">
                <button
                  onClick={() => setMobileTocOpen(!mobileTocOpen)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    background: T.bgAlt,
                    border: `1px solid ${T.border}`,
                    borderRadius: '8px',
                    padding: '16px 20px',
                    fontFamily: 'var(--font-sans)',
                    fontSize: '13px',
                    fontWeight: 600,
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    color: T.espresso,
                    cursor: 'pointer',
                  }}
                >
                  Contents
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ transform: mobileTocOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.3s' }}>
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </button>
                
                {mobileTocOpen && (
                  <div style={{
                    marginTop: '8px',
                    background: T.bg,
                    border: `1px solid ${T.border}`,
                    borderRadius: '8px',
                    padding: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                  }}>
                    {SECTIONS.map((s, idx) => (
                      <button
                        key={s.id}
                        onClick={() => scrollToSection(s.id)}
                        style={{
                          display: 'flex',
                          gap: '12px',
                          background: 'none',
                          border: 'none',
                          padding: 0,
                          textAlign: 'left',
                          fontFamily: 'var(--font-sans)',
                          fontSize: '14px',
                          color: activeSection === s.id ? T.espresso : T.muted,
                          fontWeight: activeSection === s.id ? 600 : 400,
                          cursor: 'pointer',
                        }}
                      >
                        <span style={{ color: T.muted }}>{s.num}.</span>
                        <span>{s.title}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="pp-sidebar">
                <span style={{
                  display: 'block',
                  fontFamily: 'var(--font-sans)',
                  fontSize: '10px',
                  letterSpacing: '0.16em',
                  textTransform: 'uppercase',
                  color: T.muted,
                  fontWeight: 600,
                  marginBottom: '24px',
                }}>
                  Contents
                </span>

                <nav style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {SECTIONS.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => scrollToSection(s.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'baseline',
                        gap: '12px',
                        background: 'none',
                        border: 'none',
                        padding: 0,
                        textAlign: 'left',
                        fontFamily: 'var(--font-sans)',
                        fontSize: '14px',
                        lineHeight: 1.5,
                        color: activeSection === s.id ? T.espresso : T.muted,
                        fontWeight: activeSection === s.id ? 600 : 400,
                        cursor: 'pointer',
                        transition: 'color 0.2s',
                      }}
                      onMouseEnter={(e) => {
                        if (activeSection !== s.id) e.currentTarget.style.color = T.espresso;
                      }}
                      onMouseLeave={(e) => {
                        if (activeSection !== s.id) e.currentTarget.style.color = T.muted;
                      }}
                    >
                      <span style={{ 
                        fontSize: '12px', 
                        color: activeSection === s.id ? T.espresso : T.muted,
                        opacity: activeSection === s.id ? 1 : 0.6
                      }}>
                        {parseInt(s.num, 10)}.
                      </span>
                      <span>{s.title}</span>
                    </button>
                  ))}
                </nav>

                <div style={{ marginTop: '64px', paddingTop: '32px', borderTop: `1px solid ${T.border}` }}>
                  <span style={{
                    display: 'block',
                    fontFamily: 'var(--font-sans)',
                    fontSize: '10px',
                    letterSpacing: '0.16em',
                    textTransform: 'uppercase',
                    color: T.muted,
                    fontWeight: 600,
                    marginBottom: '12px',
                  }}>
                    Concierge Support
                  </span>
                  <p style={{
                    margin: '0 0 16px',
                    fontFamily: 'var(--font-sans)',
                    fontSize: '13px',
                    lineHeight: 1.6,
                    color: T.muted,
                  }}>
                    Need personal clarification regarding your data or regional privacy rights?
                  </p>
                  <button
                    onClick={() => go('/help')}
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      fontFamily: 'var(--font-sans)',
                      fontSize: '11px',
                      fontWeight: 600,
                      letterSpacing: '0.16em',
                      textTransform: 'uppercase',
                      color: T.espresso,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    Contact our team →
                  </button>
                </div>
              </div>
            </div>

            {/* RIGHT CONTENT */}
            <div style={{ minWidth: 0 }}>
              
              {/* 01 Information We Collect */}
              <section id="information-we-collect" className="pp-section">
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
                  <span style={{ fontFamily: 'var(--font-serif)', fontSize: '24px', color: T.terracotta, opacity: 0.8 }}>01</span>
                  <h2 style={{ margin: 0, fontFamily: 'var(--font-serif)', fontSize: 'clamp(28px, 4vw, 36px)', fontWeight: 400, color: T.espresso }}>
                    Information We Collect
                  </h2>
                </div>
                
                <p style={{ margin: 0, fontFamily: 'var(--font-sans)', fontSize: '15px', lineHeight: 1.8, color: T.muted }}>
                  NovaShop collects information to deliver an effortless, bespoke shopping experience. Depending on your engagement with our platform, we gather specific categories of information essential for order execution and tailored concierge support:
                </p>

                <div className="pp-card-grid-1">
                  {[
                    { title: 'Personal Information', desc: 'Name, email address, billing and shipping addresses, telephone number, and encrypted credentials provided when you register an account or complete a client checkout.' },
                    { title: 'Transactional Details', desc: 'Order history, garment preferences, bespoke sizing specifications, and verification data processed strictly via certified payment gateways.' },
                    { title: 'Device and Usage Data', desc: 'IP address, browser specification, operating system, viewing patterns, referring channels, and interaction metrics to ensure optimal architectural rendering across your personal devices.' },
                    { title: 'Communications', desc: 'Inquiries, feedback records, and preference notes submitted when contacting our concierge or subscribing to private seasonal lookbooks.' }
                  ].map((card, i) => (
                    <div key={i} style={{ background: T.bgAlt, borderRadius: '8px', padding: '24px' }}>
                      <h3 style={{ margin: '0 0 8px', fontFamily: 'var(--font-sans)', fontSize: '15px', fontWeight: 600, color: T.espresso }}>
                        {card.title}
                      </h3>
                      <p style={{ margin: 0, fontFamily: 'var(--font-sans)', fontSize: '14px', lineHeight: 1.6, color: T.muted }}>
                        {card.desc}
                      </p>
                    </div>
                  ))}
                </div>
              </section>

              {/* 02 How We Use Your Information */}
              <section id="how-we-use-information" className="pp-section">
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
                  <span style={{ fontFamily: 'var(--font-serif)', fontSize: '24px', color: T.terracotta, opacity: 0.8 }}>02</span>
                  <h2 style={{ margin: 0, fontFamily: 'var(--font-serif)', fontSize: 'clamp(28px, 4vw, 36px)', fontWeight: 400, color: T.espresso }}>
                    How We Use Your Information
                  </h2>
                </div>

                <p style={{ margin: '0 0 32px', fontFamily: 'var(--font-sans)', fontSize: '15px', lineHeight: 1.8, color: T.muted }}>
                  We handle collected information exclusively for transparent, legitimate operational objectives aligned with providing fine atelier goods and client care:
                </p>

                <div className="pp-card-grid-1" style={{ marginTop: 0 }}>
                  {[
                    'Order fulfillment, bespoke packaging handling, shipment tracking notifications, and door-to-door delivery coordination.',
                    'Client account administration, private wishlist preservation, and multi-factor identity authentication.',
                    'Customer care dialogue, return and exchange processing, and tailored garment maintenance advice.',
                    'Optimizing site performance, monitoring inventory availability, and curating restrained, relevant browsing selections.',
                    'Fraud mitigation, network integrity audits, and adherence to international commercial standards.'
                  ].map((text, i) => (
                    <div key={i} className="pp-row-card" style={{ alignItems: 'center' }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={T.espresso} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                        <polyline points="20 6 9 17 4 12"></polyline>
                      </svg>
                      <p style={{ margin: 0, fontFamily: 'var(--font-sans)', fontSize: '14px', lineHeight: 1.6, color: T.muted }}>
                        {text}
                      </p>
                    </div>
                  ))}
                </div>
              </section>

              {/* 03 Cookies & Similar Technologies */}
              <section id="cookies-technologies" className="pp-section">
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
                  <span style={{ fontFamily: 'var(--font-serif)', fontSize: '24px', color: T.terracotta, opacity: 0.8 }}>03</span>
                  <h2 style={{ margin: 0, fontFamily: 'var(--font-serif)', fontSize: 'clamp(28px, 4vw, 36px)', fontWeight: 400, color: T.espresso }}>
                    Cookies & Similar Technologies
                  </h2>
                </div>

                <p style={{ margin: 0, fontFamily: 'var(--font-sans)', fontSize: '15px', lineHeight: 1.8, color: T.muted }}>
                  Our digital boutique employs restrained cookie configurations and lightweight web markers to provide seamless continuity throughout your browsing journey.
                </p>

                <div className="pp-card-grid-3">
                  {[
                    { title: 'Essential', desc: 'Vital for fundamental navigation, bag item persistence across tabs, and encrypted checkout access.' },
                    { title: 'Preferences', desc: 'Retains your currency selections, regional measurements, and bespoke display layouts.' },
                    { title: 'Analytical', desc: 'Aggregated, pseudonymized statistics that assist in identifying friction and improving storefront speed.' }
                  ].map((card, i) => (
                    <div key={i} style={{ border: `1px solid ${T.border}`, borderRadius: '8px', padding: '24px' }}>
                      <h3 style={{ margin: '0 0 8px', fontFamily: 'var(--font-sans)', fontSize: '15px', fontWeight: 600, color: T.espresso }}>
                        {card.title}
                      </h3>
                      <p style={{ margin: 0, fontFamily: 'var(--font-sans)', fontSize: '13px', lineHeight: 1.6, color: T.muted }}>
                        {card.desc}
                      </p>
                    </div>
                  ))}
                </div>

                <p style={{ margin: '0 0 24px', fontFamily: 'var(--font-sans)', fontSize: '14px', lineHeight: 1.8, color: T.muted }}>
                  You may adjust or deactivate cookies at any moment through your internet browser preferences. Note that disabling essential cookies may impact certain commerce capabilities, including checkout completion.
                </p>
                
                <button
                  type="button"
                  onClick={() => setCookieModalOpen(true)}
                  style={{
                    background: 'transparent',
                    color: T.espresso,
                    border: `1px solid ${T.espresso}`,
                    cursor: 'pointer',
                    fontFamily: 'var(--font-sans)',
                    fontSize: '11px',
                    fontWeight: 600,
                    letterSpacing: '0.16em',
                    textTransform: 'uppercase',
                    padding: '12px 24px',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = T.espresso; e.currentTarget.style.color = '#FFF'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = T.espresso; }}
                >
                  Manage Cookie Preferences
                </button>
              </section>

              {/* 04 How We Share Information */}
              <section id="how-we-share-information" className="pp-section">
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
                  <span style={{ fontFamily: 'var(--font-serif)', fontSize: '24px', color: T.terracotta, opacity: 0.8 }}>04</span>
                  <h2 style={{ margin: 0, fontFamily: 'var(--font-serif)', fontSize: 'clamp(28px, 4vw, 36px)', fontWeight: 400, color: T.espresso }}>
                    How We Share Information
                  </h2>
                </div>

                <div style={{
                  background: '#EAE6E1',
                  borderLeft: `4px solid ${T.espresso}`,
                  padding: '24px',
                  marginBottom: '24px',
                  borderRadius: '0 8px 8px 0',
                }}>
                  <p style={{ margin: 0, fontFamily: 'var(--font-sans)', fontSize: '15px', fontWeight: 500, lineHeight: 1.6, color: T.espresso }}>
                    NovaShop does not sell, rent, or trade your personal information to marketing brokers or unrelated third parties under any circumstances.
                  </p>
                </div>

                <p style={{ margin: 0, fontFamily: 'var(--font-sans)', fontSize: '15px', lineHeight: 1.8, color: T.muted }}>
                  Information disclosure is confined exclusively to carefully vetted partners bound by non-disclosure and strict confidentiality agreements:
                </p>

                <div className="pp-card-grid-1">
                  {[
                    { title: 'Logistics & Courier Partners', desc: 'Designated delivery partners receive recipient names, destination coordinates, and phone numbers strictly to facilitate secure physical transit and delivery notifications.' },
                    { title: 'Payment Processors', desc: 'Regulated payment institutions handle encrypted token transmissions adhering to international data security standards (PCI-DSS compliant).' },
                    { title: 'Cloud & Infrastructure Support', desc: 'Encrypted database infrastructure and transactional email gateways maintaining continuous storefront stability.' },
                    { title: 'Legal Compliance', desc: 'Disclosures made solely when required by enforceable judicial order, statutory regulation, or lawful official inquiry.' }
                  ].map((card, i) => (
                    <div key={i} style={{ background: T.bgAlt, borderRadius: '8px', padding: '24px' }}>
                      <h3 style={{ margin: '0 0 8px', fontFamily: 'var(--font-sans)', fontSize: '15px', fontWeight: 600, color: T.espresso }}>
                        {card.title}
                      </h3>
                      <p style={{ margin: 0, fontFamily: 'var(--font-sans)', fontSize: '14px', lineHeight: 1.6, color: T.muted }}>
                        {card.desc}
                      </p>
                    </div>
                  ))}
                </div>
              </section>

              {/* 05 Data Security */}
              <section id="data-security" className="pp-section">
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
                  <span style={{ fontFamily: 'var(--font-serif)', fontSize: '24px', color: T.terracotta, opacity: 0.8 }}>05</span>
                  <h2 style={{ margin: 0, fontFamily: 'var(--font-serif)', fontSize: 'clamp(28px, 4vw, 36px)', fontWeight: 400, color: T.espresso }}>
                    Data Security
                  </h2>
                </div>

                <p style={{ margin: 0, fontFamily: 'var(--font-sans)', fontSize: '15px', lineHeight: 1.8, color: T.muted }}>
                  We employ rigorous architectural protocols to protect your personal details against unauthorized access, loss, or manipulation:
                </p>

                <div className="pp-card-grid-2">
                  <div className="pp-row-card" style={{ flexDirection: 'column' }}>
                    <div style={{ background: '#FFF', padding: '10px', borderRadius: '50%', border: `1px solid ${T.border}`, marginBottom: '8px' }}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={T.espresso} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                      </svg>
                    </div>
                    <h3 style={{ margin: '0 0 8px', fontFamily: 'var(--font-sans)', fontSize: '15px', fontWeight: 600, color: T.espresso }}>
                      SSL/TLS Encryption
                    </h3>
                    <p style={{ margin: 0, fontFamily: 'var(--font-sans)', fontSize: '14px', lineHeight: 1.6, color: T.muted }}>
                      Full cryptographic transit protection across all web pathways, browsing sessions, and checkout portals.
                    </p>
                  </div>
                  
                  <div className="pp-row-card" style={{ flexDirection: 'column' }}>
                    <div style={{ background: '#FFF', padding: '10px', borderRadius: '50%', border: `1px solid ${T.border}`, marginBottom: '8px' }}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={T.espresso} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M2 22 22 2"/><path d="M14 2 4 12v6h6l10-10"/><path d="M12.5 4.5 17 9"/>
                      </svg>
                    </div>
                    <h3 style={{ margin: '0 0 8px', fontFamily: 'var(--font-sans)', fontSize: '15px', fontWeight: 600, color: T.espresso }}>
                      Zero Raw Card Storage
                    </h3>
                    <p style={{ margin: 0, fontFamily: 'var(--font-sans)', fontSize: '14px', lineHeight: 1.6, color: T.muted }}>
                      Complete tokenization ensuring unencrypted payment card values are never retained within our digital environment.
                    </p>
                  </div>
                </div>

                <p style={{ margin: 0, fontFamily: 'var(--font-sans)', fontSize: '14px', lineHeight: 1.8, color: T.muted }}>
                  While we apply comprehensive safeguards in line with premier standards, no method of transmission over the open internet or electronic repository can be guaranteed completely impenetrable. We encourage clients to select resilient account passwords and maintain individual device vigilance.
                </p>
              </section>

              {/* 06 Your Rights and Choices */}
              <section id="your-rights-choices" className="pp-section">
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
                  <span style={{ fontFamily: 'var(--font-serif)', fontSize: '24px', color: T.terracotta, opacity: 0.8 }}>06</span>
                  <h2 style={{ margin: 0, fontFamily: 'var(--font-serif)', fontSize: 'clamp(28px, 4vw, 36px)', fontWeight: 400, color: T.espresso }}>
                    Your Rights and Choices
                  </h2>
                </div>

                <p style={{ margin: '0 0 32px', fontFamily: 'var(--font-sans)', fontSize: '15px', lineHeight: 1.8, color: T.muted }}>
                  Regardless of your geographic location, we respect your sovereignty over your personal data. You possess the following direct rights regarding your records:
                </p>

                <div className="pp-card-grid-1" style={{ marginTop: 0 }}>
                  {[
                    { label: 'ACCESS & COPY', text: 'Request an organized export of the personal information NovaShop maintains regarding your profile.' },
                    { label: 'RECTIFICATION', text: 'Correct inaccurate, outdated, or incomplete records at any point directly within your Client Preferences or via concierge request.' },
                    { label: 'ERASURE', text: 'Request comprehensive deletion of your stored information, subject to mandatory tax, accounting, or active order fulfillment obligations.' },
                    { label: 'COMMUNICATIONS', text: 'Opt out of seasonal editorial updates with an immediate single click via the unsubscribe mechanism at the footer of any communication.' }
                  ].map((row, i) => (
                    <div key={i} className="pp-row-card">
                      <div style={{ width: '140px', flexShrink: 0 }}>
                        <span style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', letterSpacing: '0.1em', fontWeight: 600, color: T.muted, textTransform: 'uppercase' }}>
                          {row.label}
                        </span>
                      </div>
                      <p style={{ margin: 0, fontFamily: 'var(--font-sans)', fontSize: '14px', lineHeight: 1.6, color: T.muted }}>
                        {row.text}
                      </p>
                    </div>
                  ))}
                </div>
              </section>

              {/* 07 Data Retention */}
              <section id="data-retention" className="pp-section">
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
                  <span style={{ fontFamily: 'var(--font-serif)', fontSize: '24px', color: T.terracotta, opacity: 0.8 }}>07</span>
                  <h2 style={{ margin: 0, fontFamily: 'var(--font-serif)', fontSize: 'clamp(28px, 4vw, 36px)', fontWeight: 400, color: T.espresso }}>
                    Data Retention
                  </h2>
                </div>

                <p style={{ margin: '0 0 16px', fontFamily: 'var(--font-sans)', fontSize: '15px', lineHeight: 1.8, color: T.muted }}>
                  NovaShop retains collected personal details only for the duration necessary to satisfy the objectives delineated in this document, sustain active client profiles, resolve queries, and fulfill compulsory financial, legal, and operational reporting periods.
                </p>
                <p style={{ margin: 0, fontFamily: 'var(--font-sans)', fontSize: '15px', lineHeight: 1.8, color: T.muted }}>
                  When retention terms lapse, records are either securely purged through irreversible data erasure protocols or pseudonymized beyond reconstruction for aggregate analytical evaluations.
                </p>
              </section>

              {/* 08 Children's Privacy */}
              <section id="childrens-privacy" className="pp-section">
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
                  <span style={{ fontFamily: 'var(--font-serif)', fontSize: '24px', color: T.terracotta, opacity: 0.8 }}>08</span>
                  <h2 style={{ margin: 0, fontFamily: 'var(--font-serif)', fontSize: 'clamp(28px, 4vw, 36px)', fontWeight: 400, color: T.espresso }}>
                    Children's Privacy
                  </h2>
                </div>

                <p style={{ margin: 0, fontFamily: 'var(--font-sans)', fontSize: '15px', lineHeight: 1.8, color: T.muted }}>
                  Our atelier offerings and commercial services are strictly intended for adults and individuals aged sixteen and older. NovaShop does not intentionally or knowingly solicit or retain records from minors under the age of 16. If we ascertain that personal details of a minor have been inadvertently captured without verified legal guardian authorization, we promptly and permanently remove the corresponding data files.
                </p>
              </section>

              {/* 09 Changes to This Policy */}
              <section id="changes-to-this-policy" className="pp-section">
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
                  <span style={{ fontFamily: 'var(--font-serif)', fontSize: '24px', color: T.terracotta, opacity: 0.8 }}>09</span>
                  <h2 style={{ margin: 0, fontFamily: 'var(--font-serif)', fontSize: 'clamp(28px, 4vw, 36px)', fontWeight: 400, color: T.espresso }}>
                    Changes to This Policy
                  </h2>
                </div>

                <p style={{ margin: '0 0 16px', fontFamily: 'var(--font-sans)', fontSize: '15px', lineHeight: 1.8, color: T.muted }}>
                  We reserve the discretion to update this Privacy Policy periodically to accommodate modifications in our organizational procedures, collection paradigms, or prevailing regulatory mandates.
                </p>
                <p style={{ margin: 0, fontFamily: 'var(--font-sans)', fontSize: '15px', lineHeight: 1.8, color: T.muted }}>
                  All revisions become active immediately upon publication on this platform. The date of the most recent revision will continuously be visible at the top of this document. Continued engagement with our digital boutique after revisions denotes acknowledgment of the revised provisions.
                </p>
              </section>

              {/* 10 Questions or Privacy Requests */}
              <section id="contact-us" className="pp-section">
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
                  <span style={{ fontFamily: 'var(--font-serif)', fontSize: '24px', color: T.terracotta, opacity: 0.8 }}>10</span>
                  <h2 style={{ margin: 0, fontFamily: 'var(--font-serif)', fontSize: 'clamp(28px, 4vw, 36px)', fontWeight: 400, color: T.espresso }}>
                    Questions or Privacy Requests
                  </h2>
                </div>

                <p style={{ margin: '0 0 32px', fontFamily: 'var(--font-sans)', fontSize: '15px', lineHeight: 1.8, color: T.muted }}>
                  If you have any questions about this Privacy Policy, your personal information, or wish to exercise your data rights, please contact our team:
                </p>

                <div className="pp-card-grid-2" style={{ marginTop: 0 }}>
                  <div style={{ border: `1px solid ${T.border}`, padding: '24px', borderRadius: '8px' }}>
                    <span style={{ display: 'block', fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.12em', color: T.muted, textTransform: 'uppercase', marginBottom: '8px', fontWeight: 600 }}>
                      DIRECT PRIVACY DESK
                    </span>
                    <a href="mailto:privacy@novashop.com" style={{ fontFamily: 'var(--font-sans)', fontSize: '15px', fontWeight: 600, color: T.espresso, textDecoration: 'none' }}>
                      privacy@novashop.com
                    </a>
                  </div>
                  
                  <div style={{ border: `1px solid ${T.border}`, padding: '24px', borderRadius: '8px' }}>
                    <span style={{ display: 'block', fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.12em', color: T.muted, textTransform: 'uppercase', marginBottom: '8px', fontWeight: 600 }}>
                      RESPONSE COMMITMENT
                    </span>
                    <span style={{ fontFamily: 'var(--font-sans)', fontSize: '15px', color: T.espresso }}>
                      Within 30 business days
                    </span>
                  </div>
                </div>

                <div style={{
                  background: T.bgAlt,
                  border: `1px solid ${T.border}`,
                  borderRadius: '12px',
                  padding: '32px 40px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '24px',
                }}>
                  <p style={{ margin: 0, fontFamily: 'var(--font-sans)', fontSize: '15px', lineHeight: 1.6, color: T.muted, maxWidth: '400px' }}>
                    Require expedited assistance regarding an active shipment or order?
                  </p>
                  <button
                    onClick={() => go('/help')}
                    style={{
                      background: T.espresso,
                      color: '#FFF',
                      border: 'none',
                      padding: '14px 32px',
                      fontFamily: 'var(--font-sans)',
                      fontSize: '11px',
                      fontWeight: 600,
                      letterSpacing: '0.16em',
                      textTransform: 'uppercase',
                      cursor: 'pointer',
                      transition: 'opacity 0.2s',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.opacity = 0.8}
                    onMouseLeave={(e) => e.currentTarget.style.opacity = 1}
                  >
                    Contact Customer Care
                  </button>
                </div>
              </section>

            </div>
          </div>
        </div>
      </div>

      {/* COOKIE MODAL */}
      {cookieModalOpen && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(35,30,27,0.4)',
          backdropFilter: 'blur(4px)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
        }}>
          <div style={{
            background: T.bg,
            borderRadius: '16px',
            width: '100%',
            maxWidth: '500px',
            boxShadow: '0 24px 48px rgba(0,0,0,0.1)',
            overflow: 'hidden',
          }}>
            <div style={{ padding: '32px', borderBottom: `1px solid ${T.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0, fontFamily: 'var(--font-serif)', fontSize: '24px', color: T.espresso }}>
                Cookie Preferences
              </h2>
              <button onClick={() => setCookieModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: T.muted }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
              </button>
            </div>
            
            <div style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
                <div>
                  <h3 style={{ margin: '0 0 4px', fontFamily: 'var(--font-sans)', fontSize: '15px', fontWeight: 600, color: T.espresso }}>Essential Cookies</h3>
                  <p style={{ margin: 0, fontFamily: 'var(--font-sans)', fontSize: '13px', color: T.muted, lineHeight: 1.5 }}>Always enabled to ensure fundamental site functionality.</p>
                </div>
                <label className="toggle-switch">
                  <input type="checkbox" checked disabled />
                  <span className="slider"></span>
                </label>
              </div>

              <div style={{ borderTop: `1px solid ${T.border}` }} />

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
                <div>
                  <h3 style={{ margin: '0 0 4px', fontFamily: 'var(--font-sans)', fontSize: '15px', fontWeight: 600, color: T.espresso }}>Preferences Cookies</h3>
                  <p style={{ margin: 0, fontFamily: 'var(--font-sans)', fontSize: '13px', color: T.muted, lineHeight: 1.5 }}>Retains your selections such as currency and region.</p>
                </div>
                <label className="toggle-switch">
                  <input 
                    type="checkbox" 
                    checked={consent.preferences} 
                    onChange={(e) => setConsent(c => ({ ...c, preferences: e.target.checked }))}
                  />
                  <span className="slider"></span>
                </label>
              </div>

              <div style={{ borderTop: `1px solid ${T.border}` }} />

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
                <div>
                  <h3 style={{ margin: '0 0 4px', fontFamily: 'var(--font-sans)', fontSize: '15px', fontWeight: 600, color: T.espresso }}>Analytical Cookies</h3>
                  <p style={{ margin: 0, fontFamily: 'var(--font-sans)', fontSize: '13px', color: T.muted, lineHeight: 1.5 }}>Aggregated statistics for improving storefront performance.</p>
                </div>
                <label className="toggle-switch">
                  <input 
                    type="checkbox" 
                    checked={consent.analytical} 
                    onChange={(e) => setConsent(c => ({ ...c, analytical: e.target.checked }))}
                  />
                  <span className="slider"></span>
                </label>
              </div>
            </div>

            <div style={{ padding: '24px 32px', background: T.bgAlt, borderTop: `1px solid ${T.border}`, display: 'flex', justifyContent: 'flex-end', gap: '16px' }}>
              <button 
                onClick={() => setCookieModalOpen(false)}
                style={{ background: 'none', border: 'none', fontFamily: 'var(--font-sans)', fontSize: '13px', fontWeight: 600, color: T.muted, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveCookies}
                style={{
                  background: T.espresso, color: '#FFF', border: 'none', padding: '12px 24px', borderRadius: '4px',
                  fontFamily: 'var(--font-sans)', fontSize: '13px', fontWeight: 600, cursor: 'pointer'
                }}
              >
                Save Preferences
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TOAST */}
      {toastMessage && (
        <div style={{
          position: 'fixed',
          bottom: '32px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: T.espresso,
          color: '#FFF',
          padding: '12px 24px',
          borderRadius: '30px',
          fontFamily: 'var(--font-sans)',
          fontSize: '13px',
          fontWeight: 500,
          boxShadow: '0 12px 24px rgba(35,30,27,0.2)',
          zIndex: 2000,
          animation: 'slideUpFade 0.3s cubic-bezier(0.4,0,0.2,1) forwards',
        }}>
          {toastMessage}
        </div>
      )}
    </>
  );
}
