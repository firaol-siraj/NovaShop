import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Unhandled UI error caught by ErrorBoundary:', error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'var(--bg-main)',
            color: 'var(--text-primary)',
            padding: '24px',
            textAlign: 'center',
            fontFamily: "var(--font-sans, system-ui, -apple-system, sans-serif)",
          }}
        >
          <div
            style={{
              maxWidth: '480px',
              padding: '36px',
              background: 'var(--bg-surface)',
              borderRadius: '12px',
              border: '1px solid var(--border-default)',
              boxShadow: 'var(--shadow-md)',
            }}
          >
            <h2
              style={{
                fontFamily: "var(--font-serif, serif)",
                fontSize: '26px',
                fontWeight: 500,
                margin: '0 0 12px',
                color: 'var(--text-primary)',
              }}
            >
              Something went wrong
            </h2>
            <p
              style={{
                fontSize: '14px',
                color: 'var(--text-muted)',
                lineHeight: 1.6,
                margin: '0 0 24px',
              }}
            >
              An unexpected error occurred while loading this page. Please refresh to try again.
            </p>
            <button
              onClick={this.handleReload}
              style={{
                backgroundColor: 'var(--color-primary)',
                color: 'var(--color-primary-contrast)',
                border: 'none',
                padding: '12px 28px',
                fontSize: '12px',
                fontWeight: 600,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              Refresh Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
