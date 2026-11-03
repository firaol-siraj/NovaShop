/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect, useRef, useMemo } from "react";
import { useCart } from "../../context/CartContext";
import { useAuth } from "../../context/AuthContext";
import { useCategories } from "../../context/CategoryContext";
import { productApi } from "../../lib/api/productApi";
import { normalizeCatalog, resolveImage } from "../../lib/catalog";
import settingsApi from "../../lib/api/settingsApi";
import { ThemeToggle } from "../../context/ThemeContext";

/* ══════════════════════════════════════════════════════════
   DESIGN TOKENS
══════════════════════════════════════════════════════════ */
const T = {
  cream: "var(--bg-main)",
  ivory: "var(--bg-surface)",
  espresso: "var(--text-primary)",
  muted: "var(--text-muted)",
  border: "var(--border-default)",
  sale: "var(--color-danger)",
};

/* ══════════════════════════════════════════════════════════
   FEATURED PRODUCTS SESSION CACHE
══════════════════════════════════════════════════════════ */
let cachedFeaturedProducts = null;
let featuredFetchPromise = null;

async function fetchFeaturedProducts() {
  if (cachedFeaturedProducts) return cachedFeaturedProducts;
  if (!featuredFetchPromise) {
    featuredFetchPromise = productApi
      .getProducts({ sort: "newest", pageSize: 3 })
      .then((res) => {
        const list = res.data?.data || res.data || [];
        cachedFeaturedProducts = normalizeCatalog(list).slice(0, 3);
        return cachedFeaturedProducts;
      })
      .catch((err) => {
        console.error("Featured products fetch error:", err);
        return [];
      });
  }
  return featuredFetchPromise;
}

/* ══════════════════════════════════════════════════════════
   ICONS
══════════════════════════════════════════════════════════ */
const SearchIcon = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.3-4.3" />
  </svg>
);

const HeartIcon = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
  </svg>
);

const BagIcon = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
    <path d="M3 6h18" />
    <path d="M16 10a4 4 0 0 1-8 0" />
  </svg>
);

const ChevronDown = ({ open }) => (
  <svg
    width="10"
    height="10"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    style={{
      display: "inline-block",
      marginLeft: "5px",
      verticalAlign: "middle",
      transition: "transform 0.22s ease",
      transform: open ? "rotate(180deg)" : "rotate(0deg)",
      flexShrink: 0,
    }}
  >
    <path d="m6 9 6 6 6-6" />
  </svg>
);

const MenuIcon = ({ open }) =>
  open ? (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  ) : (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );

/* ══════════════════════════════════════════════════════════
   BADGE & AVATAR
══════════════════════════════════════════════════════════ */
function Badge({ count }) {
  if (!count || count <= 0) return null;
  return (
    <span
      aria-hidden="true"
      style={{
        position: "absolute",
        top: "-7px",
        right: "-8px",
        background: T.espresso,
        color: T.ivory,
        borderRadius: "50%",
        fontSize: "9px",
        fontWeight: 700,
        width: "16px",
        height: "16px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "var(--font-sans)",
        letterSpacing: 0,
        pointerEvents: "none",
      }}
    >
      {count}
    </span>
  );
}

function AvatarCircle({ image }) {
  return (
    <span
      aria-hidden="true"
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: "29px",
        height: "29px",
        borderRadius: "50%",
        background: image ? "#F7F2EA" : T.espresso,
        flexShrink: 0,
        overflow: "hidden",
        border: image ? "1px solid rgba(35,30,27,0.12)" : "none",
      }}
    >
      {image ? (
        <img
          src={image}
          alt="Profile"
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            display: "block",
          }}
        />
      ) : (
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke={T.ivory}
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      )}
    </span>
  );
}

const iconBtn = {
  background: "none",
  border: "none",
  cursor: "pointer",
  padding: "4px",
  color: T.espresso,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  transition: "opacity 0.18s",
  lineHeight: 0,
};

/* ══════════════════════════════════════════════════════════
   MAIN NAVBAR COMPONENT
══════════════════════════════════════════════════════════ */
export default function Navbar({
  go,
  currentPath,
  hideAnnouncementBar = false,
}) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeMenu, setActiveMenu] = useState(null); // 'shop' | 'collections' | null
  const [featuredProducts, setFeaturedProducts] = useState(cachedFeaturedProducts || []);
  const [featuredLoading, setFeaturedLoading] = useState(!cachedFeaturedProducts);
  const [freeShippingThreshold, setFreeShippingThreshold] = useState(300);

  useEffect(() => {
    let isMounted = true;
    settingsApi.getPublicSettings().then((res) => {
      const val = res.data?.data?.freeShippingThreshold ?? res.data?.freeShippingThreshold;
      if (isMounted && val != null) {
        setFreeShippingThreshold(val);
      }
    }).catch(() => {});

    const handleUpdate = () => {
      settingsApi.getPublicSettings().then((res) => {
        const val = res.data?.data?.freeShippingThreshold ?? res.data?.freeShippingThreshold;
        if (val != null) {
          setFreeShippingThreshold(val);
        }
      }).catch(() => {});
    };

    window.addEventListener('novashop:settings-updated', handleUpdate);
    return () => {
      isMounted = false;
      window.removeEventListener('novashop:settings-updated', handleUpdate);
    };
  }, []);

  const { user, isAuthenticated } = useAuth();
  const { categories = [] } = useCategories();
  const {
    distinctItemCount,
    wishlistCount,
    isCartOpen,
    isWishlistOpen,
    openCart,
    closeCart,
    openWishlist,
    closeWishlist,
    openSearch,
  } = useCart();

  const openTimerRef = useRef(null);
  const closeTimerRef = useRef(null);

  // Close mega menus & mobile drawer on route change
  useEffect(() => {
    setActiveMenu(null);
    setMobileOpen(false);
  }, [currentPath]);

  // Load featured products once per session
  useEffect(() => {
    let active = true;
    if (!cachedFeaturedProducts) {
      fetchFeaturedProducts().then((data) => {
        if (active) {
          setFeaturedProducts(data);
          setFeaturedLoading(false);
        }
      });
    }
    return () => {
      active = false;
    };
  }, []);

  // Top-level categories (no parent) and subcategories lookup
  const { topCategories, categoryChildrenMap } = useMemo(() => {
    const list = Array.isArray(categories) ? categories : [];
    const top = list
      .filter((c) => c && !c.parent && !c.parentId)
      .sort((a, b) => (a?.name || "").localeCompare(b?.name || ""));

    const childrenMap = {};
    list.forEach((cat) => {
      if (cat && cat.parent) {
        const parentId = typeof cat.parent === "object" ? cat.parent._id : cat.parent;
        const key = String(parentId);
        if (!childrenMap[key]) childrenMap[key] = [];
        childrenMap[key].push(cat);
      }
    });

    return { topCategories: top, categoryChildrenMap: childrenMap };
  }, [categories]);

  // Scroll detection for sticky header shadow
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Global Cmd+K / Ctrl+K → open search
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        openSearch();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [openSearch]);

  // Outside click & Esc key to close mega menus
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        setActiveMenu(null);
        setMobileOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Hover intent handlers: ~120ms open delay, ~200ms close delay
  const handleTriggerMouseEnter = (menuName) => {
    clearTimeout(closeTimerRef.current);
    openTimerRef.current = setTimeout(() => {
      setActiveMenu(menuName);
    }, 120);
  };

  const handleTriggerMouseLeave = () => {
    clearTimeout(openTimerRef.current);
    closeTimerRef.current = setTimeout(() => {
      setActiveMenu(null);
    }, 200);
  };

  const handlePanelMouseEnter = () => {
    clearTimeout(closeTimerRef.current);
  };

  const handlePanelMouseLeave = () => {
    closeTimerRef.current = setTimeout(() => {
      setActiveMenu(null);
    }, 200);
  };

  const handleAccountNavigation = () => {
    if (isAuthenticated) {
      go("/account");
      return;
    }
    go("/login");
  };

  const navigateTo = (path) => {
    setActiveMenu(null);
    setMobileOpen(false);
    go(path);
  };

  return (
    <>
      {/* ══ ANNOUNCEMENT BAR ═══════════════════════════════════ */}
      {!hideAnnouncementBar && (
        <div
          role="region"
          aria-label="Announcement"
          style={{
            backgroundColor: T.cream,
            borderBottom: `1px solid ${T.border}`,
            padding: "8px 16px",
            textAlign: "center",
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: "11px",
              fontFamily: "var(--font-sans)",
              fontWeight: 500,
              letterSpacing: "0.13em",
              textTransform: "uppercase",
              color: T.espresso,
              lineHeight: 1.5,
            }}
          >
            Complimentary Express Global Shipping on Orders Over ${freeShippingThreshold}
            &nbsp;&bull;&nbsp;Bespoke Packaging
          </p>
        </div>
      )}

      {/* ══ MAIN HEADER ═══════════════════════════════════════ */}
      <header
        role="banner"
        style={{
          position: "sticky",
          top: 0,
          zIndex: 100,
          width: "100%",
          backgroundColor: T.ivory,
          boxShadow: scrolled ? "0 2px 16px rgba(35,30,27,0.09)" : "none",
          transition: "box-shadow 0.3s",
        }}
      >
        {/* ─ Inner grid: logo | nav | icons ─ */}
        <div
          className="ns-navbar-grid"
          style={{
            maxWidth: "1400px",
            margin: "0 auto",
            padding: "18px 40px",
            display: "grid",
            gridTemplateColumns: "1fr auto 1fr",
            alignItems: "center",
            gap: "16px",
          }}
        >
          {/* ─ LOGO ─ */}
          <button
            onClick={() => navigateTo("/")}
            aria-label="NOVASHOP — return to homepage"
            style={{
              background: "none",
              border: "none",
              padding: 0,
              cursor: "pointer",
              textAlign: "left",
              justifySelf: "start",
            }}
          >
            <span
              style={{
                fontFamily: "var(--font-serif)",
                fontSize: "22px",
                fontWeight: 700,
                letterSpacing: "0.22em",
                textTransform: "uppercase",
                color: T.espresso,
                lineHeight: 1,
                display: "block",
              }}
            >
              NOVASHOP
            </span>
          </button>

          {/* ─ DESKTOP NAV ─ */}
          <nav
            className="ns-desktop-nav"
            aria-label="Main navigation"
            style={{ display: "flex", alignItems: "center", gap: "36px" }}
          >
            {/* 1. Shop Mega-Menu Trigger */}
            <div
              style={{ position: "relative" }}
              onMouseEnter={() => handleTriggerMouseEnter("shop")}
              onMouseLeave={handleTriggerMouseLeave}
            >
              <button
                onClick={() => navigateTo("/shop")}
                onFocus={() => setActiveMenu("shop")}
                aria-haspopup="true"
                aria-expanded={activeMenu === "shop"}
                aria-controls="ns-mega-menu-shop"
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: "6px 0",
                  fontSize: "11px",
                  fontFamily: "var(--font-sans)",
                  fontWeight: 500,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  color: currentPath === "/shop" || activeMenu === "shop" ? T.espresso : T.muted,
                  borderBottom:
                    currentPath === "/shop" || activeMenu === "shop"
                      ? `1px solid ${T.espresso}`
                      : "1px solid transparent",
                  transition: "color 0.18s, border-color 0.18s",
                  display: "inline-flex",
                  alignItems: "center",
                }}
              >
                Shop
                <ChevronDown open={activeMenu === "shop"} />
              </button>
            </div>

            {/* 2. Collections Mega-Menu Trigger */}
            <div
              style={{ position: "relative" }}
              onMouseEnter={() => handleTriggerMouseEnter("collections")}
              onMouseLeave={handleTriggerMouseLeave}
            >
              <button
                onClick={() => navigateTo("/collections")}
                onFocus={() => setActiveMenu("collections")}
                aria-haspopup="true"
                aria-expanded={activeMenu === "collections"}
                aria-controls="ns-mega-menu-collections"
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: "6px 0",
                  fontSize: "11px",
                  fontFamily: "var(--font-sans)",
                  fontWeight: 500,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  color: currentPath.startsWith("/collections") || activeMenu === "collections" ? T.espresso : T.muted,
                  borderBottom:
                    currentPath.startsWith("/collections") || activeMenu === "collections"
                      ? `1px solid ${T.espresso}`
                      : "1px solid transparent",
                  transition: "color 0.18s, border-color 0.18s",
                  display: "inline-flex",
                  alignItems: "center",
                }}
              >
                Collections
                <ChevronDown open={activeMenu === "collections"} />
              </button>
            </div>

            {/* Static links */}
            {[
              { label: "About", path: "/about" },
              { label: "Help", path: "/help" },
            ].map((link) => (
              <button
                key={link.path}
                onClick={() => navigateTo(link.path)}
                aria-current={currentPath === link.path ? "page" : undefined}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: "6px 0",
                  fontSize: "11px",
                  fontFamily: "var(--font-sans)",
                  fontWeight: 500,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  color: currentPath === link.path ? T.espresso : T.muted,
                  borderBottom:
                    currentPath === link.path
                      ? `1px solid ${T.espresso}`
                      : "1px solid transparent",
                  transition: "color 0.18s",
                  whiteSpace: "nowrap",
                }}
              >
                {link.label}
              </button>
            ))}
          </nav>

          {/* ─ ICON GROUP ─ */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "20px",
              justifySelf: "end",
            }}
          >
            {/* Search */}
            <button
              onClick={openSearch}
              aria-label="Open search"
              style={iconBtn}
            >
              <SearchIcon />
            </button>

            {/* Wishlist */}
            <button
              onClick={() => (isWishlistOpen ? closeWishlist() : openWishlist())}
              aria-label={`Wishlist — ${wishlistCount} items`}
              style={{ ...iconBtn, position: "relative" }}
              className="ns-hide-mobile"
            >
              <HeartIcon />
              <Badge count={wishlistCount} />
            </button>

            {/* Bag */}
            <button
              onClick={() => (isCartOpen ? closeCart() : openCart())}
              aria-label={`Shopping bag — ${distinctItemCount} items`}
              style={{ ...iconBtn, position: "relative" }}
            >
              <BagIcon />
              <Badge count={distinctItemCount} />
            </button>

            {/* Theme Toggle */}
            <ThemeToggle variant="button" className="storefront-theme-toggle" />

            {/* Account */}
            <button
              onClick={handleAccountNavigation}
              aria-label="My account"
              style={{ ...iconBtn, padding: 0 }}
              className="ns-hide-mobile"
            >
              <AvatarCircle image={user?.avatar} />
            </button>

            {/* Mobile Hamburger */}
            <button
              onClick={() => setMobileOpen((v) => !v)}
              aria-label={mobileOpen ? "Close navigation menu" : "Open navigation menu"}
              aria-expanded={mobileOpen}
              aria-controls="ns-mobile-drawer"
              style={{ ...iconBtn, display: "none" }}
              className="ns-show-mobile"
            >
              <MenuIcon open={mobileOpen} />
            </button>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════
            DESKTOP MEGA-MENU PANEL: SHOP
        ══════════════════════════════════════════════════════ */}
        <div
          id="ns-mega-menu-shop"
          role="region"
          aria-label="Shop mega menu"
          onMouseEnter={handlePanelMouseEnter}
          onMouseLeave={handlePanelMouseLeave}
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            width: "100%",
            backgroundColor: T.ivory,
            borderTop: `1px solid ${T.border}`,
            borderBottom: `1px solid ${T.border}`,
            boxShadow: "0 20px 40px rgba(27,24,22,0.08)",
            opacity: activeMenu === "shop" ? 1 : 0,
            transform: activeMenu === "shop" ? "translateY(0)" : "translateY(-8px)",
            pointerEvents: activeMenu === "shop" ? "auto" : "none",
            transition: "opacity 0.22s ease, transform 0.22s ease",
            maxHeight: "calc(100vh - 120px)",
            overflowY: "auto",
            zIndex: 250,
          }}
        >
          <div
            style={{
              maxWidth: "1400px",
              margin: "0 auto",
              padding: "36px 40px 44px",
              display: "grid",
              gridTemplateColumns: "220px 1fr 280px",
              gap: "48px",
            }}
          >
            {/* Column 1: Quick Links */}
            <div style={{ borderRight: `1px solid ${T.border}`, paddingRight: "32px" }}>
              <div
                style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: "10px",
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                  color: "#8A817B",
                  fontWeight: 600,
                  marginBottom: "18px",
                }}
              >
                Quick Links
              </div>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "14px" }}>
                <li>
                  <button
                    onClick={() => navigateTo("/shop")}
                    style={{
                      background: "none",
                      border: "none",
                      padding: 0,
                      cursor: "pointer",
                      fontFamily: "var(--font-sans)",
                      fontSize: "12px",
                      letterSpacing: "0.12em",
                      textTransform: "uppercase",
                      color: T.espresso,
                      fontWeight: 600,
                      textAlign: "left",
                    }}
                  >
                    All Products
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => navigateTo("/shop?sort=newest")}
                    style={{
                      background: "none",
                      border: "none",
                      padding: 0,
                      cursor: "pointer",
                      fontFamily: "var(--font-sans)",
                      fontSize: "12px",
                      letterSpacing: "0.12em",
                      textTransform: "uppercase",
                      color: T.espresso,
                      fontWeight: 500,
                      textAlign: "left",
                    }}
                  >
                    New Arrivals
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => navigateTo("/shop?sort=bestselling")}
                    style={{
                      background: "none",
                      border: "none",
                      padding: 0,
                      cursor: "pointer",
                      fontFamily: "var(--font-sans)",
                      fontSize: "12px",
                      letterSpacing: "0.12em",
                      textTransform: "uppercase",
                      color: T.espresso,
                      fontWeight: 500,
                      textAlign: "left",
                    }}
                  >
                    Best Sellers
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => navigateTo("/collections")}
                    style={{
                      background: "none",
                      border: "none",
                      padding: 0,
                      cursor: "pointer",
                      fontFamily: "var(--font-sans)",
                      fontSize: "11px",
                      letterSpacing: "0.14em",
                      textTransform: "uppercase",
                      color: "#7E7570",
                      textAlign: "left",
                      marginTop: "12px",
                      textDecoration: "underline",
                    }}
                  >
                    Browse All Categories →
                  </button>
                </li>
              </ul>
            </div>

            {/* Column 2: Top-level Categories with Subcategories */}
            <div>
              <div
                style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: "10px",
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                  color: "#8A817B",
                  fontWeight: 600,
                  marginBottom: "18px",
                }}
              >
                Categories
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
                  gap: "28px",
                }}
              >
                {topCategories.slice(0, 4).map((cat) => {
                  const subcategories = categoryChildrenMap[String(cat._id)] || [];
                  return (
                    <div key={cat._id}>
                      <button
                        onClick={() => navigateTo(`/shop?category=${encodeURIComponent(cat.slug)}`)}
                        style={{
                          background: "none",
                          border: "none",
                          padding: "0 0 10px",
                          cursor: "pointer",
                          fontFamily: "var(--font-serif)",
                          fontSize: "16px",
                          fontStyle: "italic",
                          color: T.espresso,
                          fontWeight: 500,
                          textAlign: "left",
                          display: "block",
                        }}
                      >
                        {cat.name}
                      </button>

                      {subcategories.length > 0 ? (
                        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "8px" }}>
                          {subcategories.slice(0, 6).map((sub) => (
                            <li key={sub._id}>
                              <button
                                onClick={() => navigateTo(`/shop?category=${encodeURIComponent(sub.slug)}`)}
                                style={{
                                  background: "none",
                                  border: "none",
                                  padding: 0,
                                  cursor: "pointer",
                                  fontFamily: "var(--font-sans)",
                                  fontSize: "11px",
                                  letterSpacing: "0.08em",
                                  textTransform: "uppercase",
                                  color: T.muted,
                                  textAlign: "left",
                                  transition: "color 0.15s ease",
                                }}
                                onMouseEnter={(e) => (e.currentTarget.style.color = T.espresso)}
                                onMouseLeave={(e) => (e.currentTarget.style.color = T.muted)}
                              >
                                {sub.name}
                              </button>
                            </li>
                          ))}
                          <li style={{ marginTop: "4px" }}>
                            <button
                              onClick={() => navigateTo(`/shop?category=${encodeURIComponent(cat.slug)}`)}
                              style={{
                                background: "none",
                                border: "none",
                                padding: 0,
                                cursor: "pointer",
                                fontFamily: "var(--font-sans)",
                                fontSize: "10px",
                                letterSpacing: "0.12em",
                                textTransform: "uppercase",
                                color: "#8A817B",
                                textAlign: "left",
                                textDecoration: "underline",
                              }}
                            >
                              View all {cat.name}
                            </button>
                          </li>
                        </ul>
                      ) : (
                        <p style={{ margin: 0, fontSize: "11px", color: "#8A817B", lineHeight: 1.4 }}>
                          {cat.description || "Wardrobe staples"}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Column 3: Featured Products (Real backend data) */}
            <div style={{ borderLeft: `1px solid ${T.border}`, paddingLeft: "32px" }}>
              <div
                style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: "10px",
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                  color: "#8A817B",
                  fontWeight: 600,
                  marginBottom: "18px",
                }}
              >
                Featured New
              </div>

              {featuredLoading ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  <div style={{ height: "60px", background: "#EDE8DF", borderRadius: "2px" }} />
                  <div style={{ height: "60px", background: "#EDE8DF", borderRadius: "2px" }} />
                </div>
              ) : featuredProducts.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  {featuredProducts.slice(0, 2).map((item) => (
                    <button
                      key={item.id}
                      onClick={() => navigateTo(`/products/${item.slug || item.id}`)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "14px",
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        padding: 0,
                        textAlign: "left",
                      }}
                    >
                      <img
                        src={item.primaryImage}
                        alt={item.name}
                        style={{
                          width: "56px",
                          height: "70px",
                          objectFit: "cover",
                          borderRadius: "2px",
                          backgroundColor: "#EDE8DF",
                          flexShrink: 0,
                        }}
                      />
                      <div>
                        <div
                          style={{
                            fontFamily: "var(--font-serif)",
                            fontSize: "14px",
                            fontStyle: "italic",
                            color: T.espresso,
                            lineHeight: 1.2,
                            marginBottom: "4px",
                          }}
                        >
                          {item.name}
                        </div>
                        <div
                          style={{
                            fontFamily: "var(--font-sans)",
                            fontSize: "11px",
                            color: "#7E7570",
                            letterSpacing: "0.06em",
                          }}
                        >
                          ${item.price.toFixed(2)}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════
            DESKTOP MEGA-MENU PANEL: COLLECTIONS
        ══════════════════════════════════════════════════════ */}
        <div
          id="ns-mega-menu-collections"
          role="region"
          aria-label="Collections mega menu"
          onMouseEnter={handlePanelMouseEnter}
          onMouseLeave={handlePanelMouseLeave}
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            width: "100%",
            backgroundColor: T.ivory,
            borderTop: `1px solid ${T.border}`,
            borderBottom: `1px solid ${T.border}`,
            boxShadow: "0 20px 40px rgba(27,24,22,0.08)",
            opacity: activeMenu === "collections" ? 1 : 0,
            transform: activeMenu === "collections" ? "translateY(0)" : "translateY(-8px)",
            pointerEvents: activeMenu === "collections" ? "auto" : "none",
            transition: "opacity 0.22s ease, transform 0.22s ease",
            maxHeight: "calc(100vh - 120px)",
            overflowY: "auto",
            zIndex: 250,
          }}
        >
          <div
            style={{
              maxWidth: "1400px",
              margin: "0 auto",
              padding: "36px 40px 44px",
              display: "grid",
              gridTemplateColumns: "220px 1fr",
              gap: "48px",
            }}
          >
            {/* Column 1: Curated Collections Links */}
            <div style={{ borderRight: `1px solid ${T.border}`, paddingRight: "32px" }}>
              <div
                style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: "10px",
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                  color: "#8A817B",
                  fontWeight: 600,
                  marginBottom: "18px",
                }}
              >
                Curated
              </div>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "14px" }}>
                <li>
                  <button
                    onClick={() => navigateTo("/collections")}
                    style={{
                      background: "none",
                      border: "none",
                      padding: 0,
                      cursor: "pointer",
                      fontFamily: "var(--font-sans)",
                      fontSize: "12px",
                      letterSpacing: "0.12em",
                      textTransform: "uppercase",
                      color: T.espresso,
                      fontWeight: 600,
                      textAlign: "left",
                    }}
                  >
                    All Collections
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => navigateTo("/shop?sort=newest")}
                    style={{
                      background: "none",
                      border: "none",
                      padding: 0,
                      cursor: "pointer",
                      fontFamily: "var(--font-sans)",
                      fontSize: "12px",
                      letterSpacing: "0.12em",
                      textTransform: "uppercase",
                      color: T.espresso,
                      fontWeight: 500,
                      textAlign: "left",
                    }}
                  >
                    New Arrivals Showcase
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => navigateTo("/shop?sort=bestselling")}
                    style={{
                      background: "none",
                      border: "none",
                      padding: 0,
                      cursor: "pointer",
                      fontFamily: "var(--font-sans)",
                      fontSize: "12px",
                      letterSpacing: "0.12em",
                      textTransform: "uppercase",
                      color: T.espresso,
                      fontWeight: 500,
                      textAlign: "left",
                    }}
                  >
                    Best Sellers Archive
                  </button>
                </li>
              </ul>
            </div>

            {/* Column 2: Category Collections Grid */}
            <div>
              <div
                style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: "10px",
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                  color: "#8A817B",
                  fontWeight: 600,
                  marginBottom: "18px",
                }}
              >
                Category Collections
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
                  gap: "24px",
                }}
              >
                {topCategories.map((cat) => (
                  <button
                    key={cat._id}
                    onClick={() => navigateTo(`/shop?category=${encodeURIComponent(cat.slug)}`)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "14px",
                      background: T.cream,
                      border: `1px solid ${T.border}`,
                      borderRadius: "4px",
                      padding: "12px 16px",
                      cursor: "pointer",
                      textAlign: "left",
                      transition: "background 0.2s ease, border-color 0.2s ease",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = T.ivory;
                      e.currentTarget.style.borderColor = "var(--border-strong)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = T.cream;
                      e.currentTarget.style.borderColor = T.border;
                    }}
                  >
                    {cat.image ? (
                      <img
                        src={resolveImage(cat.image)}
                        alt={cat.name}
                        style={{
                          width: "48px",
                          height: "48px",
                          objectFit: "cover",
                          borderRadius: "2px",
                          flexShrink: 0,
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: "48px",
                          height: "48px",
                          borderRadius: "2px",
                          background: "#EBE5DB",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "12px",
                          fontFamily: "var(--font-serif)",
                          color: T.espresso,
                          flexShrink: 0,
                        }}
                      >
                        {cat.name.charAt(0)}
                      </div>
                    )}
                    <div>
                      <div
                        style={{
                          fontFamily: "var(--font-serif)",
                          fontSize: "14px",
                          fontStyle: "italic",
                          color: T.espresso,
                          fontWeight: 500,
                        }}
                      >
                        {cat.name}
                      </div>
                      <div
                        style={{
                          fontFamily: "var(--font-sans)",
                          fontSize: "10px",
                          letterSpacing: "0.12em",
                          textTransform: "uppercase",
                          color: "#8D837D",
                          marginTop: "2px",
                        }}
                      >
                        Explore →
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════
            MOBILE DRAWER (Accordion for Shop & Collections)
        ══════════════════════════════════════════════════════ */}
        <div
          id="ns-mobile-drawer"
          aria-hidden={!mobileOpen}
          style={{
            overflow: "hidden",
            maxHeight: mobileOpen ? "800px" : "0",
            transition: "max-height 0.38s cubic-bezier(0.4,0,0.2,1)",
            borderTop: `1px solid ${T.border}`,
            backgroundColor: T.ivory,
          }}
        >
          <nav
            aria-label="Mobile navigation"
            style={{ padding: "12px 24px 32px" }}
          >
            {/* Mobile Shop Accordion */}
            <MobileAccordionSection
              title="Shop"
              onTitleClick={() => navigateTo("/shop")}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: "8px", paddingBottom: "12px" }}>
                <button
                  onClick={() => navigateTo("/shop")}
                  style={mobileSubLink}
                >
                  All Products
                </button>
                <button
                  onClick={() => navigateTo("/shop?sort=newest")}
                  style={mobileSubLink}
                >
                  New Arrivals
                </button>
                <button
                  onClick={() => navigateTo("/shop?sort=bestselling")}
                  style={mobileSubLink}
                >
                  Best Sellers
                </button>
                {topCategories.map((cat) => (
                  <button
                    key={cat._id}
                    onClick={() => navigateTo(`/shop?category=${encodeURIComponent(cat.slug)}`)}
                    style={mobileSubLink}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>
            </MobileAccordionSection>

            {/* Mobile Collections Accordion */}
            <MobileAccordionSection
              title="Collections"
              onTitleClick={() => navigateTo("/collections")}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: "8px", paddingBottom: "12px" }}>
                <button
                  onClick={() => navigateTo("/collections")}
                  style={{ ...mobileSubLink, fontWeight: 700 }}
                >
                  View All Collections
                </button>
                {topCategories.map((cat) => (
                  <button
                    key={cat._id}
                    onClick={() => navigateTo(`/shop?category=${encodeURIComponent(cat.slug)}`)}
                    style={mobileSubLink}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>
            </MobileAccordionSection>

            {/* Static pages */}
            {[
              { label: "About", path: "/about" },
              { label: "Help", path: "/help" },
            ].map((link) => (
              <button
                key={link.path}
                onClick={() => navigateTo(link.path)}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: "16px 0",
                  borderBottom: `1px solid ${T.border}`,
                  fontSize: "13px",
                  fontFamily: "var(--font-serif)",
                  fontWeight: 500,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  color: T.espresso,
                }}
              >
                {link.label}
              </button>
            ))}

            {/* Utility links */}
            <div
              style={{
                display: "flex",
                gap: "24px",
                marginTop: "24px",
                flexWrap: "wrap",
              }}
            >
              {[
                { l: "Wishlist", p: "/wishlist" },
                { l: "Account", p: "/account" },
                { l: "Search", p: "/search" },
              ].map(({ l, p }) => (
                <button
                  key={p}
                  onClick={() => {
                    if (p === "/account") {
                      handleAccountNavigation();
                      return;
                    }
                    navigateTo(p);
                  }}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    padding: 0,
                    fontSize: "11px",
                    fontFamily: "var(--font-sans)",
                    fontWeight: 500,
                    letterSpacing: "0.13em",
                    textTransform: "uppercase",
                    color: T.muted,
                  }}
                >
                  {l}
                </button>
              ))}
            </div>

            {/* Mobile Theme Preference */}
            <div style={{ marginTop: "24px", paddingTop: "18px", borderTop: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: "11px", fontFamily: "var(--font-sans)", letterSpacing: "0.12em", textTransform: "uppercase", color: T.muted, fontWeight: 600 }}>Theme</span>
              <ThemeToggle variant="segmented" />
            </div>
          </nav>
        </div>
      </header>

      {/* ══ RESPONSIVE OVERRIDES ═══════════════════════════════ */}
      <style>{`
        @media (max-width: 767px) {
          .ns-navbar-grid {
            grid-template-columns: 1fr auto !important;
            padding: 15px 20px !important;
          }
          .ns-desktop-nav  { display: none !important; }
          .ns-hide-mobile  { display: none !important; }
          .ns-show-mobile  { display: flex !important; }
        }
        @media (min-width: 768px) {
          .ns-show-mobile  { display: none !important; }
        }
        @media (prefers-reduced-motion: reduce) {
          #ns-mega-menu-shop,
          #ns-mega-menu-collections {
            transition: none !important;
            transform: none !important;
          }
        }
      `}</style>
    </>
  );
}

/* ══════════════════════════════════════════════════════════
   MOBILE ACCORDION HELPER
══════════════════════════════════════════════════════════ */
function MobileAccordionSection({ title, onTitleClick, children }) {
  const [open, setOpen] = useState(false);

  return (
    <div style={{ borderBottom: `1px solid ${T.border}` }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "16px 0",
        }}
      >
        <button
          onClick={onTitleClick}
          style={{
            background: "none",
            border: "none",
            padding: 0,
            cursor: "pointer",
            fontSize: "13px",
            fontFamily: "var(--font-serif)",
            fontWeight: 500,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: T.espresso,
            textAlign: "left",
          }}
        >
          {title}
        </button>
        <button
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          style={{
            background: "none",
            border: "none",
            padding: "4px 8px",
            cursor: "pointer",
            color: T.espresso,
          }}
          aria-label={`Toggle ${title} subcategories`}
        >
          <ChevronDown open={open} />
        </button>
      </div>

      <div
        style={{
          overflow: "hidden",
          maxHeight: open ? "600px" : "0",
          transition: "max-height 0.3s cubic-bezier(0.4,0,0.2,1)",
        }}
      >
        {children}
      </div>
    </div>
  );
}

const mobileSubLink = {
  display: "block",
  width: "100%",
  textAlign: "left",
  background: "none",
  border: "none",
  cursor: "pointer",
  padding: "6px 0",
  fontSize: "12px",
  fontFamily: "var(--font-sans)",
  fontWeight: 500,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--text-muted)",
};
