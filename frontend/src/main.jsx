import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { AuthProvider } from './context/AuthContext'
import { CartProvider } from './context/CartContext'
import { CategoryProvider } from './context/CategoryContext'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <CategoryProvider>
        <CartProvider>
          <App />
        </CartProvider>
      </CategoryProvider>
    </AuthProvider>
  </StrictMode>,
)
