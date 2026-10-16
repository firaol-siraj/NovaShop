export const getUnitPrice = (product, variant) => {
  const variantPrice = Number(variant?.price);
  if (Number.isFinite(variantPrice) && variantPrice > 0) return variantPrice;
  const productPrice = Number(product?.price);
  return Number.isFinite(productPrice) && productPrice >= 0 ? productPrice : 0;
};

export const MAX_QTY_PER_LINE = 10;
