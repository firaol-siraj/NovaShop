import React, { useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';

export default function ProtectedRoute({ children, go, adminOnly = false }) {
  const { user, isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading) {
      if (!isAuthenticated) {
        if (adminOnly) {
          const destination = `${window.location.pathname}${window.location.search}`;
          go(`/admin/login?redirect=${encodeURIComponent(destination)}`);
        } else {
          go('/login');
        }
      } else if (adminOnly && user?.role !== 'admin') {
        go('/');
      }
    }
  }, [isLoading, isAuthenticated, user, go, adminOnly]);

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#FDFBF7' }}>
        <p style={{ fontFamily: 'var(--font-sans)', fontSize: '14px', color: '#7A726C', letterSpacing: '0.05em' }}>Loading...</p>
      </div>
    );
  }

  if (!isAuthenticated || (adminOnly && user?.role !== 'admin')) {
    return null;
  }

  return children;
}
