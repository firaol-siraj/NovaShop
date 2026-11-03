import React, { useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useAdminAuth } from '../../context/AdminAuthContext';

export default function ProtectedRoute({ children, go, adminOnly = false }) {
  const customerAuth = useAuth();
  const adminAuth = useAdminAuth();

  const { user, isAuthenticated, isLoading } = adminOnly ? adminAuth : customerAuth;

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
        go('/admin/login');
      }
    }
  }, [isLoading, isAuthenticated, user, go, adminOnly]);

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: 'var(--bg-main)' }}>
        <p style={{ fontFamily: 'var(--font-sans)', fontSize: '14px', color: 'var(--text-secondary)', letterSpacing: '0.05em' }}>Loading...</p>
      </div>
    );
  }

  if (!isAuthenticated || (adminOnly && user?.role !== 'admin')) {
    return null;
  }

  return children;
}
