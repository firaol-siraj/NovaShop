/**
 * Shared Authoritative Stock Status Resolution
 *
 * Rules:
 * - Use available = on hand (stock) minus reserved for each active variant. Ignore archived/inactive variants.
 * - Product is "Out of stock" only if ALL active variants have available <= 0.
 * - Product is "Low stock" if it is not out of stock and at least one variant is low (available <= its threshold, else global threshold).
 * - Otherwise "In stock".
 * - A product with no variants is "Out of stock" only if its own stock is 0.
 */
export function getProductStockStatus(variants = [], options = {}) {
  const globalThreshold = typeof options === 'number' ? options : (options?.globalThreshold ?? 5);
  const productStock = typeof options === 'object' ? (options?.productStock ?? 0) : 0;

  // Active variants: ignore archived or inactive variants
  const activeVariants = (variants || []).filter((v) => {
    if (!v) return false;
    if (v.status === 'archived' || v.isArchived === true) return false;
    if (v.isActive === false) return false;
    return true;
  });

  // If product has no active variants, evaluate from product's own stock
  if (activeVariants.length === 0) {
    return productStock <= 0 ? 'Out of stock' : productStock <= globalThreshold ? 'Low stock' : 'In stock';
  }

  let allZeroOrLess = true;
  let hasLowVariant = false;

  for (const v of activeVariants) {
    const stock = Number(v.stock ?? v.stockQuantity ?? 0);
    const reserved = Number(v.reserved ?? 0);
    const available = Math.max(0, stock - reserved);
    const threshold = v.lowStockThreshold != null ? Number(v.lowStockThreshold) : globalThreshold;

    if (available > 0) {
      allZeroOrLess = false;
    }
    if (available > 0 && available <= threshold) {
      hasLowVariant = true;
    }
  }

  if (allZeroOrLess) {
    return 'Out of stock';
  }

  if (hasLowVariant) {
    return 'Low stock';
  }

  return 'In stock';
}

/**
 * Returns detailed variant analysis for restocking and alerts
 */
export function analyzeVariantStock(variants = [], options = {}) {
  const globalThreshold = typeof options === 'number' ? options : (options?.globalThreshold ?? 5);

  const activeVariants = (variants || []).filter((v) => {
    if (!v) return false;
    if (v.status === 'archived' || v.isArchived === true) return false;
    if (v.isActive === false) return false;
    return true;
  });

  const lowOrOutVariants = [];
  let totalAvailable = 0;

  for (const v of activeVariants) {
    const stock = Number(v.stock ?? v.stockQuantity ?? 0);
    const reserved = Number(v.reserved ?? 0);
    const available = Math.max(0, stock - reserved);
    const threshold = v.lowStockThreshold != null ? Number(v.lowStockThreshold) : globalThreshold;

    totalAvailable += available;

    if (available <= threshold) {
      lowOrOutVariants.push({
        variant: v,
        available,
        stock,
        reserved,
        threshold,
        isOut: available <= 0,
        isCritical: available <= 3 && available > 0,
        isLow: available > 3 && available <= threshold,
      });
    }
  }

  return {
    totalVariants: activeVariants.length,
    lowOrOutCount: lowOrOutVariants.length,
    lowOrOutVariants,
    totalAvailable,
  };
}
