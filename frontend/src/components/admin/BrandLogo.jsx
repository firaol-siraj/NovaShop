export default function BrandLogo({ className = '' }) {
  return (
    <div className={`admin-brand-lockup ${className}`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: 1 }}>
      <span className="admin-brand-name" style={{ color: '#0B0805', fontFamily: 'var(--font-serif)', fontSize: '98px', fontWeight: 600, lineHeight: 1.05 }}>
        NovaShop
      </span>
    </div>
  );
}
