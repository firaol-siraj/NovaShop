import { useEffect, useState } from 'react';
import Navbar from './Navbar';
import Footer from './Footer';
import ShoppingBagDrawer from '../cart/ShoppingBagDrawer';
import WishlistDrawer from '../cart/WishlistDrawer';
import SearchOverlay from '../search/SearchOverlay';
import Toast from '../ui/Toast';

function CartToastHost() {
  const [message, setMessage] = useState('');

  useEffect(() => {
    let timer;
    const onToast = (event) => {
      const next = event.detail?.message;
      if (!next) return;
      setMessage(next);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setMessage(''), 2800);
    };
    window.addEventListener('novashop:toast', onToast);
    return () => {
      window.removeEventListener('novashop:toast', onToast);
      window.clearTimeout(timer);
    };
  }, []);

  return <Toast message={message} />;
}

export default function Layout({ children, go, currentPath }) {
  const isCheckoutFlow = currentPath === '/checkout' || currentPath === '/checkout/confirmation' || currentPath === '/order-confirmed';
  const isOrderFlow = currentPath === '/orders' || currentPath.startsWith('/orders/');
  const isAuthFlow = currentPath === '/login' || currentPath === '/account/login' || currentPath === '/signup' || currentPath === '/account/signup' || currentPath === '/register';

  if (isCheckoutFlow || isAuthFlow) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: 'var(--color-bg-main)', color: 'var(--color-text-deep)' }}>
        {children}
        {!isAuthFlow && <ShoppingBagDrawer go={go} />}
        {!isAuthFlow && <WishlistDrawer go={go} />}
        <SearchOverlay go={go} />
        <CartToastHost />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen" style={{ backgroundColor: 'var(--color-bg-main)', color: 'var(--color-text-deep)' }}>
      <Navbar go={go} currentPath={currentPath} hideAnnouncementBar={currentPath === '/' || currentPath === '' || currentPath === '/privacy-policy'} />
      <main className="flex-grow">
        {children}
      </main>
      {!isOrderFlow && <Footer go={go} />}
      <ShoppingBagDrawer go={go} />
      <WishlistDrawer go={go} />
      <SearchOverlay go={go} />
      <CartToastHost />
    </div>
  );
}
