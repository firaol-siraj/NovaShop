export default function BrandManifesto({ go }) {
  const features = [
    {
      number: '01',
      title: 'MODERN SILHOUETTES',
      description: 'Refined shapes designed for contemporary wardrobes.',
    },
    {
      number: '02',
      title: 'THOUGHTFUL DETAILS',
      description: 'Considered materials, proportions, and finishing.',
    },
    {
      number: '03',
      title: 'EVERYDAY VERSATILITY',
      description: 'Pieces designed to move effortlessly between occasions.',
    },
  ];

  return (
    <section style={{ backgroundColor: '#F7F2EA', padding: '80px 0' }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '0 40px' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1.02fr 1.38fr',
            gap: '72px',
            alignItems: 'center',
          }}
          className="brand-manifesto-grid"
        >
          <div style={{ position: 'relative', paddingBottom: '28px' }} className="brand-manifesto-image-wrap">
            <div
              style={{
                position: 'relative',
                overflow: 'hidden',
                borderRadius: '18px',
                aspectRatio: '4 / 5',
                background: '#111111',
                boxShadow: '0 25px 50px rgba(17, 14, 12, 0.12)',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'linear-gradient(90deg, rgba(0,0,0,0.18), rgba(0,0,0,0.10) 34%, rgba(0,0,0,0.26))',
                  zIndex: 1,
                }}
              />
              <img
                src="https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=2200&q=85"
                alt="Tailor cutting fabric at a dark workbench with scissors in a moody atelier"
                loading="lazy"
                style={{
                  display: 'block',
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  filter: 'grayscale(1) contrast(1.6) brightness(0.66) saturate(0.08)',
                  transform: 'scale(1.0)',
                  transition: 'transform 500ms ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'scale(1.02)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'scale(1)';
                }}
              />
            </div>

            <div
              style={{
                position: 'absolute',
                right: '-40px',
                bottom: '-30px',
                width: '42%',
                background: '#F6F1EA',
                border: '8px solid #ffffff',
                borderRadius: '12px',
                boxShadow: '0 20px 34px rgba(17, 14, 12, 0.18)',
                overflow: 'hidden',
                zIndex: 2,
              }}
            >
              <img
                src="https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=900&q=85"
                alt="Color close-up of a garment label and fabric detail"
                loading="lazy"
                style={{
                  display: 'block',
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  filter: 'saturate(1.08) contrast(1.08) brightness(0.97)',
                }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <span
              style={{
                display: 'block',
                marginBottom: '18px',
                fontFamily: 'var(--font-sans)',
                fontSize: '10px',
                fontWeight: 500,
                letterSpacing: '0.2em',
                textTransform: 'uppercase',
                color: '#8C837C',
              }}
            >
              THE NOVASHOP MANIFESTO
            </span>

            <h2
              style={{
                margin: '0 0 18px',
                maxWidth: '480px',
                fontFamily: 'var(--font-serif)',
                fontSize: 'clamp(38px, 4vw, 48px)',
                lineHeight: 1.05,
                fontWeight: 400,
                fontStyle: 'italic',
                letterSpacing: '-0.03em',
                color: '#1B1816',
              }}
            >
              Designed for everyday movement.
            </h2>

            <p
              style={{
                margin: '0 0 28px',
                maxWidth: '480px',
                fontFamily: 'var(--font-sans)',
                fontSize: '15px',
                lineHeight: '1.8',
                color: '#6E6962',
                fontWeight: 300,
              }}
            >
              Modern silhouettes, thoughtful details, and effortless essentials designed to become part of your everyday wardrobe.
            </p>

            <div
              style={{
                width: '100%',
                borderTop: '1px solid rgba(27, 24, 22, 0.14)',
                marginBottom: '12px',
              }}
            />

            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {features.map((feature, index) => (
                <div key={feature.number}>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '48px 1fr',
                      gap: '16px',
                      alignItems: 'start',
                      padding: '18px 0',
                    }}
                  >
                    <div
                      style={{
                        fontFamily: 'var(--font-sans)',
                        fontSize: '12px',
                        fontWeight: 500,
                        letterSpacing: '0.08em',
                        color: '#8C837C',
                        paddingTop: '4px',
                      }}
                    >
                      {feature.number}
                    </div>
                    <div>
                      <div
                        style={{
                          marginBottom: '4px',
                          fontFamily: 'var(--font-sans)',
                          fontSize: '11px',
                          fontWeight: 600,
                          letterSpacing: '0.16em',
                          textTransform: 'uppercase',
                          color: '#1B1816',
                        }}
                      >
                        {feature.title}
                      </div>
                      <div
                        style={{
                          fontFamily: 'var(--font-sans)',
                          fontSize: '14px',
                          lineHeight: '1.7',
                          color: '#7A736E',
                          fontWeight: 300,
                        }}
                      >
                        {feature.description}
                      </div>
                    </div>
                  </div>
                  {index < features.length - 1 && (
                    <div style={{ borderTop: '1px solid rgba(27, 24, 22, 0.08)' }} />
                  )}
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() => go?.('/about')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                marginTop: '28px',
                background: 'transparent',
                border: 'none',
                padding: 0,
                cursor: 'pointer',
                fontFamily: 'var(--font-sans)',
                fontSize: '11px',
                fontWeight: 600,
                letterSpacing: '0.16em',
                textTransform: 'uppercase',
                color: '#1B1816',
                borderBottom: '1px solid #1B1816',
                paddingBottom: '2px',
                transition: 'opacity 200ms ease',
                width: 'fit-content',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.opacity = '0.7';
                e.currentTarget.lastChild && (e.currentTarget.lastChild.style.transform = 'translateX(4px)');
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = '1';
                e.currentTarget.lastChild && (e.currentTarget.lastChild.style.transform = 'translateX(0)');
              }}
            >
              OUR STORY & ATELIER
              <svg
                width="17"
                height="17"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                style={{ transition: 'transform 200ms ease' }}
              >
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 1023px) {
          .brand-manifesto-grid {
            grid-template-columns: 1fr !important;
            gap: 32px !important;
          }

          .brand-manifesto-image-wrap {
            padding-bottom: 18px !important;
          }

          .brand-manifesto-image-wrap > div:last-child {
            right: -18px !important;
            bottom: -18px !important;
            width: 40% !important;
          }
        }

        @media (max-width: 640px) {
          .brand-manifesto-image-wrap {
            padding-right: 8px !important;
            padding-bottom: 20px !important;
          }

          .brand-manifesto-image-wrap > div:last-child {
            right: -12px !important;
            bottom: -12px !important;
            width: 42% !important;
            border-width: 6px !important;
          }
        }
      `}</style>
    </section>
  );
}
