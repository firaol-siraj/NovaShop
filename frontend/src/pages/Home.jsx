import { useEffect, useState } from "react";
import { getCatalog } from "../lib/api";
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
  const [loading, setLoading] = useState(true);
  const [trendingFilter, setTrendingFilter] = useState("all");
  const { addProductToBag, toggleWishlist } = useCart();
  const { categories } = useCategories();

  const trendingFilters = [
    { label: "All", value: "all" },
    ...categories
      .filter((category) => category.name && category.slug)
      .map((category) => ({
        label: category.name,
        value: category.slug,
      })),
  ];

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const data = await getCatalog();
        if (!cancelled) setAllProducts(data);
      } catch (err) {
        console.error("Failed to load catalog:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const newArrivals = allProducts.slice(0, 4);
  const trendingProducts =
    trendingFilter === "all"
      ? allProducts.length > 4
        ? allProducts.slice(4, 8)
        : allProducts.slice(0, 4)
      : allProducts
          .filter((product) => {
            const selectedCategory = categories.find(
              (category) => category.slug === trendingFilter,
            );

            return (
              selectedCategory &&
              String(product.category || "").toLowerCase() ===
                selectedCategory.name.toLowerCase()
            );
          })
          .slice(0, 4);

  const handleCart = async (product) => {
    if (Number(product.stockTotal) === 0) return;
    const result = await addProductToBag(product, { qty: 1 });
    if (result?.needsOptions) {
      go(product.path || `/products/${product.slug}`);
    }
  };
  const handleWishlist = (product) => {
    toggleWishlist(product);
  };

  return (
    <div style={{ backgroundColor: "var(--color-bg-main)" }}>
      {/* 1. Hero */}
      <HeroSection go={go} />

      {/* 2. Shop by Category */}
      <CategorySection go={go} />

      {/* 3. New Arrivals */}
      <NewArrivalsSection
        go={go}
        products={newArrivals}
        loading={loading}
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

      {/* 5. Campaign Banner — Layers for the Season */}
      <CampaignBanner go={go} />

      {/* 6. Trending Now */}
      <ProductSection
        go={go}
        label="MOST COVETED"
        heading="Trending Now"
        viewAllPath="/shop"
        viewAllLabel="View all"
        products={trendingProducts}
        loading={loading}
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
    </div>
  );
}
