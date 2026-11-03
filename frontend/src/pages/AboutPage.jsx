import { useEffect, useRef } from 'react';

/* ── Design tokens ─────────────────────────────────── */
const T = {
  bg: 'var(--bg-main)',
  bgAlt: 'var(--bg-surface)',
  espresso: 'var(--text-primary)',
  muted: 'var(--text-secondary)',
  border: 'var(--border-default)',
};

/* ── Curated editorial image list ─────────────────── */
const IMGS = {
  hero: 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=1200&q=85',
  coat: 'https://images.unsplash.com/photo-1539109136881-3be0616acf4b?auto=format&fit=crop&w=900&q=85',
  drape: 'https://images.unsplash.com/photo-1509631179647-0177331693ae?auto=format&fit=crop&w=900&q=85',
  craft: 'https://images.unsplash.com/photo-1558769132-cb1aea458c5e?auto=format&fit=crop&w=900&q=85',
};

/* ── Scroll-reveal hook ────────────────────────────── */
function useReveal(threshold = 0.15) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.style.opacity = '1';
          el.style.transform = 'translateY(0)';
          io.disconnect();
        }
      },
      { threshold }
    );

    io.observe(el);
    return () => io.disconnect();
  }, [threshold]);

  return ref;
}

/* ── Reveal wrapper ────────────────────────────────── */
function Reveal({ delay = 0, children, style = {} }) {
  const ref = useReveal();
  return (
    <div
      ref={ref}
      style={{
        opacity: 0,
        transform: 'translateY(20px)',
        transition: `opacity 540ms ease ${delay}ms, transform 540ms ease ${delay}ms`,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/* ── Shared text block ────────────────────────────── */
function TextBlock({ eyebrow, heading, body, cta, go, center = false }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', textAlign: center ? 'center' : 'left', alignItems: center ? 'center' : 'flex-start' }}>
      {eyebrow && (
        <span style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: T.muted, fontWeight: 600 }}>
          {eyebrow}
        </span>
      )}
      <h2 style={{ margin: 0, fontFamily: 'var(--font-serif)', fontSize: 'clamp(28px, 3.2vw, 42px)', fontWeight: 400, color: T.espresso, lineHeight: 1.18, letterSpacing: '-0.03em' }}>
        {heading}
      </h2>
      <p style={{ margin: 0, fontFamily: 'var(--font-sans)', fontSize: '15px', lineHeight: 1.8, color: T.muted, maxWidth: center ? '540px' : '440px' }}>
        {body}
      </p>
      {cta && (
        <button
          type="button"
          onClick={() => go('/shop')}
          style={{
            marginTop: '8px',
            background: T.espresso, color: 'var(--color-primary-contrast)',
            border: 'none', borderRadius: 0, cursor: 'pointer',
            fontFamily: 'var(--font-sans)', fontSize: '11px',
            letterSpacing: '0.16em', textTransform: 'uppercase',
            padding: '14px 28px',
            transition: 'opacity 200ms ease',
          }}
          onMouseEnter={e => e.currentTarget.style.opacity = '0.82'}
          onMouseLeave={e => e.currentTarget.style.opacity = '1'}
        >
          {cta}
        </button>
      )}
    </div>
  );
}

/* ── Editorial image with caption ────────────────── */
function EditorialImage({ src, alt, caption, aspectRatio = '3/4' }) {
  return (
    <div style={{ position: 'relative', width: '100%' }}>
      {caption && (
        <p style={{
          margin: '0 0 10px',
          fontFamily: 'var(--font-sans)', fontSize: '10px',
          color: T.muted, letterSpacing: '0.06em', lineHeight: 1.5,
          maxWidth: '320px',
        }}>
          {caption}
        </p>
      )}
      <div style={{ width: '100%', aspectRatio, overflow: 'hidden', background: 'var(--bg-surface-sunken)' }}>
        <img
          src={src}
          alt={alt}
          loading="lazy"
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', transition: 'transform 600ms ease' }}
          onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.03)'}
          onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
        />
      </div>
    </div>
  );
}

/* ── Two-column section ─────────────────────────── */
function TwoCol({ imageLeft = true, image, caption, imgAlt, imgRatio, eyebrow, heading, body, cta, go }) {
  const imgCol = (
    <Reveal delay={imageLeft ? 0 : 80} style={{ width: '100%' }}>
      <EditorialImage src={image} alt={imgAlt} caption={caption} aspectRatio={imgRatio || '4/5'} />
    </Reveal>
  );
  const textCol = (
    <Reveal delay={imageLeft ? 80 : 0} style={{ width: '100%', display: 'flex', alignItems: 'center' }}>
      <TextBlock eyebrow={eyebrow} heading={heading} body={body} cta={cta} go={go} />
    </Reveal>
  );

  return (
    <section style={{ background: T.bg, padding: 'clamp(52px, 6vw, 96px) clamp(24px, 6vw, 80px)' }}>
      <div
        className="about-two-col"
        style={{
          maxWidth: '1200px', margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 'clamp(32px, 5vw, 72px)',
          alignItems: 'center',
        }}
      >
        {imageLeft ? imgCol : textCol}
        {imageLeft ? textCol : imgCol}
      </div>
    </section>
  );
}

/* ══════════════════════════════════════════════════════
   MAIN PAGE
══════════════════════════════════════════════════════ */
export default function AboutPage({ go }) {
  return (
    <>
      <style>{`
        @media (max-width: 1023px) {
          .about-two-col {
            grid-template-columns: 1fr !important;
          }
          /* always show image first on mobile regardless of DOM order */
          .about-img-right { order: -1 !important; }
        }
        @media (max-width: 767px) {
          .about-hero-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

      {/* ── HERO ─────────────────────────────────────────── */}
      <section style={{
        background: T.bg,
        padding: 'clamp(52px, 6vw, 96px) clamp(24px, 6vw, 80px)',
        position: 'relative', overflow: 'hidden',
      }}>
        {/* dot-grid decorative bg */}
        <div aria-hidden="true" style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          backgroundImage: 'radial-gradient(circle, var(--border-default) 1px, transparent 1px)',
          backgroundSize: '26px 26px', zIndex: 0,
        }} />

        <div
          className="about-hero-grid"
          style={{
            position: 'relative', zIndex: 1,
            maxWidth: '1200px', margin: '0 auto',
            display: 'grid', gridTemplateColumns: '1fr 1fr',
            gap: 'clamp(32px, 5vw, 72px)', alignItems: 'center',
          }}
        >
          <Reveal delay={0}>
            <TextBlock
              eyebrow="About NovaShop"
              heading="Designed for the modern wardrobe."
              body="NovaShop brings together considered fashion, refined essentials, and contemporary design for everyday dressing."
              cta="Explore the Collection"
              go={go}
            />
          </Reveal>

          <Reveal delay={100} style={{ width: '100%' }}>
            <EditorialImage
              src={IMGS.hero}
              alt="Tailored menswear in warm ecru and taupe studio lighting"
              caption="Tailored menswear styling in warm ecru and taupe studio lighting"
              aspectRatio="4/5"
            />
          </Reveal>
        </div>
      </section>

      {/* ── OUR APPROACH ───────────────────────────────── */}
      <section style={{
        background: T.bgAlt,
        borderTop: `1px solid ${T.border}`,
        borderBottom: `1px solid ${T.border}`,
        padding: 'clamp(64px, 8vw, 112px) clamp(24px, 6vw, 80px)',
        textAlign: 'center',
      }}>
        <Reveal>
          <div style={{ maxWidth: '580px', margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '18px' }}>
            <span style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: T.muted, fontWeight: 600 }}>
              Our Approach
            </span>
            <h2 style={{ margin: 0, fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 'clamp(32px, 4vw, 52px)', fontWeight: 400, color: T.espresso, lineHeight: 1.1, letterSpacing: '-0.04em' }}>
              Less, but better.
            </h2>
            <p style={{ margin: 0, fontFamily: 'var(--font-sans)', fontSize: '15px', lineHeight: 1.8, color: T.muted, maxWidth: '500px' }}>
              We focus on timeless silhouettes, thoughtful details, and pieces that work effortlessly across seasons.
            </p>
          </div>
        </Reveal>
      </section>

      {/* ── SECTION 2 — The NovaShop Edit (image left) ─── */}
      <div style={{ borderTop: `1px solid ${T.border}` }}>
        <TwoCol
          imageLeft={false}
          image={IMGS.drape}
          imgAlt="Draped outerwear in oatmeal and linen tones"
          caption="Editorial drape outerwear in natural oatmeal and linen nuances"
          imgRatio="4/5"
          eyebrow="The NovaShop Edit"
          heading={"Modern essentials,\nthoughtfully chosen."}
          body="From everyday staples to standout pieces, our collection is shaped around clean design, versatile styling, and lasting appeal."
          go={go}
        />
      </div>

      {/* ── SECTION 1 — Our Collection (image left) ─────── */}
      <div style={{ borderTop: `1px solid ${T.border}` }}>
        <TwoCol
          imageLeft
          image={IMGS.coat}
          imgAlt="Architectural wool coat in bright open atelier"
          caption="Architectural wool coat worn with poise against an open light-filled atelier"
          imgRatio="4/5"
          eyebrow="Our Collection"
          heading="Made to move with you."
          body="Easy layers, refined essentials, and contemporary pieces designed to become part of your everyday wardrobe."
          go={go}
        />
      </div>

      {/* ── DISCOVER CTA ───────────────────────────────── */}
      <section style={{
        background: T.bg,
        padding: 'clamp(64px, 8vw, 112px) clamp(24px, 6vw, 80px)',
        textAlign: 'center',
      }}>
        <Reveal>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
            <h2 style={{ margin: 0, fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 'clamp(32px, 4vw, 52px)', fontWeight: 400, color: T.espresso, lineHeight: 1.1, letterSpacing: '-0.04em' }}>
              Discover NovaShop.
            </h2>
            <p style={{ margin: 0, fontFamily: 'var(--font-sans)', fontSize: '15px', color: T.muted }}>
              Explore the latest collection.
            </p>
            <button
              type="button"
              onClick={() => go('/shop')}
              style={{
                marginTop: '8px',
                background: T.espresso, color: 'var(--color-primary-contrast)',
                border: 'none', borderRadius: 0, cursor: 'pointer',
                fontFamily: 'var(--font-sans)', fontSize: '11px',
                letterSpacing: '0.16em', textTransform: 'uppercase',
                padding: '14px 36px',
                transition: 'opacity 200ms ease',
              }}
              onMouseEnter={e => e.currentTarget.style.opacity = '0.82'}
              onMouseLeave={e => e.currentTarget.style.opacity = '1'}
            >
              Shop Now
            </button>
          </div>
        </Reveal>
      </section>
    </>
  );
}
