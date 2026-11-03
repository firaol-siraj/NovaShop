import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import ErrorBoundary from './components/ui/ErrorBoundary'
import { AuthProvider } from './context/AuthContext'
import { AdminAuthProvider } from './context/AdminAuthContext'
import { CartProvider } from './context/CartContext'
import { CategoryProvider } from './context/CategoryContext'
import { ThemeProvider } from './context/ThemeContext'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <ThemeProvider>
        <AdminAuthProvider>
          <AuthProvider>
            <CategoryProvider>
              <CartProvider>
                <App />
              </CartProvider>
            </CategoryProvider>
          </AuthProvider>
        </AdminAuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  </StrictMode>,
)
