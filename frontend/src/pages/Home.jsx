/* eslint-disable react-hooks/set-state-in-effect */
import { useCallback, useEffect, useMemo, useState } from "react";
import { getCatalog } from "../lib/api";
import { homeApi } from "../lib/api/homeApi";
import { productApi } from "../lib/api/productApi";
import { normalizeCatalog } from "../lib/catalog";
import { useCart } from "../context/CartContext";

import HeroSection from "../components/home/HeroSection";
import CategorySection from "../components/home/CategorySection";
import NewArrivalsSection from "../components/home/NewArrivalsSection";
import ProductSection from "../components/home/ProductSection";
import EditorialFeature from "../components/home/EditorialFeature";
import CampaignBanner from "../components/home/CampaignBanner";
import BrandManifesto from "../components/home/BrandManifesto";
import NewsletterSection from "../components/home/NewsletterSection";

import { useCategories } from "../context/CategoryContext";

export default function Home({ go }) {
  const [allProducts, setAllProducts] = useState([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [trendingFilter, setTrendingFilter] = useState("all");
  const [trendingProducts, setTrendingProducts] = useState([]);
  const [trendingLoading, setTrendingLoading] = useState(true);
  const [trendingError, setTrendingError] = useState("");

  const { addProductToBag, toggleWishlist, openCart } = useCart();
  const { categories } = useCategories();
  const [layoutSections, setLayoutSections] = useState(null);

  // Load published homepage layout for dynamic ordering and section toggles
  useEffect(() => {
    let cancelled = false;
    async function loadLayout() {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const preview = urlParams.get('preview');
        const token = urlParams.get('token');
        const params = {};
        if (preview && token) {
          params.preview = preview;
          params.token = token;
        }
        const res = await homeApi.getHomepage(params);
        if (!cancelled && res?.data?.sections) {
          setLayoutSections(res.data.sections);
        }
      } catch {
        // Fall back to default JSX
      }
    }
    loadLayout();
    return () => {
      cancelled = true;
    };
  }, []);

  // Load catalog for New Arrivals and deterministic category ranking
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const data = await getCatalog();
        if (!cancelled) setAllProducts(data);
      } catch (err) {
        console.error("Failed to load catalog:", err);
      } finally {
        if (!cancelled) setCatalogLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  // Compute 4 deterministic top-level category filter chips
  const trendingFilters = useMemo(() => {
    const topLevelCategories = [];
    const seen = new Set();

    if (Array.isArray(categories) && categories.length > 0) {
      for (const cat of categories) {
        // De-duplicate and use only top-level categories (parent is empty / null)
        const isTopLevel = !cat.parent;
        const slug = cat.slug ? String(cat.slug).toLowerCase() : null;

        if (isTopLevel && slug && !seen.has(slug)) {
          seen.add(slug);
          topLevelCategories.push(cat);
        }
      }
    }

    // Check which categories have products in catalog
    const hasProducts = (cat) => {
      const catId = String(cat._id);
      const catSlug = String(cat.slug).toLowerCase();
      const catName = String(cat.name).toLowerCase();
      const childIds = Array.isArray(cat.children) ? cat.children.map((c) => String(c._id)) : [];
      const childSlugs = Array.isArray(cat.children) ? cat.children.map((c) => String(c.slug).toLowerCase()) : [];

      return allProducts.some((prod) => {
        const pId = String(prod.categoryId || "");
        const pSlug = String(prod.categorySlug || "").toLowerCase();
        const pCat = String(prod.category || "").toLowerCase();

        return (
          pId === catId ||
          pSlug === catSlug ||
          pCat === catName ||
          childIds.includes(pId) ||
          childSlugs.includes(pSlug)
        );
      });
    };

    const categoriesWithProducts = [];
    const categoriesWithoutProducts = [];

    for (const cat of topLevelCategories) {
      if (hasProducts(cat)) {
        categoriesWithProducts.push(cat);
      } else {
        categoriesWithoutProducts.push(cat);
      }
    }

    // Prefer categories that have products, then backend order
    const ordered = [...categoriesWithProducts, ...categoriesWithoutProducts];
    const top4 = ordered.slice(0, 4).map((cat) => ({
      label: cat.name,
      value: cat.slug,
    }));

    return [{ label: "All", value: "all" }, ...top4];
  }, [categories, allProducts]);

  // Fetch trending products directly using backend category filter
  const loadTrendingProducts = useCallback(async (filterSlug) => {
    setTrendingLoading(true);
    setTrendingError("");
    try {
      const params = { pageSize: 4 };
      if (filterSlug && filterSlug !== "all") {
        params.category = filterSlug;
      }
      const response = await productApi.getProducts(params);
      const items = normalizeCatalog(response?.data || []);
      setTrendingProducts(items);
    } catch (err) {
      setTrendingError(err.message || "Failed to load trending products");
    } finally {
      setTrendingLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTrendingProducts(trendingFilter);
  }, [trendingFilter, loadTrendingProducts]);

  const newArrivals = allProducts.slice(0, 4);

  const handleCart = async (product) => {
    const result = await addProductToBag(product, { qty: 1 });
    if (result?.needsOptions) {
      go(product.path || `/products/${product.slug}`);
    } else if (result?.ok) {
      openCart?.();
    }
    return result;
  };

  const handleWishlist = (product) => {
    toggleWishlist(product);
  };

  const renderSectionByType = (section) => {
    const type = section?.type || section?.id;
    switch (type) {
      case 'announcement':
      case 'announcementBar':
        return (
          <div
            key={section.id || 'announcement'}
            role="region"
            aria-label="Announcement"
            style={{
              backgroundColor: "var(--color-sand, #F7F5F0)",
              borderBottom: "1px solid var(--color-border, #E6E2DC)",
              padding: "9px 16px",
              textAlign: "center",
            }}
          >
            <a
              href={section.data?.link || section.config?.link || "/shop"}
              onClick={(e) => {
                const targetLink = section.data?.link || section.config?.link;
                if (go && targetLink) {
                  e.preventDefault();
                  go(targetLink);
                }
              }}
              style={{
                textDecoration: "none",
                fontSize: "11px",
                fontFamily: "var(--font-sans)",
                fontWeight: 600,
                letterSpacing: "0.13em",
                textTransform: "uppercase",
                color: "var(--color-espresso, #2D241E)",
                display: "inline-block",
                transition: "opacity 0.15s ease",
              }}
            >
              {section.data?.text || section.config?.text || "Free shipping on orders over $300"}
            </a>
          </div>
        );

      case 'hero':
      case 'heroSlides':
        return <HeroSection key={section.id || 'hero'} go={go} />;

      case 'categories':
      case 'featuredCategories':
        return <CategorySection key={section.id || 'categories'} go={go} />;

      case 'arrivals':
      case 'newArrivals':
        return (
          <NewArrivalsSection
            key={section.id || 'new-arrivals'}
            go={go}
            products={newArrivals}
            loading={catalogLoading}
            onAddToCart={handleCart}
            onAddToWishlist={handleWishlist}
          />
        );

      case 'promo':
      case 'promotionalBanner':
        return <CampaignBanner key={section.id || 'promo'} go={go} />;

      case 'bestsellers':
      case 'bestSellers':
        return (
          <ProductSection
            key={section.id || 'best-sellers'}
            go={go}
            label={section.config?.subtitle || "MOST COVETED"}
            heading={section.config?.title || "Trending Now"}
            viewAllLabel="View more"
            products={trendingProducts}
            loading={trendingLoading}
            error={trendingError}
            onRetry={() => loadTrendingProducts(trendingFilter)}
            filters={trendingFilters}
            activeFilter={trendingFilter}
            onFilterChange={setTrendingFilter}
            onAddToCart={handleCart}
            onAddToWishlist={handleWishlist}
          />
        );

      case 'brandstory':
      case 'brandStory':
        return (
          <div key={section.id || 'brand-story'}>
            <EditorialFeature
              go={go}
              imageSrc="https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=1200&q=85"
              imageAlt="Woman in a trench coat leaning against warm stone architecture during golden hour"
              label={section.config?.eyebrow || "SPRING / SUMMER '26 COLLECTION"}
              heading={section.config?.title || "Modern Essentials."}
              description={section.config?.body || section.config?.description || "Timeless silhouettes, refined materials, and effortless pieces designed for everyday wear."}
              ctaLabel="EXPLORE COLLECTION"
              ctaPath="/shop"
              imageLeft={true}
              bgColor="var(--color-sand)"
            />
            <BrandManifesto go={go} />
          </div>
        );

      case 'newsletter':
        return <NewsletterSection key={section.id || 'newsletter'} />;

      default:
        return null;
    }
  };

  const visibleSortedSections = useMemo(() => {
    if (!Array.isArray(layoutSections)) return null;
    return [...layoutSections]
      .filter((s) => s.visible !== false)
      .sort((a, b) => (a.order || 0) - (b.order || 0));
  }, [layoutSections]);

  return (
    <div style={{ backgroundColor: "var(--color-bg-main)" }}>
      {visibleSortedSections ? (
        visibleSortedSections.map((sec) => renderSectionByType(sec))
      ) : (
        <>
          {/* 1. Hero Carousel */}
          <HeroSection go={go} />

          {/* 2. Shop by Category */}
          <CategorySection go={go} />

          {/* 3. New Arrivals */}
          <NewArrivalsSection
            go={go}
            products={newArrivals}
            loading={catalogLoading}
            onAddToCart={handleCart}
            onAddToWishlist={handleWishlist}
          />

          {/* 4. Modern Essentials — Editorial Feature */}
          <EditorialFeature
            go={go}
            imageSrc="https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=1200&q=85"
            imageAlt="Woman in a trench coat leaning against warm stone architecture during golden hour"
            label="SPRING / SUMMER '26 COLLECTION"
            heading="Modern Essentials."
            description="Timeless silhouettes, refined materials, and effortless pieces designed for everyday wear."
            ctaLabel="EXPLORE COLLECTION"
            ctaPath="/shop"
            imageLeft={true}
            bgColor="var(--color-sand)"
          />

          {/* 5. Campaign Banner — Dynamic Hero Banner from Backend */}
          <CampaignBanner go={go} />

          {/* 6. Trending Now */}
          <ProductSection
            go={go}
            label="MOST COVETED"
            heading="Trending Now"
            viewAllLabel="View more"
            products={trendingProducts}
            loading={trendingLoading}
            error={trendingError}
            onRetry={() => loadTrendingProducts(trendingFilter)}
            filters={trendingFilters}
            activeFilter={trendingFilter}
            onFilterChange={setTrendingFilter}
            onAddToCart={handleCart}
            onAddToWishlist={handleWishlist}
          />

          {/* 7. Brand Manifesto */}
          <BrandManifesto go={go} />

          {/* 8. Newsletter */}
          <NewsletterSection />
        </>
      )}
    </div>
  );
}
