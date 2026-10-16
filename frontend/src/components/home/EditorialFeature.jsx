import { useState } from 'react';

export default function EditorialFeature({
  go,
  imageSrc,
  imageAlt,
  label,
  heading,
  description,
  ctaLabel = 'Discover More',
  ctaPath = '/shop',
  imageLeft = true,
  bgColor = '#F7F2EA',
}) {
  const [isImageHovered, setIsImageHovered] = useState(false);

  const eyebrowLabel = label || "SPRING / SUMMER '26 COLLECTION";
  const headingText = heading || 'Modern Essentials.';
  const bodyText = description || 'Timeless silhouettes, refined materials, and effortless pieces designed for everyday wear.';

  const featureBlocks = [
    { label: 'MATERIALS', value: 'Refined Fabrics' },
    { label: 'CRAFT', value: 'Thoughtful Construction' },
    { label: 'DESIGN', value: 'Built to Last' },
  ];

  const imageBlock = (
    <div
      onClick={() => go?.(ctaPath)}
      style={{
        position: 'relative',
        width: '100%',
        overflow: 'hidden',
        borderRadius: '18px',
        aspectRatio: '4 / 5',
        background: '#EAE0D3',
        cursor: go ? 'pointer' : 'default',
      }}
    >
      <img
        src={imageSrc}
        alt={imageAlt}
        loading="lazy"
        onMouseEnter={() => setIsImageHovered(true)}
        onMouseLeave={() => setIsImageHovered(false)}
        style={{
          display: 'block',
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          objectPosition: 'center',
          transform: isImageHovered ? 'scale(1.02)' : 'scale(1)',
          transition: 'transform 500ms ease',
        }}
      />

      <div
        style={{
          position: 'absolute',
          left: '24px',
          bottom: '24px',
          width: 'min(68%, 420px)',
          background: 'rgba(253, 251, 247, 0.92)',
          borderRadius: '14px',
          padding: '22px 22px 18px',
          boxShadow: '0 10px 24px rgba(27, 24, 22, 0.08)',
        }}
      >
        <div
          style={{
            fontFamily: 'var(--font-sans)',
            fontSize: '10px',
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: '#8C837C',
            marginBottom: '10px',
            fontWeight: 500,
          }}
        >
          COLLECTION NOTE
        </div>
        <div
          style={{
            fontFamily: 'var(--font-serif)',
            fontSize: '20px',
            lineHeight: 1.25,
            color: '#1B1816',
            fontWeight: 400,
          }}
        >
          Edition of 200 Hand-Numbered Pieces
        </div>
      </div>
    </div>
  );

  const textBlock = (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'flex-start',
      }}
    >
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
        {eyebrowLabel}
      </span>

      <h2
        style={{
          margin: '0 0 18px',
          fontFamily: 'var(--font-serif)',
          fontSize: 'clamp(42px, 4vw, 56px)',
          lineHeight: 1.0,
          fontWeight: 400,
          fontStyle: 'italic',
          letterSpacing: '-0.03em',
          color: '#1B1816',
        }}
      >
        {headingText}
      </h2>

      <p
        style={{
          margin: '0 0 32px',
          maxWidth: '420px',
          fontFamily: 'var(--font-sans)',
          fontSize: '15px',
          lineHeight: '1.8',
          color: '#6E6962',
          fontWeight: 300,
        }}
      >
        {bodyText}
      </p>

      <div
        style={{
          width: '100%',
          display: 'grid',
          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
          gap: '22px',
          marginBottom: '28px',
        }}
      >
        {featureBlocks.map((block) => (
          <div key={block.label} style={{ minWidth: 0 }}>
            <div
              style={{
                marginBottom: '8px',
                fontFamily: 'var(--font-sans)',
                fontSize: '9px',
                fontWeight: 500,
                letterSpacing: '0.17em',
                textTransform: 'uppercase',
                color: '#8C837C',
              }}
            >
              {block.label}
            </div>
            <div
              style={{
                fontFamily: 'var(--font-sans)',
                fontSize: '15px',
                fontWeight: 600,
                lineHeight: '1.4',
                color: '#1B1816',
              }}
            >
              {block.value}
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={() => go?.(ctaPath)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          background: 'transparent',
          border: 'none',
          padding: 0,
          cursor: go ? 'pointer' : 'default',
          fontFamily: 'var(--font-sans)',
          fontSize: '11px',
          fontWeight: 600,
          letterSpacing: '0.16em',
          textTransform: 'uppercase',
          color: '#1B1816',
          borderBottom: '1px solid #1B1816',
          paddingBottom: '2px',
          transition: 'opacity 200ms ease',
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
        {ctaLabel}
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
  );

  return (
    <section style={{ backgroundColor: bgColor, padding: '80px 0' }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '0 40px' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1.04fr 1.36fr',
            gap: '72px',
            alignItems: 'center',
          }}
          className="editorial-feature-grid"
        >
          {imageLeft ? (
            <>
              {imageBlock}
              {textBlock}
            </>
          ) : (
            <>
              {textBlock}
              {imageBlock}
            </>
          )}
        </div>
      </div>

      <style>{`
        @media (max-width: 1023px) {
          .editorial-feature-grid {
            grid-template-columns: 1fr !important;
            gap: 32px !important;
          }
        }

        @media (max-width: 640px) {
          .editorial-feature-grid {
            gap: 24px !important;
          }
          .editorial-feature-grid > div:nth-child(2) {
            width: 100%;
          }
        }
      `}</style>
    </section>
  );
}
