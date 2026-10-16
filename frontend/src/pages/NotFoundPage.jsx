import { useEffect } from 'react';

const T = {
  bg: '#FAF7F2',
  espresso: '#231E1B',
  muted: '#6E6962',
};

export default function NotFoundPage({ go }) {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <>
      <style>{`
        .nf-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 60vh;
          padding: 80px 24px;
          text-align: center;
          background: ${T.bg};
        }
        
        .nf-numeral {
          font-family: var(--font-serif);
          font-size: clamp(70px, 15vw, 110px);
          font-weight: 300;
          color: rgba(35, 30, 27, 0.4); /* Faded gray-black */
          line-height: 1;
          margin: 0 0 16px;
          letter-spacing: -0.02em;
        }

        .nf-heading {
          font-family: var(--font-serif);
          font-size: clamp(24px, 5vw, 32px);
          font-weight: 400;
          color: ${T.espresso};
          margin: 0 0 16px;
        }

        .nf-subtext {
          font-family: var(--font-sans);
          font-size: 15px;
          color: ${T.muted};
          margin: 0 0 40px;
          max-width: 400px;
          line-height: 1.6;
        }

        .nf-btn-home {
          background: ${T.espresso};
          color: #FFF;
          border: none;
          padding: 16px 36px;
          font-family: var(--font-sans);
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          cursor: pointer;
          transition: opacity 0.2s;
          width: 100%;
          max-width: 280px;
          margin-bottom: 24px;
        }
        
        .nf-btn-home:hover {
          opacity: 0.8;
        }

        .nf-link-shop {
          font-family: var(--font-sans);
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: ${T.muted};
          text-decoration: underline;
          text-underline-offset: 4px;
          cursor: pointer;
          transition: color 0.2s;
          background: none;
          border: none;
          padding: 0;
        }
        
        .nf-link-shop:hover {
          color: ${T.espresso};
        }

        @media (max-width: 767px) {
          .nf-container {
            min-height: 50vh;
            padding: 60px 24px;
          }
        }
      `}</style>
      
      <div className="nf-container">
        <div style={{ maxWidth: '450px', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div className="nf-numeral">404</div>
          <h1 className="nf-heading">Page not found</h1>
          <p className="nf-subtext">
            The page you're looking for doesn't exist or may have moved.
          </p>
          <button className="nf-btn-home" onClick={() => go('/')}>
            Back to Home
          </button>
          <button className="nf-link-shop" onClick={() => go('/shop')}>
            Continue Shopping
          </button>
        </div>
      </div>
    </>
  );
}
