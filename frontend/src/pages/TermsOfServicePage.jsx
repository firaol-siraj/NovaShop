import { useEffect } from 'react';

const T = {
  bg: 'var(--bg-main)',
  bgAlt: 'var(--bg-surface)',
  espresso: 'var(--text-primary)',
  muted: 'var(--text-secondary)',
  border: 'var(--border-default)',
  terracotta: 'var(--color-accent, #9B4A3A)',
};

const SECTIONS = [
  { id: 'acceptance',         num: '01', title: 'Acceptance of Terms' },
  { id: 'use-of-site',        num: '02', title: 'Use of the Site' },
  { id: 'account-membership', num: '03', title: 'Account & Membership' },
  { id: 'orders-payment',     num: '04', title: 'Orders & Payment' },
  { id: 'intellectual-property', num: '05', title: 'Intellectual Property' },
  { id: 'disclaimers',        num: '06', title: 'Disclaimers' },
  { id: 'limitation-liability', num: '07', title: 'Limitation of Liability' },
  { id: 'governing-law',      num: '08', title: 'Governing Law' },
  { id: 'changes',            num: '09', title: 'Changes to These Terms' },
  { id: 'contact',            num: '10', title: 'Contact' },
];

function SectionHeading({ num, children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
      <span style={{ fontFamily: 'var(--font-serif)', fontSize: '24px', color: T.terracotta, opacity: 0.8 }}>{num}</span>
      <h2 style={{ margin: 0, fontFamily: 'var(--font-serif)', fontSize: 'clamp(24px, 4vw, 32px)', fontWeight: 400, color: T.espresso }}>
        {children}
      </h2>
    </div>
  );
}

function Body({ children, spaceBottom = true }) {
  return (
    <p style={{ margin: spaceBottom ? '0 0 16px' : 0, fontFamily: 'var(--font-sans)', fontSize: '15px', lineHeight: 1.8, color: T.muted }}>
      {children}
    </p>
  );
}

export default function TermsOfServicePage({ go }) {
  useEffect(() => { window.scrollTo(0, 0); }, []);

  const scrollTo = (id) => {
    const el = document.getElementById(id);
    if (el) {
      const y = el.getBoundingClientRect().top + window.scrollY - 120;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
  };

  return (
    <>
      <style>{`
        .tos-container { max-width: 1200px; margin: 0 auto; padding: 0 clamp(24px,6vw,48px); }
        .tos-layout {
          display: grid;
          grid-template-columns: 220px 1fr;
          gap: clamp(48px,8vw,96px);
          padding: 64px 0 120px;
          align-items: start;
        }
        .tos-sidebar { position: sticky; top: 120px; }
        .tos-section { scroll-margin-top: 120px; margin-bottom: 72px; }
        .tos-section:last-child { margin-bottom: 0; }
        @media (max-width: 1023px) {
          .tos-layout { grid-template-columns: 1fr; padding-top: 32px; }
          .tos-sidebar { display: none; }
        }
        @media (max-width: 767px) {
          .tos-container { padding: 0 24px; }
        }
      `}</style>

      {/* Breadcrumb */}
      <div style={{ background: T.bg, paddingTop: '32px' }}>
        <div className="tos-container">
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            paddingBottom: '16px', borderBottom: `1px solid ${T.border}`,
            flexWrap: 'wrap', gap: '16px',
          }}>
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', letterSpacing: '0.12em', textTransform: 'uppercase', color: T.muted }}>
              <button onClick={() => go('/')} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: T.muted, fontFamily: 'inherit', fontSize: 'inherit', letterSpacing: 'inherit', textTransform: 'inherit' }}>HOME</button>
              {' / '}
              <span style={{ color: T.espresso, fontWeight: 500 }}>TERMS OF SERVICE</span>
            </div>
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', letterSpacing: '0.08em', textTransform: 'uppercase', color: T.muted, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '6px' }}>●</span>
              EFFECTIVE DATE: JANUARY 1, 2026
            </div>
          </div>
        </div>
      </div>

      <div style={{ background: T.bg }}>
        <div className="tos-container">
          <div className="tos-layout">

            {/* Sidebar TOC */}
            <div className="tos-sidebar">
              <span style={{ display: 'block', fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.16em', textTransform: 'uppercase', color: T.muted, fontWeight: 600, marginBottom: '24px' }}>
                Contents
              </span>
              <nav style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {SECTIONS.map(s => (
                  <button
                    key={s.id}
                    onClick={() => scrollTo(s.id)}
                    style={{ display: 'flex', alignItems: 'baseline', gap: '10px', background: 'none', border: 'none', padding: 0, textAlign: 'left', fontFamily: 'var(--font-sans)', fontSize: '13px', color: T.muted, cursor: 'pointer', transition: 'color 0.2s' }}
                    onMouseEnter={e => (e.currentTarget.style.color = T.espresso)}
                    onMouseLeave={e => (e.currentTarget.style.color = T.muted)}
                  >
                    <span style={{ fontSize: '11px', opacity: 0.6 }}>{parseInt(s.num, 10)}.</span>
                    <span>{s.title}</span>
                  </button>
                ))}
              </nav>
              <div style={{ marginTop: '48px', paddingTop: '28px', borderTop: `1px solid ${T.border}` }}>
                <p style={{ margin: '0 0 12px', fontFamily: 'var(--font-sans)', fontSize: '13px', lineHeight: 1.6, color: T.muted }}>
                  Questions about these terms?
                </p>
                <button onClick={() => go('/help')} style={{ background: 'none', border: 'none', padding: 0, fontFamily: 'var(--font-sans)', fontSize: '11px', fontWeight: 600, letterSpacing: '0.16em', textTransform: 'uppercase', color: T.espresso, cursor: 'pointer' }}>
                  Contact our team →
                </button>
              </div>
            </div>

            {/* Content */}
            <div style={{ minWidth: 0 }}>

              <section id="acceptance" className="tos-section">
                <SectionHeading num="01">Acceptance of Terms</SectionHeading>
                <Body>By accessing or using the NovaShop website (the "Site"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree to these Terms, please do not use the Site.</Body>
                <Body spaceBottom={false}>These Terms apply to all visitors, users, and clients of the Site and govern all transactions conducted through it. Your continued use of the Site constitutes ongoing acceptance of any updates to these Terms.</Body>
              </section>

              <section id="use-of-site" className="tos-section">
                <SectionHeading num="02">Use of the Site</SectionHeading>
                <Body>You agree to use the Site only for lawful purposes and in a manner that does not infringe the rights of others. You must not:</Body>
                {[
                  'Use the Site in any way that violates applicable local, national, or international laws.',
                  'Transmit unsolicited promotional material or engage in any form of fraudulent conduct.',
                  'Attempt to gain unauthorized access to any part of the Site or its infrastructure.',
                  'Use automated scripts, bots, or data mining tools without prior written consent.',
                ].map((item, i) => (
                  <div key={i} style={{ display: 'flex', gap: '12px', padding: '12px 16px', marginBottom: '8px', background: T.bgAlt, borderRadius: '6px' }}>
                    <span style={{ fontFamily: 'var(--font-sans)', fontSize: '14px', color: T.muted, lineHeight: 1.6 }}>{item}</span>
                  </div>
                ))}
              </section>

              <section id="account-membership" className="tos-section">
                <SectionHeading num="03">Account & Membership</SectionHeading>
                <Body>To access certain features — including order history, saved pieces, and bespoke checkout — you may be required to create an account. You are responsible for maintaining the confidentiality of your credentials and for all activity that occurs under your account.</Body>
                <Body spaceBottom={false}>You agree to notify us immediately of any unauthorized use of your account. NovaShop reserves the right to suspend or terminate accounts that violate these Terms or engage in fraudulent activity.</Body>
              </section>

              <section id="orders-payment" className="tos-section">
                <SectionHeading num="04">Orders & Payment</SectionHeading>
                <Body>All orders placed through the Site are subject to acceptance and availability. We reserve the right to refuse or cancel any order at our discretion, including in cases of pricing errors or suspected fraud.</Body>
                <Body>Prices displayed are in the selected currency and inclusive of applicable taxes where required by law. Payment is processed securely via certified third-party payment gateways — NovaShop does not store raw payment card information.</Body>
                <Body spaceBottom={false}>For shipping and return conditions, please refer to our <button onClick={() => go('/shipping-returns')} style={{ background: 'none', border: 'none', padding: 0, color: T.espresso, textDecoration: 'underline', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: '15px' }}>Shipping & Returns</button> page.</Body>
              </section>

              <section id="intellectual-property" className="tos-section">
                <SectionHeading num="05">Intellectual Property</SectionHeading>
                <Body>All content on the Site — including but not limited to text, photography, editorial images, brand identity, and design — is the exclusive property of NovaShop or its licensed partners and is protected by applicable copyright, trademark, and intellectual property laws.</Body>
                <Body spaceBottom={false}>You may not reproduce, distribute, modify, or create derivative works from any Site content without explicit prior written permission from NovaShop.</Body>
              </section>

              <section id="disclaimers" className="tos-section">
                <SectionHeading num="06">Disclaimers</SectionHeading>
                <Body>The Site is provided on an "as is" and "as available" basis. NovaShop makes no warranties, express or implied, regarding the accuracy, reliability, or availability of any content or service provided through the Site.</Body>
                <Body spaceBottom={false}>To the maximum extent permitted by law, NovaShop expressly disclaims all warranties, including implied warranties of merchantability, fitness for a particular purpose, and non-infringement.</Body>
              </section>

              <section id="limitation-liability" className="tos-section">
                <SectionHeading num="07">Limitation of Liability</SectionHeading>
                <Body>To the fullest extent permitted by applicable law, NovaShop shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of, or inability to use, the Site or its services — even if NovaShop has been advised of the possibility of such damages.</Body>
                <Body spaceBottom={false}>Our total liability shall not exceed the amount paid by you for the relevant product or service giving rise to the claim.</Body>
              </section>

              <section id="governing-law" className="tos-section">
                <SectionHeading num="08">Governing Law</SectionHeading>
                <Body spaceBottom={false}>These Terms shall be governed by and construed in accordance with applicable commercial law. Any disputes arising in connection with these Terms shall be subject to the exclusive jurisdiction of the courts of the applicable territory, and you agree to submit to such jurisdiction.</Body>
              </section>

              <section id="changes" className="tos-section">
                <SectionHeading num="09">Changes to These Terms</SectionHeading>
                <Body>NovaShop reserves the right to modify these Terms at any time. Changes become effective immediately upon publication on this page. We will note the effective date of the most recent revision at the top of this document.</Body>
                <Body spaceBottom={false}>Your continued use of the Site following any modifications constitutes acceptance of the revised Terms. We encourage you to review this page periodically.</Body>
              </section>

              <section id="contact" className="tos-section">
                <SectionHeading num="10">Contact</SectionHeading>
                <Body>If you have any questions or concerns about these Terms, please contact us:</Body>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '24px', marginBottom: '32px' }}>
                  <div style={{ border: `1px solid ${T.border}`, padding: '24px', borderRadius: '8px' }}>
                    <span style={{ display: 'block', fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.12em', color: T.muted, textTransform: 'uppercase', marginBottom: '8px', fontWeight: 600 }}>LEGAL TEAM</span>
                    <a href="mailto:legal@novashop.com" style={{ fontFamily: 'var(--font-sans)', fontSize: '15px', fontWeight: 600, color: T.espresso, textDecoration: 'none' }}>legal@novashop.com</a>
                  </div>
                  <div style={{ border: `1px solid ${T.border}`, padding: '24px', borderRadius: '8px' }}>
                    <span style={{ display: 'block', fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.12em', color: T.muted, textTransform: 'uppercase', marginBottom: '8px', fontWeight: 600 }}>RESPONSE TIME</span>
                    <span style={{ fontFamily: 'var(--font-sans)', fontSize: '15px', color: T.espresso }}>Within 10 business days</span>
                  </div>
                </div>
                <div style={{ background: T.bgAlt, border: `1px solid ${T.border}`, borderRadius: '12px', padding: '32px 40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '24px' }}>
                  <p style={{ margin: 0, fontFamily: 'var(--font-sans)', fontSize: '15px', lineHeight: 1.6, color: T.muted, maxWidth: '360px' }}>
                    Need help with an order or account question instead?
                  </p>
                  <button onClick={() => go('/help')} style={{ background: T.espresso, color: 'var(--color-primary-contrast)', border: 'none', padding: '14px 32px', fontFamily: 'var(--font-sans)', fontSize: '11px', fontWeight: 600, letterSpacing: '0.16em', textTransform: 'uppercase', cursor: 'pointer' }}
                    onMouseEnter={e => (e.currentTarget.style.opacity = 0.8)}
                    onMouseLeave={e => (e.currentTarget.style.opacity = 1)}>
                    Visit Help Centre
                  </button>
                </div>
              </section>

            </div>
          </div>
        </div>
      </div>
    </>
  );
}
