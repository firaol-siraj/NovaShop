import { useEffect, useState } from 'react';
import './App.css';

import Layout from './components/layout/Layout';
import AuthLayout from './components/auth/AuthLayout';
import ProtectedRoute from './components/auth/ProtectedRoute';
// Storefront pages
import Home from './pages/Home';
import ShopPage from './pages/ShopPage';
import ProductDetailPage from './pages/ProductDetailPage';
import CheckoutPage from './pages/CheckoutPage';
import OrderConfirmationPage from './pages/OrderConfirmationPage';
import OrderDetailsPage from './pages/OrderDetailsPage';
import OrderHistoryPage from './pages/OrderHistoryPage';
import LoginPage from './pages/LoginPage';
import SignUpPage from './pages/SignUpPage';
import AccountOverviewPage from './pages/AccountOverviewPage';
import SavedAddressesPage from './pages/SavedAddressesPage';
import ProfilePage from './pages/ProfilePage';
import EditProfilePage from './pages/EditProfilePage';
import SettingsPage from './pages/SettingsPage';
import WishlistPage from './pages/WishlistPage';
import PaymentsPage from './pages/PaymentsPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import VerifyEmailPage from './pages/VerifyEmailPage';
import HelpPage from './pages/HelpPage';
import AboutPage from './pages/AboutPage';
import ShippingReturnsPage from './pages/ShippingReturnsPage';
import PrivacyPolicyPage from './pages/PrivacyPolicyPage';
import NotFoundPage from './pages/NotFoundPage';
import CollectionsPage from './pages/CollectionsPage';
import CollectionDetailPage from './pages/CollectionDetailPage';
import NewsletterConfirmPage from './pages/NewsletterConfirmPage';
import NewsletterUnsubscribePage from './pages/NewsletterUnsubscribePage';
import TermsOfServicePage from './pages/TermsOfServicePage';

// Admin authentication
import AdminSignInPage from './pages/admin/AdminSignInPage';
import AdminForgotPasswordPage from './pages/admin/AdminForgotPasswordPage';
import AdminResetPasswordPage from './pages/admin/AdminResetPasswordPage';

// Admin pages
import AdminDashboardPage from './pages/admin/AdminDashboardPage';
import AdminOrdersPage from './pages/admin/AdminOrdersPage';
import AdminOrderDetailPage from './pages/admin/AdminOrderDetailPage';

import AdminProductsPage from './pages/admin/AdminProductsPage';
import AdminProductDetailPage from './pages/admin/AdminProductDetailPage';
import AdminProductEditPage from './pages/admin/AdminProductEditPage';

import AdminCategoriesPage from './pages/admin/AdminCategoriesPage';
import AdminCategoryEditPage from './pages/admin/AdminCategoryEditPage';

import AdminCustomersPage from './pages/admin/AdminCustomersPage';
import AdminCustomerDetailPage from './pages/admin/AdminCustomerDetailPage';
import AdminCustomerEditPage from './pages/admin/AdminCustomerEditPage';

import AdminInventoryPage from './pages/admin/AdminInventoryPage';
import AdminNotificationsPage from './pages/admin/AdminNotificationsPage';

import AdminDiscountsPage from './pages/admin/AdminDiscountsPage';
import AdminDiscountEditPage from './pages/admin/AdminDiscountEditPage';
import AdminDiscountAddPage from './pages/admin/AdminDiscountAddPage';

import AdminReviewsPage from './pages/admin/AdminReviewsPage';

import AdminAnalyticsOverviewPage from './pages/admin/AdminAnalayticsOverviewPage';
import AdminSalesAnalyticsPage from './pages/admin/AdminSalesAnalyticsPage';
import AdminProductAnalyticsPage from './pages/admin/AdminProductAnalayticsPage';
import AdminCustomerAnalyticsPage from './pages/admin/AdminCustomerAnalayticsPage';

import AdminHomepageContentPage from './pages/admin/AdminHomePageContent';
import AdminHeroSlidesPage from './pages/admin/AdminHeroSlidesPage';
import AdminMediaLibraryPage from './pages/admin/AdminMediaLibrary';

import AdminReturnsPage from './pages/admin/AdminReturn&RefundPage';
import AdminReturnDetailPage from './pages/admin/AdminReturnDetailPage';

import AdminShippingPage from './pages/admin/AdminShippingPage';
import AdminShippingZoneFormPage from './pages/admin/AdminShippingZoneFormPage';
import AdminShippingZoneRatesPage from './pages/admin/AdminShippingZoneRatesPage';
import AdminShippingMethodFormPage from './pages/admin/AdminShippingMethodFormPage';
import AdminShippingSettingsPage from './pages/admin/AdminShippingSettingsPage';

import AdminPaymentsPage from './pages/admin/AdminPaymentsPage';
import AdminPaymentDetailPage from './pages/admin/AdminPaymentDetailPage';
import AdminPaymentSettingsPage from './pages/admin/AdminPaymentSettingsPage';
import AdminPayoutFormPage from './pages/admin/AdminPayoutFormPage';
import AdminPayoutDetailPage from './pages/admin/AdminPayoutDetailPage';
import AdminNotFoundPage from './pages/admin/AdminNotFoundPage';

// Shared admin shell
import AdminLayout from './components/admin/AdminLayout';
import AdminCustomerSupportPage from './pages/admin/AdminCustomerSupportPage';
import AdminSettingsPage from './pages/admin/AdminSettingsPage';
import AdminAcceptInvitePage from './pages/admin/AdminAcceptInvitePage';
import AdminProfilePage from './pages/admin/AdminProfilePage';

import { preloadGoogleIdentityServices } from './lib/googleIdentity';
import { initTracker } from './lib/tracker';



function Placeholder({ title }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 px-6 text-center h-full">
      <div className="w-24 h-24 bg-indigo-50 rounded-full flex items-center justify-center mb-6">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-10 w-10 text-indigo-300"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 0 0-3.86.517l-.318.158a6 6 0 0 1-3.86.517L6.05 15.21a2 2 0 0 0-1.806.547M8 4h8l-1 1v5.172a2 2 0 0 0 .586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 0 0 9 10.172V5L8 4z"
          />
        </svg>
      </div>

      <h1 className="text-3xl font-bold text-gray-900 mb-4">
        {title}
      </h1>

      <p className="text-gray-500 max-w-md">
        This page is currently under construction. Check back soon as we
        implement the new design!
      </p>
    </div>
  );
}


export default function App() {
  const [path, setPath] = useState(window.location.pathname);
  const [search, setSearch] = useState(window.location.search);


  /*
   * Google Identity Services
   */
  useEffect(() => {
    preloadGoogleIdentityServices().catch(() => {});
    initTracker();
  }, []);


  /*
   * Browser back / forward
   */
  useEffect(() => {
    const onPopState = () => {
      setPath(window.location.pathname);
      setSearch(window.location.search);
    };

    window.addEventListener('popstate', onPopState);

    return () => {
      window.removeEventListener('popstate', onPopState);
    };
  }, []);


  /*
   * Application navigation
   */
  const go = (to) => {
    const url = new URL(to, window.location.origin);

    window.history.pushState({}, '', url);

    setPath(url.pathname);
    setSearch(url.search);

    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  };


  /*
   * SearchOverlay navigation event
   */
  useEffect(() => {
    const handler = (event) => {
      if (event.detail?.path) {
        go(event.detail.path);
      }
    };

    window.addEventListener('novashop:navigate', handler);

    return () => {
      window.removeEventListener('novashop:navigate', handler);
    };
  }, []);


  /*
   * ---------------------------------------------------------
   * PAGE ROUTING
   * ---------------------------------------------------------
   */

  let page;


  // =========================================================
  // STOREFRONT
  // =========================================================

  if (path === '/') {
    page = <Home go={go} />;

  } else if (
    path === '/shop' ||
    path === '/collections/all'
  ) {
    page = (
      <ShopPage
        go={go}
        search={search}
      />
    );

  } else if (path.startsWith('/collections/')) {
    const slug = path.split('/')[2];
    if (slug === 'all') {
      page = <ShopPage go={go} search={search} />;
    } else {
      page = <CollectionDetailPage go={go} slug={slug} search={search} />;
    }

  } else if (path === '/collections') {
    page = <CollectionsPage go={go} />;

  } else if (path === '/newsletter/confirm') {
    page = <NewsletterConfirmPage go={go} search={search} />;

  } else if (path === '/newsletter/unsubscribe' || path === '/unsubscribe') {
    page = <NewsletterUnsubscribePage go={go} search={search} />;

  } else if (path.startsWith('/category/')) {
    const category = path.split('/')[2];

    page = (
      <ShopPage
        go={go}
        search={search}
        initialCategory={category}
      />
    );

  } else if (path.startsWith('/products/')) {
    const slug = path.split('/').filter(Boolean)[1];

    page = (
      <ProductDetailPage
        go={go}
        slug={slug}
      />
    );

  } else if (path.startsWith('/product/')) {
    const slug = path.split('/').filter(Boolean)[1];

    page = (
      <ProductDetailPage
        go={go}
        slug={slug}
      />
    );

  } else if (path === '/search') {
    page = <Placeholder title="Search" />;

  } else if (path === '/cart') {
    page = <Placeholder title="Cart" />;

  } else if (path === '/checkout') {
    page = <CheckoutPage go={go} />;

  } else if (
    path === '/checkout/confirmation' ||
    path === '/order-confirmed'
  ) {
    page = <OrderConfirmationPage go={go} />;

  } else if (path === '/account/orders') {
    page = (
      <OrderHistoryPage
        go={go}
        currentPath={path}
      />
    );

  } else if (path.startsWith('/account/orders/')) {
    const orderId = path
      .split('/')
      .filter(Boolean)
      .at(-1);

    page = (
      <OrderDetailsPage
        go={go}
        orderId={orderId}
      />
    );

  } else if (path === '/help') {
    page = <HelpPage go={go} />;

  } else if (path === '/about') {
    page = <AboutPage go={go} />;

  } else if (path === '/shipping-returns') {
    page = <ShippingReturnsPage go={go} />;

  } else if (path === '/privacy-policy') {
    page = <PrivacyPolicyPage go={go} />;

  } else if (path === '/terms-of-service') {
    page = <TermsOfServicePage go={go} />;

  } else if (path === '/support') {
    page = <Placeholder title="Support" />;

  } else if (path === '/orders') {
    page = <OrderHistoryPage go={go} />;

  } else if (path.startsWith('/orders/')) {
    const orderId = path
      .split('/')
      .filter(Boolean)
      .at(-1);

    page = (
      <OrderDetailsPage
        go={go}
        orderId={orderId}
      />
    );


  // =========================================================
  // CUSTOMER AUTH
  // =========================================================

  } else if (
    path === '/login' ||
    path === '/account/login'
  ) {
    page = <LoginPage go={go} />;

  } else if (path === '/forgot-password') {
    page = <ForgotPasswordPage go={go} />;


  // =========================================================
  // ADMIN AUTH
  // =========================================================

  } else if (path === '/admin/login') {
    page = <AdminSignInPage go={go} />;

  } else if (path === '/admin/forgot-password') {
    page = <AdminForgotPasswordPage go={go} />;

  } else if (path === '/admin/reset-password') {
    page = (
      <AdminResetPasswordPage
        go={go}
        search={search}
      />
    );

  } else if (path === '/admin/accept-invite') {
    page = <AdminAcceptInvitePage go={go} />;


  // =========================================================
  // ADMIN DASHBOARD
  // =========================================================

  } else if (path === '/admin/dashboard') {
    page = <AdminDashboardPage go={go} />;


  // =========================================================
  // ADMIN ORDERS
  // =========================================================

  } else if (path === '/admin/orders') {
    page = <AdminOrdersPage go={go} search={search} />;

  } else if (path.startsWith('/admin/orders/')) {
    const orderId = path
      .split('/')
      .filter(Boolean)
      .at(-1);

    page = (
      <AdminOrderDetailPage
        orderId={orderId}
        go={go}
      />
    );


  // =========================================================
  // ADMIN CUSTOMERS
  // =========================================================

  } else if (path === '/admin/customers/new') {
    page = (
      <AdminCustomerEditPage
        go={go}
        mode="create"
      />
    );

  } else if (
    path.startsWith('/admin/customers/') &&
    path.endsWith('/edit')
  ) {
    const customerId = path
      .split('/')
      .filter(Boolean)
      .at(-2);

    page = (
      <AdminCustomerEditPage
        customerId={customerId}
        go={go}
        mode="edit"
      />
    );

  } else if (path.startsWith('/admin/customers/')) {
    const customerId = path
      .split('/')
      .filter(Boolean)
      .at(-1);

    page = (
      <AdminCustomerDetailPage
        customerId={customerId}
        go={go}
      />
    );

  } else if (path === '/admin/customers') {
    page = <AdminCustomersPage go={go} search={search} />;


  // =========================================================
  // ADMIN PRODUCTS
  // =========================================================

  } else if (path === '/admin/products/new') {
    page = (
      <AdminProductEditPage
        go={go}
        mode="create"
      />
    );

  } else if (
    path.startsWith('/admin/products/') &&
    path.endsWith('/edit')
  ) {
    const productId = path
      .split('/')
      .filter(Boolean)
      .at(-2);

    page = (
      <AdminProductEditPage
        productId={productId}
        go={go}
        mode="edit"
      />
    );

  } else if (path.startsWith('/admin/products/')) {
    const productId = path
      .split('/')
      .filter(Boolean)
      .at(-1);

    page = <AdminProductDetailPage productId={productId} go={go} />;

  } else if (path === '/admin/products') {
    page = <AdminProductsPage go={go} search={search} />;


  // =========================================================
  // ADMIN CATEGORIES
  // =========================================================

  } else if (path === '/admin/categories') {
    page = <AdminCategoriesPage go={go} />;

  } else if (path === '/admin/categories/new') {
    page = (
      <AdminCategoryEditPage
        go={go}
        mode="create"
      />
    );

  } else if (
    path.startsWith('/admin/categories/') &&
    path.endsWith('/edit')
  ) {
    const categoryId = path
      .split('/')
      .filter(Boolean)
      .at(-2);

    page = (
      <AdminCategoryEditPage
        categoryId={categoryId}
        go={go}
      />
    );


  // =========================================================
  // ADMIN INVENTORY
  // =========================================================

  } else if (path === '/admin/inventory') {
    page = <AdminInventoryPage go={go} />;


  // =========================================================
  // ADMIN NOTIFICATIONS
  // =========================================================

  } else if (path === '/admin/notifications') {
    page = <AdminNotificationsPage go={go} />;


  // =========================================================
  // ADMIN DISCOUNTS
  // =========================================================

  } else if (
    path === '/admin/discounts/autumn-sale/edit'
  ) {
    page = (
      <AdminDiscountEditPage
        go={go}
      />
    );

  } else if (path === '/admin/discounts') {
    page = <AdminDiscountsPage go={go} />;
  } else if (path === '/admin/discounts/new') {
    page = (
      <AdminDiscountAddPage
        go={go}
      />
    );

    // =========================================================
  // ADMIN ReviewS
  // =========================================================

  } else if (path === '/admin/reviews') {
    page = <AdminReviewsPage go={go} />;

    // =========================================================
  // ADMIN Analaytics
  // =========================================================

  } else if (path === '/admin/analytics' || path === '/admin/analytics/overview') {
    page = <AdminAnalyticsOverviewPage go={go} />;

  } else if (path === '/admin/analytics/sales') {
    page = <AdminSalesAnalyticsPage go={go} />;

  }
  else if (path === '/admin/analytics/products') {
    page = <AdminProductAnalyticsPage go={go} />;

  } else if (path === '/admin/analytics/customers') {
    page = <AdminCustomerAnalyticsPage go={go} />;

    // =========================================================
  // Admin Contents
  // =========================================================
  } else if (path === '/admin/content' || path === '/admin/content/homepage') {
    page = <AdminHomepageContentPage go={go} />;

  } else if (path === '/admin/content/hero' || path === '/admin/content/hero-slides') {
    page = <AdminHeroSlidesPage go={go} />;

  } else if (path === '/admin/content/media') {
    page = <AdminMediaLibraryPage title="Media library" />;

    // =========================================================
  // Admin Return and Refunds
  // =========================================================

  } else if (path.startsWith('/admin/returns/')) {
    const returnId = path
      .split('/')
      .filter(Boolean)
      .at(-1);

    page = (
      <AdminReturnDetailPage
        returnId={returnId}
        go={go}
      />
    );

  } else if(path ==='/admin/returns') {
    page = <AdminReturnsPage go={go} search={search} />;

     // =========================================================
  // Admin Shipping
  // =========================================================
   } else if (path === '/admin/shipping/settings') {
    page = <AdminShippingSettingsPage go={go} />;

   } else if (path === '/admin/shipping/zones/new') {
    page = <AdminShippingZoneFormPage go={go} />;

   } else if (path.startsWith('/admin/shipping/zones/') && path.endsWith('/edit')) {
    const parts = path.split('/').filter(Boolean);
    const zoneId = parts[3];
    page = <AdminShippingZoneFormPage zoneId={zoneId} go={go} />;

   } else if (path.startsWith('/admin/shipping/zones/') && path.endsWith('/rates')) {
    const parts = path.split('/').filter(Boolean);
    const zoneId = parts[3];
    page = <AdminShippingZoneRatesPage zoneId={zoneId} go={go} />;

   } else if (path === '/admin/shipping/methods/new') {
    page = <AdminShippingMethodFormPage go={go} />;

   } else if (path.startsWith('/admin/shipping/methods/') && path.endsWith('/edit')) {
    const parts = path.split('/').filter(Boolean);
    const methodId = parts[3];
    page = <AdminShippingMethodFormPage methodId={methodId} go={go} />;

   } else if (path === '/admin/shipping') {
    page = <AdminShippingPage go={go} />;

     // =========================================================
  // Admin Payments
  // =========================================================
  } else if (path === '/admin/payments/settings') {
    page = <AdminPaymentSettingsPage go={go} />;

  } else if (path === '/admin/payments/payouts/new') {
    page = <AdminPayoutFormPage go={go} />;

  } else if (path.startsWith('/admin/payments/payouts/')) {
    const payoutId = path.split('/').filter(Boolean).at(-1);
    page = <AdminPayoutDetailPage payoutId={payoutId} go={go} />;

  } else if (path.startsWith('/admin/payments/') && path !== '/admin/payments') {
    const paymentId = path.split('/').filter(Boolean).at(-1);
    page = <AdminPaymentDetailPage paymentId={paymentId} go={go} />;

  } else if (path === '/admin/payments') {
    page = <AdminPaymentsPage go={go} />;

     // =========================================================
  // Admin Support
  // =========================================================
  } else if(path ==='/admin/support') {
    page = <AdminCustomerSupportPage go={go} search={search} />;

     // =========================================================
  // Admin Profile
  // =========================================================
  } else if(path === '/admin/profile') {
    page = <AdminProfilePage go={go} />;

     // =========================================================
  // Admin Settings
  // =========================================================
  } else if(path.startsWith('/admin/settings')) {
    page = <AdminSettingsPage go={go} currentPath={path} />;

     // =========================================================
  // Accounts
  // =========================================================
  } else if (path === '/reset-password') {
    page = (
      <ResetPasswordPage
        go={go}
        search={search}
      />
    );

  } else if (path === '/verify-email' || path.startsWith('/verify-email/')) {
    page = (
      <VerifyEmailPage
        go={go}
        search={search}
        path={path}
      />
    );

  } else if (
    path === '/signup' ||
    path === '/account/signup' ||
    path === '/register'
  ) {
    page = <SignUpPage go={go} />;

  } else if (path === '/account') {
    page = (
      <AccountOverviewPage
        go={go}
        currentPath={path}
      />
    );

  } else if (path === '/account/addresses') {
    page = (
      <SavedAddressesPage
        go={go}
        currentPath={path}
      />
    );

  } else if (path === '/account/profile') {
    page = (
      <ProfilePage
        go={go}
        currentPath={path}
      />
    );

  } else if (path === '/account/profile/edit') {
    page = (
      <EditProfilePage
        go={go}
        currentPath={path}
      />
    );

  } else if (path === '/account/settings') {
    page = (
      <SettingsPage
        go={go}
        currentPath={path}
      />
    );

  } else if (path === '/account/payments') {
    page = (
      <PaymentsPage
        go={go}
        currentPath={path}
      />
    );

  } else if (path === '/account/wishlist') {
    page = (
      <WishlistPage
        go={go}
        currentPath={path}
      />
    );

  } else if (path === '/wishlist') {
    page = (
      <WishlistPage
        go={go}
        currentPath="/account/wishlist"
      />
    );

  } else if (path.startsWith('/admin')) {
    page = <AdminNotFoundPage go={go} />;
  } else {
    page = <NotFoundPage go={go} />;
  }


  /*
   * ---------------------------------------------------------
   * LAYOUT DETECTION
   * ---------------------------------------------------------
   */

  const isAuthPage = [
    '/login',
    '/signup',
    '/forgot-password',
    '/reset-password',
    '/account/login',
    '/account/signup',
  ].includes(path);


  const isAdminPage = path.startsWith('/admin') || path === '/admin';
  const isAdminAuth = [
    '/admin/login',
    '/admin/forgot-password',
    '/admin/reset-password',
    '/admin/accept-invite',
  ].includes(path);

  /*
   * All authenticated /admin/* pages use AdminLayout.
   */
  const usesAdminLayout = isAdminPage && !isAdminAuth;
  /*
   * ---------------------------------------------------------
   * RENDER WITH CORRECT LAYOUT
   * ---------------------------------------------------------
   */

  const renderPage = () => {
    const isAccountPage = path.startsWith('/account') || path === '/checkout' || path.startsWith('/orders');
    const isAdminProtected = isAdminPage && path !== '/admin/login' && path !== '/admin/forgot-password' && path !== '/admin/reset-password' && path !== '/admin/accept-invite';

    let content = page;
    if (isAdminProtected) {
      content = <ProtectedRoute go={go} adminOnly={true}>{page}</ProtectedRoute>;
    } else if (isAccountPage && !isAuthPage) {
      content = <ProtectedRoute go={go}>{page}</ProtectedRoute>;
    }

    // -------------------------------------------------------
    // Customer authentication pages
    // -------------------------------------------------------
    if (isAuthPage) {
      return (
        <AuthLayout
          go={go}
          hideBackLink={
            path === '/forgot-password' ||
            path === '/reset-password'
          }
        >
          {content}
        </AuthLayout>
      );
    }


    // -------------------------------------------------------
    // Admin pages
    // -------------------------------------------------------
    if (isAdminPage) {

      /*
       * Admin authentication pages intentionally DO NOT use
       * the normal admin sidebar/topbar.
       *
       * /admin/login
       * /admin/forgot-password
       * /admin/reset-password
       */
      if (usesAdminLayout) {

        /*
         * Determine which sidebar item should be active.
         *
         * This is what makes:
         *
         * /admin/inventory
         * /admin/inventory/...
         *
         * highlight Inventory.
         *
         * And:
         *
         * /admin/discounts
         * /admin/discounts/autumn-sale/edit
         *
         * highlight Discounts.
         */

        let activePath = path;

        if (path.startsWith('/admin/orders')) {
          activePath = '/admin/orders';

        } else if (path.startsWith('/admin/products')) {
          activePath = '/admin/products';

        } else if (path.startsWith('/admin/categories')) {
          activePath = '/admin/categories';

        } else if (path.startsWith('/admin/customers')) {
          activePath = '/admin/customers';

        } else if (path.startsWith('/admin/inventory')) {
          activePath = '/admin/inventory';

        } else if (path.startsWith('/admin/discounts')) {
          activePath = '/admin/discounts';

        } else if (path.startsWith('/admin/reviews')) {
          activePath = '/admin/reviews';
        } else if (path === '/admin/analytics' || path.startsWith('/admin/analytics/overview')) {
          activePath = '/admin/analytics/overview';

        } else if (path.startsWith('/admin/analytics/sales')) {
          activePath = '/admin/analytics/sales';

        } else if (path.startsWith('/admin/analytics/products')) {
          activePath = '/admin/analytics/products';

        } else if (path.startsWith('/admin/analytics/customers')) {
          activePath = '/admin/analytics/customers';

        } else if (path === '/admin/content' || path.startsWith('/admin/content/homepage')) {
          activePath = '/admin/content/homepage';

        } else if (path.startsWith('/admin/content/hero') || path.startsWith('/admin/content/hero-slides')) {
          activePath = '/admin/content/hero';

        } else if (path.startsWith('/admin/content/media')) {
          activePath = '/admin/content/media';

        // Returns & refunds detail pages (/admin/returns/RT-2041) should
        // still highlight the "Returns and refunds" sidebar item.
        } else if (path.startsWith('/admin/returns')) {
          activePath = '/admin/returns';

        } else if (path.startsWith('/admin/shipping')) {
          activePath = '/admin/shipping';

        } else if (path.startsWith('/admin/payments')) {
          activePath = '/admin/payments';

        } else if (path === '/admin/dashboard') {
          activePath = '/admin/dashboard';
        }


        /*
         * Order detail breadcrumb support.
         *
         * We only pass the order ID to AdminLayout for order
         * detail pages.
         */
        const orderId = path.startsWith('/admin/orders/')
          ? path
              .split('/')
              .filter(Boolean)
              .at(-1)
          : '';


        return (
          <AdminLayout
            go={go}
            activePath={activePath}
            breadcrumb={
              orderId
                ? `#${orderId}`
                : undefined
            }
          >
            {content}
          </AdminLayout>
        );
      }


      /*
       * Admin authentication pages and any future admin page
       * that has not yet been added to the shared shell.
       */
      return content;
    }


    // -------------------------------------------------------
    // Normal storefront pages
    // -------------------------------------------------------
    return (
      <Layout
        go={go}
        currentPath={
          path === '/shipping-returns' &&
          search.includes('from=help')
            ? '/help'
            : path
        }
      >
        {content}
      </Layout>
    );
  };


  return (
    <>
      {renderPage()}
    </>
  );
}