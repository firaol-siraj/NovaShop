import { useState, useEffect, useCallback, useRef } from 'react';
import { homeApi } from '../../lib/api/homeApi';

const HERO_CACHE_KEY = 'novashop_hero_slides_cache';

function getInitialSlides() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = sessionStorage.getItem(HERO_CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch {
    // ignore
  }
  return [];
}

const AUTO_MS = 6000;   // 6 s per slide
const FADE_MS = 1000;   // image crossfade
const TEXT_SLIDE_MS = 600;    // text reveal
const STAGGER_MS = 70;     // per-line stagger

/* ─── helpers ───────────────────────────────────────────────────────────── */
const pad2 = n => String(n + 1).padStart(2, '0');

/* ─── Arrow button (bottom-right) ───────────────────────────────────────── */
function ArrowBtn({ direction, onClick, label }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      style={{
        width: '44px', height: '44px',
        borderRadius: '50%',
        border: '1px solid rgba(255,255,255,0.3)',
        background: 'rgba(0,0,0,0.35)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#fff',
        transition: 'background 200ms, border-color 200ms',
        flexShrink: 0,
      }}
      onMouseEnter={e => {
        e.currentTarget.style.background = 'rgba(0,0,0,0.6)';
        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.7)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = 'rgba(0,0,0,0.35)';
        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)';
      }}
    >
      {direction === 'prev'
        ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
        : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>
      }
    </button>
  );
}

/* ─── Animated text line (stagger helper) ───────────────────────────────── */
function TextLine({ children, delay, style }) {
  return (
    <div
      className="hero-text-line"
      style={{
        animationDelay: `${delay}ms`,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   MAIN COMPONENT
───────────────────────────────────────────────────────────────────────────── */
export default function HeroSection({ go }) {
  const [slidesList, setSlidesList] = useState(getInitialSlides);
  const totalSlides = slidesList.length;
  const [active, setActive] = useState(0);
  const [prev, setPrev] = useState(null);   // for crossfade
  const [isHovered, setIsHovered] = useState(false);
  const [textKey, setTextKey] = useState(0);       // force text re-mount on slide change
  const [progressKey, setProgressKey] = useState(0);  // force progress bar restart

  const timerRef = useRef(null);
  const trackedImpressionsRef = useRef(new Set());
  const touchStartXRef = useRef(null);

  const handleTouchStart = (e) => {
    touchStartXRef.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e) => {
    if (touchStartXRef.current === null) return;
    const deltaX = e.changedTouches[0].clientX - touchStartXRef.current;
    if (Math.abs(deltaX) > 40) {
      if (deltaX > 0) {
        handleManualNav(goPrev);
      } else {
        handleManualNav(goNext);
      }
    }
    touchStartXRef.current = null;
  };

  const [heroHeight, setHeroHeight] = useState(720);

  /* ── Load dynamic active slides from backend ──────────────────────────── */
  useEffect(() => {
    let cancelled = false;
    async function loadSlides() {
      try {
        const res = await homeApi.getHeroSlides();
        const data = res?.data || [];
        if (!cancelled) {
          if (Array.isArray(data) && data.length > 0) {
            const mapped = data.map((s) => {
              const width = typeof s.width === 'number' ? s.width : null;
              const height = typeof s.height === 'number' ? s.height : null;
              const ratio = width && height ? width / height : (typeof s.aspectRatio === 'number' ? s.aspectRatio : null);
              const rawFit = s.imageFit === 'contain' ? 'contain' : 'cover';
              const position = s.imagePosition || 'right';
              const focalX = typeof s.focalPointX === 'number' ? s.focalPointX : 50;
              const focalY = typeof s.focalPointY === 'number' ? s.focalPointY : 50;

              return {
                id: s._id || s.id,
                image: s.imageUrl || s.image,
                mobileImage: s.mobileImage || '',
                imageFit: rawFit,
                imagePosition: position,
                width,
                height,
                aspectRatio: ratio,
                focalPointX: focalX,
                focalPointY: focalY,
                srcSet: s.srcSet || '',
                mobileSrcSet: s.mobileSrcSet || '',
                objectPosition: `${focalX}% ${focalY}%`,
                eyebrow: s.eyebrow || 'THE EDIT',
                headline: s.headline || s.title || '',
                description: s.description || s.subheadline || s.subtitle || '',
                primaryCTA: {
                  label: s.buttonLabel || s.buttonText || 'SHOP THE EDIT',
                  path: s.buttonLink || '/shop',
                },
                secondaryCTA: {
                  label: s.secondaryButtonText || 'VIEW LOOKBOOK',
                  path: s.secondaryButtonLink || '/about',
                },
              };
            });
            setSlidesList(mapped);
            try {
              sessionStorage.setItem(HERO_CACHE_KEY, JSON.stringify(mapped));
            } catch {
              // ignore
            }
          } else {
            setSlidesList([]);
            try {
              sessionStorage.removeItem(HERO_CACHE_KEY);
            } catch {
              // ignore
            }
          }
        }
      } catch {
        // Silently keep any cached slides on network glitch
      }
    }
    loadSlides();
    return () => {
      cancelled = true;
    };
  }, []);

  /* ── Adaptive hero height consistent across slides to prevent layout jumps ── */
  useEffect(() => {
    function computeHeight() {
      const vw = typeof window !== 'undefined' ? window.innerWidth : 1440;
      const vh = typeof window !== 'undefined' ? window.innerHeight : 900;
      if (vw <= 768) {
        setHeroHeight(Math.max(420, Math.min(Math.round(0.65 * vh), 560)));
        return;
      }
      // Generous full-bleed desktop hero height
      const target = Math.max(560, Math.min(Math.round(0.85 * vh), 880));
      setHeroHeight(target);
    }
    computeHeight();
    window.addEventListener('resize', computeHeight);
    return () => window.removeEventListener('resize', computeHeight);
  }, []);

  /* ── Preload images ─────────────────────────────────────────────────────── */
  useEffect(() => {
    if (!slidesList || slidesList.length <= 1) return;
    slidesList.slice(1, 3).forEach(s => {
      if (s?.image) {
        const i = new Image();
        i.src = s.image;
      }
    });
    const t = setTimeout(() => {
      if (slidesList[3]?.image) {
        const i = new Image();
        i.src = slidesList[3].image;
      }
    }, 2000);
    return () => clearTimeout(t);
  }, [slidesList]);

  /* ── Track impression when slide changes ───────────────────────────────── */
  useEffect(() => {
    const cur = slidesList[active];
    if (cur?.id && !trackedImpressionsRef.current.has(cur.id)) {
      trackedImpressionsRef.current.add(cur.id);
      homeApi.trackHero(cur.id, 'impression').catch(() => {});
    }
  }, [active, slidesList]);

  /* ── Navigate to a slide ─────────────────────────────────────────────────── */
  const goTo = useCallback((idx) => {
    setActive(cur => {
      setPrev(cur);
      return idx;
    });
    setTextKey(k => k + 1);
    setProgressKey(k => k + 1);
    // Clear prev after fade completes
    setTimeout(() => setPrev(null), FADE_MS + 100);
  }, []);

  const goPrev = useCallback(() => {
    if (totalSlides <= 1) return;
    goTo((active - 1 + totalSlides) % totalSlides);
  }, [active, goTo, totalSlides]);

  const goNext = useCallback(() => {
    if (totalSlides <= 1) return;
    goTo((active + 1) % totalSlides);
  }, [active, goTo, totalSlides]);

  /* ── Auto-advance ───────────────────────────────────────────────────────── */
  const startTimer = useCallback(() => {
    clearInterval(timerRef.current);
    if (totalSlides <= 1) return;
    timerRef.current = setInterval(() => {
      setActive(cur => {
        const next = (cur + 1) % totalSlides;
        setPrev(cur);
        setTimeout(() => setPrev(null), FADE_MS + 100);
        return next;
      });
      setTextKey(k => k + 1);
      setProgressKey(k => k + 1);
    }, AUTO_MS);
  }, [totalSlides]);

  useEffect(() => {
    if (!isHovered) startTimer();
    else clearInterval(timerRef.current);
    return () => clearInterval(timerRef.current);
  }, [isHovered, startTimer]);

  const handleManualNav = useCallback((fn) => {
    fn();
  }, []);

  const handleCtaClick = (path) => {
    const cur = slidesList[active];
    if (cur?.id) {
      homeApi.trackHero(cur.id, 'click').catch(() => {});
    }
    go(path);
  };

  const slide = slidesList[active] || slidesList[0];

  /* ── Secondary CTA arrow nudge ─────────────────────────────────────────── */
  const [arrowNudge, setArrowNudge] = useState(false);

  if (!slide || slidesList.length === 0) {
    return (
      <section
        aria-label="Hero carousel"
        className="hero-section-box"
        style={{
          position: 'relative',
          width: '100%',
          height: `${heroHeight}px`,
          overflow: 'hidden',
          backgroundColor: '#1A1510',
        }}
      >
        <style>{`
          .hero-section-box {
            height: clamp(480px, 80vh, 820px);
          }
          @media (max-width: 768px) {
            .hero-section-box {
              height: clamp(420px, 65vh, 560px) !important;
            }
          }
          @media (max-width: 480px) {
            .hero-section-box {
              height: clamp(360px, 55vh, 480px) !important;
            }
          }
        `}</style>
      </section>
    );
  }

  return (
    <section
      aria-label="Hero carousel"
      className="hero-section-box"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      style={{
        position: 'relative',
        width: '100%',
        height: `${heroHeight}px`,
        overflow: 'hidden',
        backgroundColor: '#1A1510',
      }}
    >
      {/* ══ BACKGROUND IMAGES (crossfade) ══════════════════════════════════ */}
      {slidesList.map((s, i) => {
        const isActive = i === active;
        const isPrev = i === prev;
        const rawFit = s.imageFit === 'contain' ? 'contain' : 'cover';
        const isContain = rawFit === 'contain';
        const ratio = s.aspectRatio || (s.width && s.height ? s.width / s.height : null);
        const isPortrait = (s.height && s.width && s.height > s.width) || (ratio && ratio < 1.2);
        const focalX = typeof s.focalPointX === 'number' ? s.focalPointX : 50;
        // Default focalPointY to 22% for portrait images so faces and hats stay perfectly framed in the upper portion
        const focalY = typeof s.focalPointY === 'number' && s.focalPointY !== 50
          ? s.focalPointY
          : (isPortrait ? 22 : (typeof s.focalPointY === 'number' ? s.focalPointY : 50));
        const focalPos = `${focalX}% ${focalY}%`;

        return (
          <div
            key={i}
            aria-hidden={!isActive}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              opacity: isActive ? 1 : 0,
              transition: `opacity ${FADE_MS}ms ease-in-out`,
              /* active=2, outgoing=1, hidden=0 — never negative to avoid stacking-context bugs */
              zIndex: isActive ? 2 : isPrev ? 1 : 0,
              pointerEvents: 'none',
              willChange: 'opacity',
              overflow: 'hidden',
            }}
          >
            {isContain ? (
              /* When contain mode is explicitly chosen in admin: centered with ambient fill */
              <>
                <div
                  aria-hidden="true"
                  style={{
                    position: 'absolute',
                    inset: '-24px',
                    overflow: 'hidden',
                    zIndex: 1,
                  }}
                >
                  <img
                    src={s.image}
                    srcSet={s.srcSet || undefined}
                    sizes="100vw"
                    alt=""
                    aria-hidden="true"
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      objectPosition: focalPos,
                      filter: 'blur(36px) brightness(0.35) saturate(1.25)',
                      transform: 'scale(1.15)',
                      display: 'block',
                    }}
                  />
                </div>
                <div
                  className={`hero-foreground-contain hero-pos-${s.imagePosition || 'right'}`}
                  style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: s.imagePosition === 'left' ? 'flex-start' : s.imagePosition === 'center' ? 'center' : 'flex-end',
                    padding: s.imagePosition === 'right' ? '0 clamp(24px, 7vw, 100px) 0 0' : s.imagePosition === 'left' ? '0 0 0 clamp(24px, 7vw, 100px)' : '0',
                    zIndex: 2,
                    pointerEvents: 'none',
                  }}
                >
                  <picture style={{ height: '100%', display: 'flex', alignItems: 'center' }}>
                    {s.mobileImage && (
                      <source
                        media="(max-width: 768px)"
                        srcSet={s.mobileSrcSet || s.mobileImage}
                        sizes="100vw"
                      />
                    )}
                    {s.srcSet && (
                      <source
                        media="(min-width: 769px)"
                        srcSet={s.srcSet}
                        sizes="(max-width: 768px) 100vw, 650px"
                      />
                    )}
                    <img
                      src={s.image}
                      srcSet={s.srcSet || undefined}
                      sizes="(max-width: 768px) 100vw, 650px"
                      alt={s.headline || ''}
                      aria-hidden="true"
                      fetchPriority={i === 0 ? 'high' : 'low'}
                      loading={i === 0 ? 'eager' : 'lazy'}
                      style={{
                        maxHeight: '100%',
                        height: '100%',
                        maxWidth: s.width ? `${s.width}px` : '100%',
                        width: 'auto',
                        objectFit: 'contain',
                        display: 'block',
                        filter: 'none',
                      }}
                    />
                  </picture>
                </div>
              </>
            ) : (
              /* Default Full-Width Hero: fills 100% width and 100% height edge-to-edge, crisp, unblurred, no backdrop */
              <picture style={{ width: '100%', height: '100%', display: 'block', zIndex: 2 }}>
                {s.mobileImage && (
                  <source
                    media="(max-width: 768px)"
                    srcSet={s.mobileSrcSet || s.mobileImage}
                    sizes="100vw"
                  />
                )}
                {s.srcSet && (
                  <source
                    media="(min-width: 769px)"
                    srcSet={s.srcSet}
                    sizes="100vw"
                  />
                )}
                <img
                  src={s.image}
                  srcSet={s.srcSet || undefined}
                  sizes="100vw"
                  alt={s.headline || ''}
                  aria-hidden="true"
                  fetchPriority={i === 0 ? 'high' : 'low'}
                  loading={i === 0 ? 'eager' : 'lazy'}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    objectPosition: focalPos,
                    display: 'block',
                    filter: 'none',
                  }}
                />
              </picture>
            )}
          </div>
        );
      })}

      {/* ══ GRADIENT OVERLAY ══════════════════════════════════════════════ */}
      {/* Bottom gradient — text legibility only */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute', inset: 0, zIndex: 2, pointerEvents: 'none',
          background: 'linear-gradient(to bottom, transparent 40%, rgba(0,0,0,0.22) 65%, rgba(0,0,0,0.62) 100%)',
        }}
      />
      {/* Subtle left vignette for extra warmth */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute', inset: 0, zIndex: 2, pointerEvents: 'none',
          background: 'linear-gradient(to right, rgba(0,0,0,0.28) 0%, transparent 55%)',
        }}
      />

      {/* ══ CONTENT LAYER ═════════════════════════════════════════════════ */}
      <div
        style={{
          position: 'absolute', inset: 0, zIndex: 3,
          display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
          pointerEvents: 'none',
        }}
      >
        {/* Bottom row: text block (left) + arrows (right) */}
        <div
          className="hero-bottom-row"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            padding: '0 56px 52px',
            width: '100%',
          }}
        >
          {/* ── TEXT BLOCK ─────────────────────────────────────────────── */}
          <div
            key={textKey}
            className="hero-text-block"
            style={{ maxWidth: '460px', pointerEvents: 'auto' }}
          >
            {/* Eyebrow */}
            <TextLine delay={0} style={{ marginBottom: '14px' }}>
              <p style={{
                margin: 0,
                fontFamily: 'var(--font-sans)',
                fontSize: '11px',
                fontWeight: 500,
                letterSpacing: '0.22em',
                textTransform: 'uppercase',
                color: 'rgba(255,255,255,0.75)',
                lineHeight: 1,
              }}>
                {slide.eyebrow}
              </p>
            </TextLine>

            {/* Headline */}
            <TextLine delay={STAGGER_MS} style={{ marginBottom: '18px' }}>
              <h1 style={{
                margin: 0,
                fontFamily: 'var(--font-serif)',
                fontSize: 'clamp(40px, 5vw, 64px)',
                fontWeight: 400,
                fontStyle: 'italic',
                lineHeight: 1.06,
                letterSpacing: '-0.01em',
                color: '#FFFFFF',
              }}>
                {slide.headline}
              </h1>
            </TextLine>

            {/* Description */}
            <TextLine delay={STAGGER_MS * 2} style={{ marginBottom: '30px' }}>
              <p style={{
                margin: 0,
                fontFamily: 'var(--font-sans)',
                fontSize: '15px',
                fontWeight: 300,
                lineHeight: 1.65,
                color: 'rgba(255,255,255,0.80)',
                maxWidth: '400px',
              }}>
                {slide.description}
              </p>
            </TextLine>

            {/* CTA row */}
            <TextLine delay={STAGGER_MS * 3}>
              <div className="hero-cta-row" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '28px' }}>
                {/* Primary solid button */}
                <button
                  onClick={() => handleCtaClick(slide.primaryCTA.path)}
                  style={{
                    background: 'var(--color-primary-contrast, #FDFBF7)',
                    color: 'var(--color-primary, #1A1510)',
                    border: 'none',
                    padding: '15px 30px',
                    fontFamily: 'var(--font-sans)',
                    fontSize: '10px',
                    fontWeight: 600,
                    letterSpacing: '0.14em',
                    textTransform: 'uppercase',
                    cursor: 'pointer',
                    transition: 'background 200ms, color 200ms, opacity 200ms',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.opacity = '0.85';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.opacity = '1';
                  }}
                >
                  {slide.primaryCTA.label}
                </button>

                {/* Secondary text link */}
                <button
                  onClick={() => handleCtaClick(slide.secondaryCTA.path)}
                  onMouseEnter={() => setArrowNudge(true)}
                  onMouseLeave={() => setArrowNudge(false)}
                  style={{
                    background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                    fontFamily: 'var(--font-sans)',
                    fontSize: '10px', fontWeight: 500, letterSpacing: '0.14em',
                    textTransform: 'uppercase',
                    color: '#FFFFFF',
                    textDecoration: 'underline',
                    textUnderlineOffset: '5px',
                    textDecorationColor: 'rgba(255,255,255,0.5)',
                    display: 'inline-flex', alignItems: 'center', gap: '8px',
                    transition: 'text-decoration-color 200ms',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                  }}
                  onMouseEnterExtra={e => e.currentTarget.style.textDecorationColor = 'rgba(255,255,255,1)'}
                >
                  {slide.secondaryCTA.label}
                  <svg
                    width="13" height="13" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                    aria-hidden="true"
                    style={{
                      flexShrink: 0,
                      transform: arrowNudge ? 'translateX(3px)' : 'translateX(0)',
                      transition: 'transform 200ms ease',
                    }}
                  >
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </TextLine>

            {/* ── SLIDE INDICATOR (below buttons, still bottom-left) ──── */}
            <div
              style={{
                marginTop: '36px',
                display: 'flex', alignItems: 'center', gap: '12px',
              }}
              role="tablist"
              aria-label="Slide indicators"
            >
              {/* Current number */}
              <span style={{
                fontFamily: 'var(--font-sans)', fontSize: '11px',
                fontWeight: 500, color: 'rgba(255,255,255,0.7)',
                letterSpacing: '0.06em', fontVariantNumeric: 'tabular-nums',
                lineHeight: 1, flexShrink: 0,
              }} aria-hidden="true">
                {pad2(active)}
              </span>

              {/* Progress bars */}
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                {slidesList.map((_, i) => (
                  <button
                    key={`${progressKey}-${i}`}
                    role="tab"
                    aria-selected={i === active}
                    aria-label={`Go to slide ${i + 1}`}
                    onClick={() => goTo(i)}
                    style={{
                      border: 'none', padding: 0,
                      height: '2px', width: '36px',
                      background: 'rgba(255,255,255,0.22)',
                      position: 'relative', overflow: 'hidden',
                      cursor: 'pointer', flexShrink: 0,
                    }}
                  >
                    {/* Animated fill */}
                    <div
                      style={{
                        position: 'absolute', inset: 0,
                        background: '#FFFFFF',
                        transform: i === active ? 'scaleX(1)' : 'scaleX(0)',
                        transformOrigin: 'left center',
                        transition: i === active
                          ? `transform ${AUTO_MS}ms linear`
                          : 'none',
                        animationPlayState: isHovered ? 'paused' : 'running',
                      }}
                      className={isHovered ? 'progress-paused' : ''}
                    />
                  </button>
                ))}
              </div>

              {/* Total */}
              <span style={{
                fontFamily: 'var(--font-sans)', fontSize: '11px',
                fontWeight: 500, color: 'rgba(255,255,255,0.35)',
                letterSpacing: '0.06em', fontVariantNumeric: 'tabular-nums',
                lineHeight: 1, flexShrink: 0,
              }} aria-hidden="true">
                {pad2(totalSlides - 1)}
              </span>
            </div>
          </div>

          {/* ── NAVIGATION ARROWS (bottom-right) ─────────────────────── */}
          <div
            className="hero-arrows"
            style={{ display: 'flex', gap: '10px', alignItems: 'center', pointerEvents: 'auto', flexShrink: 0 }}
          >
            <ArrowBtn direction="prev" onClick={() => handleManualNav(goPrev)} label="Previous slide" />
            <ArrowBtn direction="next" onClick={() => handleManualNav(goNext)} label="Next slide" />
          </div>
        </div>
      </div>

      {/* ══ CSS ═══════════════════════════════════════════════════════════ */}
      <style>{`
        /* Consistent crisp presentation without blurry GPU transforms */
        .hero-section-box {
          height: clamp(480px, 80dvh, 820px);
        }

        /* Staggered text reveal */
        @keyframes heroTextReveal {
          0%   { opacity: 0; transform: translateY(18px); }
          100% { opacity: 1; transform: translateY(0);    }
        }
        .hero-text-line {
          opacity: 0;
          animation: heroTextReveal ${TEXT_SLIDE_MS}ms ease-out forwards;
        }

        /* Pause progress bar fill on hover */
        .progress-paused {
          animation-play-state: paused !important;
          transition: none !important;
        }

        /* ── Responsive ─────────────────────────────────────────────── */
        @media (max-width: 768px) {
          .hero-section-box {
            height: clamp(420px, 65dvh, 560px) !important;
          }
          .hero-foreground-contain {
            justify-content: center !important;
            padding: 0 !important;
          }
          .hero-bottom-row {
            padding: 0 24px 36px !important;
            flex-direction: column;
            align-items: flex-start !important;
            gap: 24px;
          }
          .hero-text-block {
            max-width: 100% !important;
          }
          .hero-text-block h1 {
            font-size: clamp(32px, 9vw, 44px) !important;
          }
          .hero-cta-row {
            flex-direction: column;
            align-items: flex-start !important;
            gap: 16px !important;
          }
          .hero-cta-row button {
            min-height: 44px !important;
            display: inline-flex !important;
            align-items: center !important;
            justify-content: center !important;
          }
          .hero-arrows {
            align-self: flex-end;
          }
        }

        @media (max-width: 480px) {
          .hero-section-box {
            height: clamp(360px, 55dvh, 480px) !important;
          }
          .hero-bottom-row {
            padding: 0 20px 28px !important;
          }
        }
      `}</style>
    </section>
  );
}
