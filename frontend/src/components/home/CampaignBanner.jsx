/**
 * CampaignBanner — Stitch "Layers for the Season" full-width dark hero
 * Full-bleed editorial campaign moment
 */
export default function CampaignBanner({ go }) {
  return (
    <section className="relative w-full overflow-hidden" style={{ height: '600px' }}>
      {/* Background Image */}
      <img
        src="https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=2000&q=85"
        alt="Campaign: Layers for the Season"
        loading="lazy"
        className="absolute inset-0 w-full h-full object-cover object-top"
      />

      {/* Dark overlay */}
      <div
        className="absolute inset-0"
        style={{ background: 'rgba(27,24,22,0.55)' }}
      />

      {/* Centered editorial content */}
      <div className="relative z-10 h-full flex flex-col items-center justify-center text-center px-6">
        <span
          className="block mb-5 text-[10px] uppercase tracking-[0.25em] font-medium"
          style={{ color: 'rgba(253,251,247,0.7)' }}
        >
          The Season Edit
        </span>

        <h2
          style={{
            fontFamily: 'var(--font-serif)',
            fontSize: 'clamp(36px, 5vw, 64px)',
            lineHeight: 1.05,
            fontWeight: 400,
            letterSpacing: '-0.02em',
            color: '#FDFBF7',
            marginBottom: '16px',
            maxWidth: '640px',
          }}
        >
          Layers for the Season.
        </h2>

        <p
          style={{
            fontFamily: 'var(--font-sans)',
            fontSize: '14px',
            lineHeight: '1.7',
            color: 'rgba(253,251,247,0.75)',
            fontWeight: 300,
            marginBottom: '36px',
            maxWidth: '400px',
          }}
        >
          Outerwear, knitwear, and transitional essentials crafted for the months ahead.
        </p>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <button
            onClick={() => go('/shop')}
            style={{
              background: '#FDFBF7',
              color: '#231E1B',
              border: 'none',
              padding: '14px 36px',
              fontSize: '10px',
              fontFamily: 'var(--font-sans)',
              fontWeight: 600,
              letterSpacing: '0.15em',
              textTransform: 'uppercase',
              cursor: 'pointer',
              borderRadius: 0,
              transition: 'background 0.2s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = '#EFECE6'}
            onMouseLeave={e => e.currentTarget.style.background = '#FDFBF7'}
          >
            Shop the Edit
          </button>
          <button
            onClick={() => go('/shop?category=outerwear')}
            style={{
              background: 'transparent',
              color: '#FDFBF7',
              border: '1px solid rgba(253,251,247,0.5)',
              padding: '14px 36px',
              fontSize: '10px',
              fontFamily: 'var(--font-sans)',
              fontWeight: 600,
              letterSpacing: '0.15em',
              textTransform: 'uppercase',
              cursor: 'pointer',
              borderRadius: 0,
              transition: 'background 0.2s, border-color 0.2s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(253,251,247,0.1)'; e.currentTarget.style.borderColor = '#FDFBF7'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'rgba(253,251,247,0.5)'; }}
          >
            View Outerwear
          </button>
        </div>
      </div>
    </section>
  );
}
