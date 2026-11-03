import { AdminIcon } from '../../components/admin/AdminLayout';

/**
 * Universal 404 Page for unrecognized /admin/* routes.
 * Rendered within AdminLayout preserving the header, sidebar, and theme tokens.
 */
export default function AdminNotFoundPage({ go }) {
  const handleBackToDashboard = () => {
    if (go) {
      go('/admin/dashboard');
    } else {
      window.location.href = '/admin/dashboard';
    }
  };

  return (
    <div className="admin-dashboard admin-not-found-page" style={{ padding: '40px 24px', maxWidth: '640px', margin: '0 auto', textAlign: 'center' }}>
      <div
        style={{
          width: '72px',
          height: '72px',
          margin: '0 auto 24px',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--bg-surface-raised, #F8F6F2)',
          border: '1px solid var(--border-default, #E9E3DB)',
          color: 'var(--color-gold, #D7A45F)',
        }}
      >
        <AdminIcon name="searchSlash" size={36} />
      </div>

      <span
        style={{
          display: 'inline-block',
          fontSize: '12px',
          fontWeight: 600,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: 'var(--color-gold, #D7A45F)',
          marginBottom: '8px',
        }}
      >
        Error 404
      </span>

      <h1
        style={{
          fontFamily: 'var(--font-serif, "Playfair Display", Georgia, serif)',
          fontSize: '32px',
          fontWeight: 600,
          color: 'var(--text-primary, #1F1B18)',
          margin: '0 0 12px',
        }}
      >
        Admin Page Not Found
      </h1>

      <p
        style={{
          fontSize: '15px',
          lineHeight: 1.6,
          color: 'var(--text-secondary, #7A7267)',
          margin: '0 0 32px',
        }}
      >
        The admin route you requested does not exist, was moved, or requires different administrative privileges.
      </p>

      <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
        <button
          type="button"
          onClick={handleBackToDashboard}
          className="admin-action-button is-primary"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 20px',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          <AdminIcon name="dashboard" size={16} />
          Back to Dashboard
        </button>

        <button
          type="button"
          onClick={() => window.history.back()}
          className="admin-action-button"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 20px',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          <AdminIcon name="left" size={16} />
          Go Back
        </button>
      </div>
    </div>
  );
}
