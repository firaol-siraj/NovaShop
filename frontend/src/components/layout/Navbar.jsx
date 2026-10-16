import { useState, useEffect, useRef, useCallback } from "react";
import { useCart } from "../../context/CartContext";

/* ══════════════════════════════════════════════════════════
   DESIGN TOKENS
══════════════════════════════════════════════════════════ */
const T = {
  cream: "#FAF7F2",
  ivory: "#FDFBF7",
  espresso: "#231E1B",
  muted: "#68625E",
  border: "#E5E0D8",
  sale: "#9B4A3A", // terracotta / muted red for Sale
};

import { useAuth } from "../../context/AuthContext";
import { useCategories } from "../../context/CategoryContext";

/* ══════════════════════════════════════════════════════════
   DROPDOWN DATA
══════════════════════════════════════════════════════════ */
const SHOP_LINKS = [
  { label: "All Products", path: "/shop" },
  { label: "New Arrivals", path: "/shop?filter=new-arrivals" },
  { label: "Sale", path: "/shop?category=sale" },
];

function getCollectionLinks(categories = []) {
  return categories
    .filter((category) => category?.name && category?.slug)
    .map((category) => ({
      label: category.name,
      path: `/shop?category=${encodeURIComponent(category.slug)}`,
      thumb:
        category.image ||
        category.imageUrl ||
        category.thumbnail ||
        category.coverImage ||
        "",
    }));
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
      marginLeft: "4px",
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
   SMALL REUSABLES
══════════════════════════════════════════════════════════ */
function Badge({ count }) {
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
   HOVER DROPDOWN — shared panel
   Uses a close-delay timer so the mouse can move from
   trigger → panel without the panel flickering shut.
══════════════════════════════════════════════════════════ */
function DropdownItem({ label, path, go }) {
  return (
    <button
      onClick={() => go(path)}
      style={{
        display: "block",
        width: "100%",
        textAlign: "left",
        background: "none",
        border: "none",
        cursor: "pointer",
        padding: "9px 24px",
        fontSize: "12px",
        fontFamily: "var(--font-sans)",
        fontWeight: 500,
        letterSpacing: "0.09em",
        textTransform: "uppercase",
        color: T.espresso,
        transition: "background 0.15s, color 0.15s",
        lineHeight: 1.3,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "#F3EFE8";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "transparent";
      }}
    >
      {label}
    </button>
  );
}

function CollectionCard({ item, go }) {
  return (
    <button
      onClick={() => go(item.path)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "14px",
        width: "100%",
        textAlign: "left",
        background: "none",
        border: "none",
        cursor: "pointer",
        padding: "12px 24px",
        transition: "background 0.15s",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "#F3EFE8";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "transparent";
      }}
    >
      {item.thumb && (
        <img
          src={item.thumb}
          alt={item.label}
          style={{
            width: "56px",
            height: "40px",
            objectFit: "cover",
            flexShrink: 0,
          }}
        />
      )}
      <span
        style={{
          fontSize: "12px",
          fontFamily: "var(--font-sans)",
          fontWeight: item.thumb ? 500 : 600,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: T.espresso,
          lineHeight: 1.4,
        }}
      >
        {item.label}
      </span>
    </button>
  );
}

/* ─── Hover nav item with controlled dropdown ─────────────── */
function NavItem({
  label,
  path,
  items,
  isCollection,
  isActive,
  go,
  collectionLinks = [],
}) {
  const [open, setOpen] = useState(false);
  const closeTimer = useRef(null);

  const openMenu = useCallback(() => {
    clearTimeout(closeTimer.current);
    setOpen(true);
  }, []);
  const scheduleClose = useCallback(() => {
    closeTimer.current = setTimeout(() => setOpen(false), 150);
  }, []);
  const cancelClose = useCallback(() => clearTimeout(closeTimer.current), []);

  useEffect(() => () => clearTimeout(closeTimer.current), []);

  const hasDropdown = !!items;

  return (
    <div
      style={{ position: "relative" }}
      onMouseEnter={hasDropdown ? openMenu : undefined}
      onMouseLeave={hasDropdown ? scheduleClose : undefined}
    >
      {/* Trigger button */}
      <button
        onClick={() => go(path)}
        aria-haspopup={hasDropdown ? "menu" : undefined}
        aria-expanded={hasDropdown ? open : undefined}
        aria-current={isActive ? "page" : undefined}
        onFocus={hasDropdown ? openMenu : undefined}
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          padding: "4px 0",
          fontSize: "11px",
          fontFamily: "var(--font-sans)",
          fontWeight: 500,
          letterSpacing: "0.13em",
          textTransform: "uppercase",
          color: isActive ? T.espresso : "#4A4440",
          borderBottom: isActive
            ? `1px solid ${T.espresso}`
            : "1px solid transparent",
          transition: "color 0.18s, border-color 0.18s",
          display: "inline-flex",
          alignItems: "center",
          gap: 0,
          whiteSpace: "nowrap",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.color = T.espresso)}
        onMouseLeave={(e) =>
          (e.currentTarget.style.color = isActive ? T.espresso : "#4A4440")
        }
      >
        {label}
        {hasDropdown && <ChevronDown open={open} />}
      </button>

      {/* Dropdown panel */}
      {hasDropdown && (
        <div
          role="menu"
          aria-label={`${label} menu`}
          onMouseEnter={cancelClose}
          onMouseLeave={scheduleClose}
          style={{
            position: "absolute",
            top: "calc(100% + 16px)",
            left: "50%",
            transform: "translateX(-50%)",
            minWidth: isCollection ? "260px" : "200px",
            background: T.ivory,
            boxShadow: "0 8px 32px rgba(35,30,27,0.13)",
            borderTop: `2px solid ${T.espresso}`,
            zIndex: 200,
            opacity: open ? 1 : 0,
            pointerEvents: open ? "auto" : "none",
            transform: open
              ? "translateX(-50%) translateY(0)"
              : "translateX(-50%) translateY(-8px)",
            transition: "opacity 0.2s ease, transform 0.2s ease",
            overflow: "hidden",
          }}
        >
          {/* Small notch/arrow */}
          <div
            style={{
              position: "absolute",
              top: "-6px",
              left: "50%",
              transform: "translateX(-50%)",
              width: 0,
              height: 0,
              borderLeft: "6px solid transparent",
              borderRight: "6px solid transparent",
              borderBottom: `6px solid ${T.espresso}`,
            }}
            aria-hidden="true"
          />

          <div style={{ paddingTop: "8px", paddingBottom: "8px" }}>
            {isCollection
              ? collectionLinks.map((item) => (
                  <CollectionCard key={item.path} item={item} go={go} />
                ))
              : items.map((item) => (
                  <DropdownItem key={item.path} go={go} {...item} />
                ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   MOBILE ACCORDION ITEM
══════════════════════════════════════════════════════════ */
function MobileAccordion({
  label,
  items,
  isCollection,
  go,
  collectionLinks = [],
}) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ borderBottom: `1px solid ${T.border}` }}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        style={{
          width: "100%",
          textAlign: "left",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "none",
          border: "none",
          cursor: "pointer",
          padding: "16px 0",
          fontSize: "13px",
          fontFamily: "var(--font-serif)",
          fontWeight: 500,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: T.espresso,
        }}
      >
        {label}
        <ChevronDown open={open} />
      </button>

      <div
        style={{
          overflow: "hidden",
          maxHeight: open ? "400px" : "0",
          transition: "max-height 0.3s cubic-bezier(0.4,0,0.2,1)",
        }}
      >
        <div style={{ paddingBottom: "12px" }}>
          {isCollection && (
            <button
              onClick={() => go("/collections")}
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: "4px 0 12px",
                fontSize: "12px",
                fontFamily: "var(--font-sans)",
                fontWeight: 600,
                letterSpacing: "0.09em",
                textTransform: "uppercase",
                color: T.espresso,
              }}
            >
              View All Collections
            </button>
          )}
          {isCollection
            ? collectionLinks.map((item) => (
                <button
                  key={item.path}
                  onClick={() => go(item.path)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    width: "100%",
                    textAlign: "left",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    padding: "8px 0",
                  }}
                >
                  <img
                    src={item.thumb}
                    alt={item.label}
                    style={{
                      width: "48px",
                      height: "34px",
                      objectFit: "cover",
                      flexShrink: 0,
                    }}
                  />
                  <span
                    style={{
                      fontSize: "12px",
                      fontFamily: "var(--font-sans)",
                      fontWeight: 500,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      color: T.espresso,
                    }}
                  >
                    {item.label}
                  </span>
                </button>
              ))
            : items.map((item) => (
                <button
                  key={item.path}
                  onClick={() => go(item.path)}
                  style={{
                    display: "block",
                    width: "100%",
                    textAlign: "left",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    padding: "9px 0",
                    fontSize: "12px",
                    fontFamily: "var(--font-sans)",
                    fontWeight: 500,
                    letterSpacing: "0.09em",
                    textTransform: "uppercase",
                    color: item.sale ? T.sale : T.muted,
                  }}
                >
                  {item.label}
                </button>
              ))}
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   MAIN NAVBAR
══════════════════════════════════════════════════════════ */
export default function Navbar({
  go,
  currentPath,
  hideAnnouncementBar = false,
}) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, isAuthenticated } = useAuth();
  const { categories = [] } = useCategories();

  const COLLECTION_LINKS = getCollectionLinks(categories);
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
  const shopLinks = [
    ...SHOP_LINKS.slice(0, 2),
    ...categories.map((category) => ({
      label: category.name,
      path: `/shop?category=${encodeURIComponent(category.slug)}`,
    })),
    SHOP_LINKS[2],
  ];

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [currentPath]);

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

  const handleAccountNavigation = () => {
    if (isAuthenticated) {
      go("/account");
      return;
    }
    go("/login");
  };

  return (
    <>
      {/* ══ ANNOUNCEMENT BAR ══════════════════════════════════ */}
      {!hideAnnouncementBar && (
        <div
          style={{
            backgroundColor: T.cream,
            borderBottom: `1px solid ${T.border}`,
            textAlign: "center",
            padding: "9px 20px",
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
            Complimentary Express Global Shipping on Orders Over $350
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
            padding: "20px 40px",
            display: "grid",
            gridTemplateColumns: "1fr auto 1fr",
            alignItems: "center",
            gap: "16px",
          }}
        >
          {/* ─ LOGO ─ */}
          <button
            onClick={() => go("/")}
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
            <NavItem
              label="Shop"
              path="/shop"
              items={shopLinks}
              isActive={
                currentPath === "/shop" || currentPath.startsWith("/category/")
              }
              go={go}
            />
            <NavItem
              label="Collections"
              path="/collections"
              items={[]}
              isCollection
              collectionLinks={COLLECTION_LINKS}
              isActive={
                currentPath.startsWith("/collections") ||
                (typeof window !== "undefined" &&
                  new URLSearchParams(window.location.search).has("collection"))
              }
              go={go}
            />
            {[
              { label: "About", path: "/about" },
              { label: "Help", path: "/help" },
            ].map((link) => (
              <button
                key={link.path}
                onClick={() => go(link.path)}
                aria-current={currentPath === link.path ? "page" : undefined}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: "4px 0",
                  fontSize: "11px",
                  fontFamily: "var(--font-sans)",
                  fontWeight: 500,
                  letterSpacing: "0.13em",
                  textTransform: "uppercase",
                  color: currentPath === link.path ? T.espresso : "#4A4440",
                  borderBottom:
                    currentPath === link.path
                      ? `1px solid ${T.espresso}`
                      : "1px solid transparent",
                  transition: "color 0.18s",
                  whiteSpace: "nowrap",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = T.espresso)}
                onMouseLeave={(e) =>
                  (e.currentTarget.style.color =
                    currentPath === link.path ? T.espresso : "#4A4440")
                }
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

            {/* Wishlist — hidden on mobile */}
            <button
              onClick={() =>
                isWishlistOpen ? closeWishlist() : openWishlist()
              }
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

            {/* Account — hidden on mobile */}
            <button
              onClick={handleAccountNavigation}
              aria-label="My account"
              style={{ ...iconBtn, padding: 0 }}
              className="ns-hide-mobile"
            >
              <AvatarCircle image={user?.avatar} />
            </button>

            {/* Hamburger — mobile only */}
            <button
              onClick={() => setMobileOpen((v) => !v)}
              aria-label={
                mobileOpen ? "Close navigation menu" : "Open navigation menu"
              }
              aria-expanded={mobileOpen}
              aria-controls="ns-mobile-drawer"
              style={{ ...iconBtn, display: "none" }}
              className="ns-show-mobile"
            >
              <MenuIcon open={mobileOpen} />
            </button>
          </div>
        </div>

        {/* ══ MOBILE DRAWER ══════════════════════════════════ */}
        <div
          id="ns-mobile-drawer"
          aria-hidden={!mobileOpen}
          style={{
            overflow: "hidden",
            maxHeight: mobileOpen ? "600px" : "0",
            transition: "max-height 0.38s cubic-bezier(0.4,0,0.2,1)",
            borderTop: `1px solid ${T.border}`,
            backgroundColor: T.ivory,
          }}
        >
          <nav
            aria-label="Mobile navigation"
            style={{ padding: "8px 24px 28px" }}
          >
            {/* Accordions for dropdown items */}
            <MobileAccordion label="Shop" items={shopLinks} go={go} />

            <MobileAccordion
              label="Collections"
              isCollection
              collectionLinks={COLLECTION_LINKS}
              go={go}
            />

            {/* Plain links */}
            {[
              { label: "About", path: "/about" },
              { label: "Help", path: "/help" },
            ].map((link) => (
              <button
                key={link.path}
                onClick={() => go(link.path)}
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
                    go(p);
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
      `}</style>
    </>
  );
}
