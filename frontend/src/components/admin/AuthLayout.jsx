import './admin-auth.css';
import BrandLogo from './BrandLogo';
import heroImage from '../../assets/hero/hero3.jpg';

export default function AuthLayout({
  children,
  showFooter = true,
  formMaxWidth = 255,
  imageSrc = heroImage,
  imageAlt = 'Editorial fashion rack display',
  className = '',
}) {
  return (
    <div className={`admin-auth-shell ${className}`}>
      <div className="admin-auth-left-panel">
        <div className="admin-auth-brand-wrap">
          <BrandLogo />
        </div>

        <div className="admin-auth-form-panel" style={{ maxWidth: `${formMaxWidth}px` }}>
          {children}
        </div>

        {showFooter && (
          <footer className="admin-auth-footer">
            <div className="admin-auth-footer-copy">© 2026 NovaShop Inc.</div>
            <div className="admin-auth-footer-links">
              <a href="#">Privacy</a>
              <a href="#">Terms</a>
            </div>
          </footer>
        )}
      </div>

      <div className="admin-auth-right-panel" aria-label="Luxury fashion editorial image">
        <img
          className="admin-auth-image"
          src={imageSrc}
          alt={imageAlt}
        />
      </div>
    </div>
  );
}
