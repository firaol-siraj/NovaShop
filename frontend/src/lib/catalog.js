const API_ORIGIN = (
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_URL) || "http://localhost:5000/api/v1"
).replace(/\/api\/v1\/?$/, "");
const PLACEHOLDER_IMAGE =
  "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=900&q=85";

export function resolveImage(image) {
  if (!image) return PLACEHOLDER_IMAGE;
  const src = typeof image === "string" ? image : (image?.url || image?.secure_url || image?.src || "");
  if (!src) return PLACEHOLDER_IMAGE;
  if (/^https?:\/\//i.test(src) || src.startsWith("data:") || src.startsWith("blob:")) return src;
  return `${API_ORIGIN}${src.startsWith("/") ? src : `/${src}`}`;
}

function normalizePrice(value) {
  const price = Number(value);
  return Number.isFinite(price) ? price : 0;
}

function normalizeCategory(category) {
  if (typeof category === "string") return category;
  return category?.name || category?.slug || "General";
}

function normalizeVariant(variant, fallbackImage) {
  if (!variant || typeof variant !== "object") {
    const id = typeof variant === "string" ? variant : undefined;
    return {
      name: "Default",
      hex: "#000000",
      hasOwnImage: false,
      image: fallbackImage,
      size: "One Size",
      available: false,
      stock: 0,
      id,
      sku: id,
    };
  }

  const color = variant?.color?.name || variant?.color || "Default";
  // The backend copies the product's main image onto every variant that has no
  // photo of its own, so only a *different* image counts as a variant photo.
  const hasOwnImage =
    Boolean(variant?.image) && resolveImage(variant.image) !== fallbackImage;

  const rawStock = Number(variant?.stock ?? variant?.countInStock);
  const stock = Number.isFinite(rawStock) && rawStock >= 0 ? rawStock : 0;

  return {
    name: color,
    hex: variant?.color?.hex || "#000000",
    hasOwnImage,
    // Variants without their own photo use the product's uploaded images.
    image: hasOwnImage ? resolveImage(variant.image) : fallbackImage,
    size: variant?.size || "One Size",
    available: stock > 0,
    stock,
    id: variant._id || variant.id,
    sku: variant.sku || variant._id || variant.id,
  };
}

export function normalizeProduct(product) {
  if (!product) return null;

  const productImages = (
    Array.isArray(product.images) && product.images.length > 0
      ? product.images
      : [product.image]
  )
    .filter(Boolean)
    .map(resolveImage);
  if (productImages.length === 0) productImages.push(PLACEHOLDER_IMAGE);

  const rawVariants = Array.isArray(product.variants)
    ? product.variants.map((variant) =>
        normalizeVariant(variant, productImages[0]),
      )
    : [];

  const fallbackStock = Number(
    product.countInStock != null
      ? product.countInStock
      : (product.stockTotal != null ? product.stockTotal : product.stock)
  ) || 0;

  const variantStockSum = rawVariants.reduce(
    (sum, variant) => sum + Number(variant?.stock || 0),
    0,
  );

  const stockTotal = rawVariants.length > 0 ? variantStockSum : fallbackStock;

  const variants =
    rawVariants.length > 0
      ? rawVariants.map((variant) => {
          const vStock = Number(variant.stock) >= 0 ? Number(variant.stock) : 0;
          return {
            ...variant,
            stock: vStock,
            available: vStock > 0,
          };
        })
      : [
          {
            name: "Default",
            hex: "#000000",
            hasOwnImage: false,
            image: productImages[0],
            size: "One Size",
            available: stockTotal > 0,
            stock: Math.max(0, stockTotal),
            id: product._id || product.slug,
            sku: product.slug,
          },
        ];

  const stockLabel = stockTotal <= 0 ? "out-of-stock" : stockTotal <= 5 ? "low-stock" : "in-stock";
  const primaryVariant = variants[0];
  const primaryImage = primaryVariant?.hasOwnImage
    ? primaryVariant.image
    : productImages[0];
  const images = productImages;
  const category = normalizeCategory(product.category);
  const categoryId = product.category?._id || product.category || null;
  const categorySlug = product.category?.slug || null;

  return {
    id: product._id || product.slug,
    productId: product._id || product.slug,
    slug: product.slug,
    name: product.name,
    category,
    categoryId,
    categorySlug,
    collection: category,
    price: normalizePrice(product.price),
    priceValue: normalizePrice(product.price),
    originalPrice: normalizePrice(product.price),
    rating: Number(product.rating) || 0,
    reviewCount: Number(product.numReviews) || 0,
    reviews: Array.isArray(product.reviews)
      ? product.reviews.map((review) => ({
          name: review.name || "Verified customer",
          verified: Boolean(review.verified),
          rating: Number(review.rating) || 0,
          text: review.comment || review.text || "",
        }))
      : [],
    description: product.description,
    brand: product.brand || "NovaShop",
    countInStock: stockTotal,
    stock: stockLabel,
    stockTotal,
    numReviews: Number(product.numReviews) || 0,
    gender: product.gender || "unisex",
    material: product.material || "",
    fit: product.fit || "",
    care: product.careInstructions || "",
    origin: product.origin || "",
    variant: primaryVariant?.name || "Default",
    variants,
    colors:
      variants.length > 0
        ? variants
            .reduce((result, variant) => {
              const existing = result.find(
                (color) => color.name === variant.name,
              );
              if (existing) {
                if (
                  variant.hasOwnImage &&
                  !existing.images.includes(variant.image)
                )
                  existing.images.push(variant.image);
                if (variant.available) existing.available = true;
                if (!existing.sizes.some((size) => size.label === variant.size && size.variantId === variant.id)) {
                  existing.sizes.push({
                    label: variant.size,
                    available: variant.available,
                    variantId: variant.id,
                    stock: variant.stock,
                  });
                }
              } else {
                result.push({
                  name: variant.name,
                  hex: variant.hex,
                  images: variant.hasOwnImage ? [variant.image] : [],
                  available: variant.available,
                  sizes: [
                    {
                      label: variant.size,
                      available: variant.available,
                      variantId: variant.id,
                      stock: variant.stock,
                    },
                  ],
                });
              }
              return result;
            }, [])
            .map((color) => ({
              ...color,
              images: color.images.length > 0 ? color.images : productImages,
            }))
        : [
            {
              name: "Default",
              hex: "#000000",
              images: productImages,
              available: stockTotal > 0,
              sizes: [
                {
                  label: "One Size",
                  available: stockTotal > 0,
                  variantId: product._id || product.slug,
                  stock: Math.max(0, stockTotal),
                },
              ],
            },
          ],
    swatches:
      variants.length > 0
        ? variants.reduce((result, variant) => {
            if (!result.some((swatch) => swatch.hex === variant.hex)) {
              result.push({ hex: variant.hex, image: variant.image });
            }
            return result;
          }, [])
        : [{ hex: "#000000", image: primaryImage }],
    primaryImage,
    hoverImage: images[1] || primaryImage,
    image: primaryImage,
    images,
    path: `/products/${product.slug}`,
    bestseller: Boolean(product.bestseller),
    sale: Boolean(product.sale),
    size: primaryVariant?.size || "One Size",
    sizeGuideNote: primaryVariant?.size || "One Size",
    sizes:
      variants.length > 0
        ? variants.map((variant) => ({
            label: variant.size,
            available: variant.available,
            stock: variant.stock,
            variantId: variant.id,
          }))
        : [{ label: "One Size", available: stockTotal > 0, stock: Math.max(0, stockTotal), variantId: product._id || product.slug }],
    details: {
      material: product.material || "Not specified",
      fit: product.fit || "Regular fit",
      care: product.careInstructions || "Care instructions not available",
      origin: product.origin || "Not specified",
    },
    shippingNote: "Shipping details available at checkout",
    returnNote: "Complimentary returns are available within the stated policy",
    fitNotes: product.fit || "Fit details are not available",
    shippingPolicy: "Shipping and return policy is available at checkout",
    relatedProducts: [],
  };
}

export function normalizeCatalog(products) {
  if (!Array.isArray(products)) return [];
  return products.map(normalizeProduct).filter(Boolean);
}
