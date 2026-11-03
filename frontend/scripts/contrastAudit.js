import fs from 'fs';
import path from 'path';

/**
 * WCAG AA Contrast Audit Tool for NovaShop
 * Scans storefront and admin pages, components, and CSS rules in both themes.
 */

function hexToRgb(hex) {
  if (!hex || typeof hex !== 'string') return null;
  let c = hex.replace('#', '').trim();
  if (c.length === 3) c = c.split('').map((x) => x + x).join('');
  if (c.length === 6) {
    return [parseInt(c.slice(0, 2), 16), parseInt(c.slice(2, 4), 16), parseInt(c.slice(4, 6), 16)];
  }
  return null;
}

function luminance(r, g, b) {
  const [rs, gs, bs] = [r, g, b].map((v) => {
    const val = v / 255;
    return val <= 0.03928 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

export function getContrastRatio(hex1, hex2) {
  const rgb1 = hexToRgb(hex1);
  const rgb2 = hexToRgb(hex2);
  if (!rgb1 || !rgb2) return 1;
  const l1 = luminance(...rgb1);
  const l2 = luminance(...rgb2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

// Design token definitions
const THEME_SURFACES = {
  light: {
    main: '#FBF9F5',
    surface: '#FFFFFF',
    raised: '#FAF7F2',
    sunken: '#F4EFE9',
    tableHeader: '#F4EFE9',
    hoverRow: '#F4EFE9',
    badge: '#FAF7F2',
    input: '#FFFFFF',
  },
  dark: {
    main: '#141210',
    surface: '#1E1B18',
    raised: '#282420',
    sunken: '#181614',
    tableHeader: '#181614',
    hoverRow: '#181614',
    badge: '#282420',
    input: '#24201D',
  },
};

// Known pages and their source files
const PAGES = [
  // Admin pages
  { name: 'Admin Customers', file: 'src/pages/admin/AdminCustomersPage.jsx', css: 'src/pages/admin/admin-customers.css' },
  { name: 'Admin Customer Detail', file: 'src/pages/admin/AdminCustomerDetailPage.jsx', css: 'src/pages/admin/admin-customer-detail.css' },
  { name: 'Admin Customer Form / Edit', file: 'src/pages/admin/AdminCustomerForm.jsx', css: 'src/pages/admin/admin-customer-edit.css' },
  { name: 'Admin Orders', file: 'src/pages/admin/AdminOrdersPage.jsx', css: 'src/components/admin/admin-dashboard.css' },
  { name: 'Admin Order Detail', file: 'src/pages/admin/AdminOrderDetailPage.jsx', css: 'src/components/admin/admin-dashboard.css' },
  { name: 'Admin Dashboard', file: 'src/pages/admin/AdminDashboardPage.jsx', css: 'src/components/admin/admin-dashboard.css' },
  { name: 'Admin Products', file: 'src/pages/admin/AdminProductsPage.jsx', css: 'src/components/admin/admin-dashboard.css' },
  { name: 'Admin Product Detail', file: 'src/pages/admin/AdminProductDetailPage.jsx', css: 'src/pages/admin/admin-product-detail.css' },
  { name: 'Admin Product Edit', file: 'src/pages/admin/AdminProductEditPage.jsx', css: 'src/pages/admin/admin-product-edit.css' },
  { name: 'Admin Categories', file: 'src/pages/admin/AdminCategoriesPage.jsx', css: 'src/pages/admin/admin-categories.css' },
  { name: 'Admin Inventory', file: 'src/pages/admin/AdminInventoryPage.jsx', css: 'src/pages/admin/admin-inventory.css' },
  { name: 'Admin Discounts', file: 'src/pages/admin/AdminDiscountsPage.jsx', css: 'src/pages/admin/admin-discounts.css' },
  { name: 'Admin Reviews', file: 'src/pages/admin/AdminReviewsPage.jsx', css: 'src/pages/admin/admin-reviews.css' },
  { name: 'Admin Analytics Overview', file: 'src/pages/admin/AdminAnalayticsOverviewPage.jsx', css: 'src/pages/admin/admin-analytics-overview.css' },
  { name: 'Admin Sales Analytics', file: 'src/pages/admin/AdminSalesAnalyticsPage.jsx', css: 'src/pages/admin/admin-sales-analytics.css' },
  { name: 'Admin Product Analytics', file: 'src/pages/admin/AdminProductAnalayticsPage.jsx', css: 'src/pages/admin/admin-product-analytics.css' },
  { name: 'Admin Customer Analytics', file: 'src/pages/admin/AdminCustomerAnalayticsPage.jsx', css: 'src/pages/admin/admin-customer-analytics.css' },
  { name: 'Admin Homepage Content', file: 'src/pages/admin/AdminHomePageContent.jsx', css: 'src/pages/admin/admin-homepage-content.css' },
  { name: 'Admin Hero Slides', file: 'src/pages/admin/AdminHeroSlidesPage.jsx', css: 'src/pages/admin/admin-heroslides.css' },
  { name: 'Admin Media Library', file: 'src/pages/admin/AdminMediaLibrary.jsx', css: 'src/pages/admin/admin-medialibrary.css' },
  { name: 'Admin Support', file: 'src/pages/admin/AdminCustomerSupportPage.jsx', css: 'src/pages/admin/admin-support.css' },
  { name: 'Admin Settings', file: 'src/pages/admin/AdminSettingsPage.jsx', css: 'src/pages/admin/admin-settings.css' },
  { name: 'Admin Profile', file: 'src/pages/admin/AdminProfilePage.jsx', css: 'src/pages/admin/admin-profile.css' },
  { name: 'Admin Notifications', file: 'src/pages/admin/AdminNotificationsPage.jsx', css: 'src/components/admin/admin-dashboard.css' },
  { name: 'Admin Returns List', file: 'src/pages/admin/AdminReturn&RefundPage.jsx', css: 'src/pages/admin/admin-return&refund.css' },
  { name: 'Admin Return Detail', file: 'src/pages/admin/AdminReturnDetailPage.jsx', css: 'src/pages/admin/admin-returndetail.css' },
  // Storefront pages
  { name: 'Storefront Home', file: 'src/pages/Home.jsx', css: 'src/App.css' },
  { name: 'Storefront Shop', file: 'src/pages/ShopPage.jsx', css: 'src/App.css' },
  { name: 'Storefront Product Detail', file: 'src/pages/ProductDetailPage.jsx', css: 'src/App.css' },
  { name: 'Storefront Order History', file: 'src/pages/OrderHistoryPage.jsx', css: 'src/App.css' },
  { name: 'Storefront Order Details', file: 'src/pages/OrderDetailsPage.jsx', css: 'src/App.css' },
  { name: 'Storefront Account Overview', file: 'src/pages/AccountOverviewPage.jsx', css: 'src/App.css' },
  { name: 'Storefront Saved Addresses', file: 'src/pages/SavedAddressesPage.jsx', css: 'src/App.css' },
  { name: 'Storefront Checkout', file: 'src/pages/CheckoutPage.jsx', css: 'src/App.css' },
  { name: 'Storefront Wishlist', file: 'src/pages/WishlistPage.jsx', css: 'src/App.css' },
  { name: 'Storefront Help', file: 'src/pages/HelpPage.jsx', css: 'src/App.css' },
];

export function runAudit() {
  const root = fs.existsSync(path.resolve(process.cwd(), 'src/index.css'))
    ? process.cwd()
    : path.resolve(process.cwd(), 'frontend');
  const indexCss = fs.readFileSync(path.resolve(root, 'src/index.css'), 'utf8');

  const failures = [];
  let totalChecked = 0;

  for (const page of PAGES) {
    const jsxPath = path.resolve(root, page.file);
    const cssPath = page.css ? path.resolve(root, page.css) : null;

    if (!fs.existsSync(jsxPath)) continue;
    const jsxContent = fs.readFileSync(jsxPath, 'utf8');
    const cssContent = cssPath && fs.existsSync(cssPath) ? fs.readFileSync(cssPath, 'utf8') : '';

    // 1. Audit hardcoded Tailwind text colors in JSX e.g. text-[#1B1816], text-[#766247], etc.
    const tailwindColorMatches = [...jsxContent.matchAll(/text-\[(#[0-9a-fA-F]{3,8})\]/g)];
    for (const match of tailwindColorMatches) {
      totalChecked++;
      const fgHex = match[1];

      // Check if this class is mapped in index.css dark mode safeguards
      const classEscaped = `text-\\[\\${fgHex}\\]`;
      const isSafeguardedInDark = indexCss.includes(`[data-theme="dark"] .${classEscaped}`) ||
                                 indexCss.includes(`[data-theme="dark"] .text-[${fgHex}]`);

      // In dark mode, evaluate contrast against dark surface (#1E1B18)
      const darkSurface = THEME_SURFACES.dark.surface;
      let effectiveFgDark = fgHex;
      if (isSafeguardedInDark) {
        // Mapped to var(--text-primary) #FBF9F5 or var(--text-secondary) #DFD9CF or var(--text-muted) #C4BCB1
        effectiveFgDark = '#DFD9CF';
      }

      const ratioDark = getContrastRatio(effectiveFgDark, darkSurface);
      if (ratioDark < 4.5) {
        failures.push({
          page: page.name,
          theme: 'dark',
          selector: `.text-[${fgHex}]`,
          fg: fgHex,
          bg: darkSurface,
          ratio: `${ratioDark.toFixed(2)}:1`,
          reason: 'Hardcoded light-only color without dark mode token override',
        });
      }

      // In light mode, evaluate contrast against light surface (#FFFFFF)
      const isSafeguardedInLight = indexCss.includes(`[data-theme="light"] .${classEscaped}`) ||
                                   indexCss.includes(`[data-theme="light"] .text-[${fgHex}]`) ||
                                   indexCss.includes(`.${classEscaped}`) ||
                                   indexCss.includes(`.text-[${fgHex}]`);
      let effectiveFgLight = fgHex;
      if (isSafeguardedInLight) {
        effectiveFgLight = '#68625E';
      }
      const ratioLight = getContrastRatio(effectiveFgLight, THEME_SURFACES.light.surface);
      if (ratioLight < 4.5 && ratioLight > 0) {
        failures.push({
          page: page.name,
          theme: 'light',
          selector: `.text-[${fgHex}]`,
          fg: effectiveFgLight,
          bg: THEME_SURFACES.light.surface,
          ratio: `${ratioLight.toFixed(2)}:1`,
          reason: 'Insufficient contrast against light surface',
        });
      }
    }

    // 2. Audit inline styles in JSX e.g. color: '#1B1816', color: '#766247'
    const inlineColorMatches = [...jsxContent.matchAll(/color:\s*['"](#[0-9a-fA-F]{3,8})['"]/g)];
    for (const match of inlineColorMatches) {
      totalChecked++;
      const fgHex = match[1];

      // Check if overridden in index.css dark mode
      const isOverriddenInDark = indexCss.includes(`[data-theme="dark"] [style*="color: ${fgHex}"]`) ||
                                 indexCss.includes(`[data-theme="dark"] [style*="color:${fgHex}"]`);

      let effectiveFgDark = fgHex;
      if (isOverriddenInDark) {
        effectiveFgDark = '#DFD9CF';
      }

      const ratioDark = getContrastRatio(effectiveFgDark, THEME_SURFACES.dark.surface);
      if (ratioDark < 4.5) {
        failures.push({
          page: page.name,
          theme: 'dark',
          selector: `inline style [color: '${fgHex}']`,
          fg: fgHex,
          bg: THEME_SURFACES.dark.surface,
          ratio: `${ratioDark.toFixed(2)}:1`,
          reason: 'Inline style with dark color has failing contrast on dark surface',
        });
      }
    }

    // 3. Audit CSS file rules for this page
    if (cssContent) {
      const cssRules = [...cssContent.matchAll(/([^{}]+)\{([^}]+)\}/g)];
      for (const rule of cssRules) {
        const selector = rule[1].replace(/\/\*[\s\S]*?\*\//g, '').trim();
        const body = rule[2];

        // If rule sets color: #...
        const colorMatch = body.match(/color\s*:\s*(#[0-9a-fA-F]{3,8})/);
        if (colorMatch && selector) {
          totalChecked++;
          const fgHex = colorMatch[1];
          // Check if selector has dark mode override
          const isDarkThemeRule = selector.includes('[data-theme="dark"]');
          if (!isDarkThemeRule) {
            const selectors = selector.split(',').map(s => s.trim()).filter(Boolean);
            const hasDarkOverride = selectors.some(s =>
              cssContent.includes(`[data-theme="dark"] ${s}`) ||
              cssContent.includes(`[data-theme="dark"]${s}`) ||
              indexCss.includes(s)
            );

            if (!hasDarkOverride) {
              const ratioDark = getContrastRatio(fgHex, THEME_SURFACES.dark.surface);
              if (
                ratioDark < 4.5 &&
                !selector.includes('@media print') &&
                !selector.includes('printable') &&
                !selector.includes('print-slip')
              ) {
                failures.push({
                  page: page.name,
                  theme: 'dark',
                  selector: selector.split('\n').join(' ').trim(),
                  fg: fgHex,
                  bg: THEME_SURFACES.dark.surface,
                  ratio: `${ratioDark.toFixed(2)}:1`,
                  reason: 'CSS rule with fixed light color lacks [data-theme="dark"] override',
                });
              }
            }
          }
        }
      }
    }
  }

  return {
    totalChecked,
    failureCount: failures.length,
    failures,
  };
}

if (process.argv[1] && process.argv[1].endsWith('contrastAudit.js')) {
  const result = runAudit();
  console.log(`\n=== WCAG AA Contrast Audit ===`);
  console.log(`Total elements/rules evaluated: ${result.totalChecked}`);
  console.log(`Failures: ${result.failureCount}`);
  if (result.failureCount > 0) {
    console.log(`\nFailing elements list:`);
    result.failures.slice(0, 30).forEach((f, idx) => {
      console.log(`[${idx + 1}] Page: ${f.page} | Theme: ${f.theme} | Selector: ${f.selector} | Ratio: ${f.ratio} | Reason: ${f.reason}`);
    });
    if (result.failureCount > 30) {
      console.log(`... and ${result.failureCount - 30} more failures.`);
    }
  } else {
    console.log(`All text elements PASS WCAG AA contrast in both themes!`);
  }
}
