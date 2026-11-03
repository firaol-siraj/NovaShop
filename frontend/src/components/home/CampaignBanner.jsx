import { useEffect, useState } from 'react';
import { homeApi } from '../../lib/api/homeApi';
import { resolveImage } from '../../lib/catalog';

/**
 * CampaignBanner — Dynamic editorial campaign hero section
 * Driven entirely by backend content from GET /api/v1/home/hero
 */
export default function CampaignBanner({ go }) {
  const [heroData, setHeroData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function fetchHero() {
      try {
        const response = await homeApi.getHero();
        if (!cancelled) {
          setHeroData(response?.data || null);
        }
      } catch {
        // Log nothing sensitive
        if (!cancelled) {
          setHeroData(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchHero();

    return () => {
      cancelled = true;
    };
  }, []);

  // When no hero content exists or fetch fails, keep section hidden without invented text
  if (loading || !heroData || !heroData.title) {
    return null;
  }

  const bgImage = imageError
    ? resolveImage(null)
    : resolveImage(heroData.imageUrl);

  const renderCta = (cta, isPrimary) => {
    if (!cta?.label || !cta?.link) return null;

    const isExternal = /^https?:\/\//i.test(cta.link);

    const baseStyle = {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      textDecoration: 'none',
      padding: '14px 36px',
      fontSize: '10px',
      fontFamily: 'var(--font-sans)',
      fontWeight: 600,
      letterSpacing: '0.15em',
      textTransform: 'uppercase',
      cursor: 'pointer',
      borderRadius: 0,
      transition: 'all 0.2s',
      ...(isPrimary
        ? {
            background: 'var(--color-primary-contrast, #FDFBF7)',
            color: 'var(--color-primary, #231E1B)',
            border: 'none',
          }
        : {
            background: 'transparent',
            color: 'var(--color-primary-contrast, #FDFBF7)',
            border: '1px solid rgba(253,251,247,0.5)',
          }),
    };

    const handleMouseEnter = (e) => {
      if (isPrimary) {
        e.currentTarget.style.opacity = '0.85';
      } else {
        e.currentTarget.style.background = 'rgba(253,251,247,0.1)';
        e.currentTarget.style.borderColor = 'var(--color-primary-contrast, #FDFBF7)';
      }
    };

    const handleMouseLeave = (e) => {
      if (isPrimary) {
        e.currentTarget.style.opacity = '1';
      } else {
        e.currentTarget.style.background = 'transparent';
        e.currentTarget.style.borderColor = 'rgba(253,251,247,0.5)';
      }
    };

    if (isExternal) {
      return (
        <a
          key={cta.label}
          href={cta.link}
          target="_blank"
          rel="noopener noreferrer"
          style={baseStyle}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          {cta.label}
        </a>
      );
    }

    return (
      <button
        key={cta.label}
        type="button"
        onClick={() => go?.(cta.link)}
        style={baseStyle}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {cta.label}
      </button>
    );
  };

  return (
    <section className="relative w-full overflow-hidden" style={{ height: '600px' }}>
      {/* Background Image with graceful fallback */}
      <img
        src={bgImage}
        alt={heroData.title}
        onError={() => setImageError(true)}
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
        {heroData.eyebrow && (
          <span
            className="block mb-5 text-[10px] uppercase tracking-[0.25em] font-medium"
            style={{ color: 'rgba(253,251,247,0.7)' }}
          >
            {heroData.eyebrow}
          </span>
        )}

        <h1
          style={{
            fontFamily: 'var(--font-serif)',
            fontSize: 'clamp(36px, 5vw, 64px)',
            lineHeight: 1.05,
            fontWeight: 400,
            letterSpacing: '-0.02em',
            color: 'var(--color-primary-contrast, #FDFBF7)',
            marginBottom: '16px',
            maxWidth: '640px',
          }}
        >
          {heroData.title}
        </h1>

        {heroData.subtitle && (
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
            {heroData.subtitle}
          </p>
        )}

        {/* Dynamic CTAs */}
        <div className="flex flex-col sm:flex-row items-center gap-3">
          {renderCta(heroData.primaryCta, true)}
          {renderCta(heroData.secondaryCta, false)}
        </div>
      </div>
    </section>
  );
}
