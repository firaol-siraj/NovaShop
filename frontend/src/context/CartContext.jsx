/* eslint-disable react-refresh/only-export-components, react-hooks/set-state-in-effect */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useAuth } from "./AuthContext";
import { cartApi } from "../lib/api/cartApi";
import { wishlistApi } from "../lib/api/wishlistApi";
import { productApi } from "../lib/api/productApi";
import { discountApi } from "../lib/api/discountApi";
import { normalizeProduct, resolveImage } from "../lib/catalog";
import { trackAddToCart } from "../lib/tracker";

/**
 * Milestone 5: Cart & Wishlist
 * Signed-in customers use the server as the source of truth.
 * Guests keep versioned localStorage snapshots (informational only).
 */

const CartContext = createContext(null);

const CART_KEY = "novashop_guest_cart_v2";
const WISHLIST_KEY = "novashop-wishlist";
const WISHLIST_BACKUP_KEY = "novashop_guest_wishlist_v2";
const SAVE_KEY_PREFIX = "novashop_saved_v2_";
const LEGACY_KEYS = ["novashop_cart"];
const MAX_QTY_PER_LINE = 10;

const validPromoCodes = [];

function toast(message) {
  window.dispatchEvent(new CustomEvent("novashop:toast", { detail: { message } }));
}

function navigate(path) {
  window.dispatchEvent(new CustomEvent("novashop:navigate", { detail: { path } }));
}

const removeLegacyKeys = () => {
  LEGACY_KEYS.forEach((key) => {
    try {
      localStorage.removeItem(key);
    } catch {
      // ignore
    }
  });
};

function readStoredArray(key, fallback = []) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return fallback;
    return parsed.filter(
      (item) => item && typeof item === "object" && !Array.isArray(item)
    );
  } catch {
    return fallback;
  }
}

function writeStoredValue(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage can be unavailable or full; keep the in-memory app usable.
  }
}

function removeStoredValue(key) {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

function savedKeyForUser(userId) {
  return SAVE_KEY_PREFIX + (userId || "guest");
}

function mapServerLine(line) {
  return {
    id: String(line._id),
    productId: String(line.productId),
    variantId: line.variantId ? String(line.variantId) : null,
    slug: line.slug,
    name: line.name,
    color: line.color,
    size: line.size,
    price: Number(line.price) || 0,
    qty: Number(line.quantity) || 1,
    image: resolveImage(line.image),
    stock: Number(line.stock) || 0,
    available: Boolean(line.available),
    issue: line.issue || null,
    maxQuantity: Number(line.maxQuantity) || MAX_QTY_PER_LINE,
    sku: line.sku,
  };
}

function guestWishlistEntryToProduct(entry) {
  const snapshot = entry._snapshot || {};
  const productId = entry.productId;
  return {
    productId,
    id: productId,
    slug: snapshot.slug || productId,
    name: snapshot.name || "Unnamed",
    price: Number(snapshot.price) || 0,
    primaryImage: snapshot.image || "",
    image: snapshot.image || "",
    category: snapshot.category || "General",
    stockTotal: Number(snapshot.stock) || 0,
    stock: Number(snapshot.stock) > 0 ? "in-stock" : "out-of-stock",
    variants: [],
    rating: 0,
    numReviews: 0,
    originalPrice: 0,
    sale: false,
    size: snapshot.size || "One Size",
    collection: snapshot.category || "General",
  };
}

function snapshotFromProduct(product) {
  return {
    name: product?.name,
    price: Number(product?.price) || 0,
    image: product?.primaryImage || product?.image || "",
    category: product?.category || product?.collection || "General",
    stock: product?.stockTotal ?? product?.countInStock ?? 0,
    size: product?.size || "One Size",
    color: product?.color || product?.variant || "Default",
    slug: product?.slug,
  };
}


function purchasableVariants(product) {
  return (product?.variants || []).filter(
    (variant) => Number(variant.stock) > 0 || variant.available !== false
  );
}

function variantKey(variant) {
  return variant?.id || variant?._id || variant?.variantId || null;
}

export function CartProvider({ children }) {
  const { user, isAuthenticated, isLoading } = useAuth();
  const userIdentity = user ? String(user._id) : "guest";
  const isAuth = Boolean(isAuthenticated && user);

  const [items, setItems] = useState(() => {
    if (typeof window === "undefined") return [];
    return readStoredArray(CART_KEY, []).map((line) => ({
      productId: line.productId,
      variantId: line.variantId,
      quantity: Number(line.quantity) || 1,
      qty: Number(line.quantity) || 1,
      id: `${line.productId}|${line.variantId}`,
      ...(line._snapshot || {}),
      image: line._snapshot?.image || "",
      price: Number(line._snapshot?.price) || 0,
    }));
  });

  const [savedItems, setSavedItems] = useState(() =>
    readStoredArray(savedKeyForUser(userIdentity), [])
  );

  const [wishlistItems, setWishlistItems] = useState(() => {
    if (typeof window === "undefined") return [];
    return readStoredArray(WISHLIST_KEY, []).map((entry) =>
      guestWishlistEntryToProduct(entry)
    );
  });

  const [cartLoading, setCartLoading] = useState(true);
  const [orders, setOrders] = useState(() =>
    readStoredArray("novashop_orders", [])
  );
  const [currentOrder, setCurrentOrder] = useState(() => {
    try {
      const raw = localStorage.getItem("novashop_current_order");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isWishlistOpen, setIsWishlistOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [appliedPromo, setAppliedPromo] = useState("");
  const [promoDiscount, setPromoDiscount] = useState(0);
  const [promoMessage, setPromoMessage] = useState("");

  const subtotal = useMemo(() => {
    let sum = 0;
    for (const item of items) {
      if (item.issue) continue;
      sum += (Number(item.price) || 0) * (Number(item.qty) || 1);
    }
    return Number(sum.toFixed(2));
  }, [items]);

  const total = Math.max(subtotal - promoDiscount, 0);
  const totalItems = useMemo(
    () => items.reduce((sum, item) => sum + (Number(item.qty) || 1), 0),
    [items]
  );
  const distinctItemCount = items.length;
  const wishlistCount = wishlistItems.length;
  const hasCartIssues = items.some((line) => line.issue);

  const didMergeRef = useRef(false);
  const previousAuthRef = useRef(false);
  const currentUserIdRef = useRef(user ? String(user._id) : null);

  const writeGuestCart = useCallback((lines) => {
    writeStoredValue(
      CART_KEY,
      lines.map((line) => ({
        productId: line.productId,
        variantId: line.variantId,
        quantity: Number(line.qty || line.quantity) || 1,
        _snapshot: {
          name: line.name,
          color: line.color,
          size: line.size,
          price: line.price,
          image: line.image,
          slug: line.slug,
          stock: line.stock,
        },
      }))
    );
  }, []);

  const writeGuestWishlist = useCallback((list) => {
    try {
      const ids = list.map((item) => String(item.productId || item.id || item._id)).filter(Boolean);
      localStorage.setItem("novashop-wishlist", JSON.stringify(ids));
      writeStoredValue(
        WISHLIST_KEY,
        list.map((item) => ({
          productId: String(item.productId || item.id || item._id),
          _snapshot: snapshotFromProduct(item),
        }))
      );
      writeStoredValue(
        WISHLIST_BACKUP_KEY,
        list.map((item) => ({
          productId: String(item.productId || item.id || item._id),
          _snapshot: snapshotFromProduct(item),
        }))
      );
    } catch {
      // storage unavailable
    }
  }, []);

  const clearGuestStorage = useCallback(() => {
    removeStoredValue(CART_KEY);
    removeStoredValue(WISHLIST_KEY);
    removeStoredValue(WISHLIST_BACKUP_KEY);
    try {
      localStorage.removeItem("novashop-wishlist");
    } catch {
      // ignore
    }
    removeLegacyKeys();
  }, []);

  const applyServerCart = useCallback((payload) => {
    setItems((payload?.items || []).map(mapServerLine));
  }, []);

  const applyServerWishlist = useCallback((payload) => {
    setWishlistItems((payload?.items || []).map(normalizeProduct).filter(Boolean));
  }, []);

  const refreshCart = useCallback(async () => {
    if (!isAuth) {
      setCartLoading(false);
      return;
    }
    setCartLoading(true);
    try {
      const res = await cartApi.getCart();
      applyServerCart(res.data);
    } catch (error) {
      toast(error?.message || "Unable to load your cart. Check your connection.");
    } finally {
      setCartLoading(false);
    }
  }, [isAuth, applyServerCart]);

  const refreshWishlist = useCallback(async () => {
    if (!isAuth) return;
    try {
      const res = await wishlistApi.getWishlist();
      applyServerWishlist(res.data);
    } catch (error) {
      toast(error?.message || "Unable to load your wishlist.");
    }
  }, [isAuth, applyServerWishlist]);

  const mergeGuest = useCallback(async () => {
    const guestCart = readStoredArray(CART_KEY, []);
    const guestWishlist = readStoredArray(WISHLIST_KEY, []);
    let merged = false;

    if (guestCart.length > 0) {
      const payload = guestCart.map((line) => ({
        productId: line.productId,
        variantId: line.variantId,
        quantity: Math.min(MAX_QTY_PER_LINE, Number(line.quantity) || 1),
      }));
      try {
        const res = await cartApi.mergeGuestCart(payload);
        if (res.data) {
          applyServerCart(res.data);
          const reports = [
            ...(res.data.skipped || []),
            ...(res.data.adjusted || []),
          ];
          if (reports.length > 0) {
            const details = reports
              .map((report) => {
                const base = `product ${report.productId}${report.variantId ? "/" + report.variantId : ""}`;
                if (report.adjusted || report.to != null) {
                  return `${base} ${report.from} -> ${report.to} (clamped)`;
                }
                return `${base} skipped (${report.reason})`;
              })
              .join("; ");
            toast(`Cart merge: ${details}`);
          }
          merged = true;
        }
      } catch (error) {
        toast(error?.message || "Could not merge your cart");
      }
    }

    let guestWishlistIds = [];
    try {
      const rawNovashop = localStorage.getItem("novashop-wishlist");
      if (rawNovashop) {
        const parsed = JSON.parse(rawNovashop);
        if (Array.isArray(parsed)) {
          guestWishlistIds = parsed
            .map((item) => (typeof item === 'string' ? item : (item.productId || item.id || item._id)))
            .filter(Boolean);
        }
      }
    } catch {
      // ignore
    }

    if (guestWishlistIds.length === 0) {
      const guestWishlist = readStoredArray(WISHLIST_KEY, []);
      guestWishlistIds = guestWishlist.map((item) => item.productId).filter(Boolean);
    }

    if (guestWishlistIds.length > 0) {
      try {
        const res = await wishlistApi.mergeGuestWishlist(guestWishlistIds);
        if (res.data) {
          applyServerWishlist(res.data);
          merged = true;
        }
      } catch (error) {
        toast(error?.message || "Could not merge your wishlist");
      }
    }

    if (merged) {
      clearGuestStorage();
    }
  }, [applyServerCart, applyServerWishlist, clearGuestStorage]);

  const addProductToBag = useCallback(
    async (product, meta = {}) => {
      const { qty = 1, variantId, color, size, openDrawer = true, toastMessage } = meta;
      const productId = product?.productId || product?.id || product?._id;
      if (!productId) {
        return { ok: false, message: "Unknown product" };
      }

      let resolvedProduct = product;
      let variants = Array.isArray(product?.variants) ? [...product.variants] : [];

      if (!variantId && variants.length === 0) {
        try {
          const res = await productApi.getProduct(product?.slug || productId);
          if (res?.data) {
            resolvedProduct = normalizeProduct(res.data) || res.data;
            variants = Array.isArray(resolvedProduct?.variants) ? resolvedProduct.variants : [];
          }
        } catch {
          // fallback
        }
      }

      if (Number(resolvedProduct?.stockTotal) === 0 && variants.length > 0) {
        const noneInStock = variants.every((v) => Number(v.stock) <= 0);
        if (noneInStock) {
          toast("This item is sold out");
          return { ok: false, message: "Out of stock" };
        }
      }

      const inStockVariants = variants.filter(
        (v) => (Number(v.stock) > 0 || v.stock == null) && v.available !== false
      );
      const purchasable =
        inStockVariants.length > 0
          ? inStockVariants
          : purchasableVariants(resolvedProduct).length > 0
          ? purchasableVariants(resolvedProduct)
          : variants;

      const chosenVariant =
        (variantId && variants.find((v) => String(variantKey(v)) === String(variantId))) ||
        purchasable[0] ||
        variants[0] ||
        null;

      const resolvedVariantId =
        variantId || (chosenVariant ? variantKey(chosenVariant) : null);

      if (!resolvedVariantId && variants.length > 0) {
        navigate(resolvedProduct?.path || `/products/${resolvedProduct?.slug || productId}`);
        return { ok: false, needsOptions: true, message: "Choose a colour and size" };
      }

      const requestedQty = Math.max(1, Number(qty) || 1);
      const chosenColor =
        color ||
        chosenVariant?.color ||
        chosenVariant?.colorName ||
        resolvedProduct?.color ||
        resolvedProduct?.variant ||
        "Default";
      const chosenSize =
        size ||
        chosenVariant?.size ||
        resolvedProduct?.size ||
        "One Size";
      const chosenPrice =
        Number(chosenVariant?.price ?? resolvedProduct?.price ?? 0);
      const chosenImage =
        chosenVariant?.image ||
        resolvedProduct?.primaryImage ||
        resolvedProduct?.image ||
        "";

      trackAddToCart({
        productId,
        name: resolvedProduct?.name,
        price: chosenPrice,
        qty: requestedQty,
      });

      if (isAuth) {
        try {
          const res = await cartApi.addItem({
            productId,
            variantId: resolvedVariantId,
            quantity: requestedQty,
          });
          applyServerCart(res.data);
          const existing = (res.data?.items || []).find(
            (line) =>
              String(line.productId) === String(productId) &&
              String(line.variantId) === String(resolvedVariantId)
          );
          const wasIncremented = Number(existing?.quantity) > requestedQty;
          toast(toastMessage || (wasIncremented ? "Quantity updated" : "Added to bag"));
          if (openDrawer) {
            setIsCartOpen(true);
          }
          return { ok: true, wasIncremented, message: res.message };
        } catch (error) {
          toast(error?.message || "Could not add this item");
          return { ok: false, message: error?.message };
        }
      }

      const lineId = resolvedVariantId ? `${productId}|${resolvedVariantId}` : String(productId);
      let wasIncremented = false;
      setItems((current) => {
        const existing = current.find((line) => line.id === lineId);
        const maxQty = Math.min(
          Number(chosenVariant?.stock ?? resolvedProduct?.stockTotal) || MAX_QTY_PER_LINE,
          MAX_QTY_PER_LINE
        );
        if (existing) {
          wasIncremented = true;
          const nextQty = Math.min(
            (Number(existing.qty) || 1) + requestedQty,
            maxQty
          );
          if (nextQty === Number(existing.qty)) {
            toast(`Only ${maxQty} of this item can be added to your bag.`);
          }
          return current.map((line) =>
            line.id === lineId ? { ...line, qty: nextQty, quantity: nextQty } : line
          );
        }
        const nextLine = {
          id: lineId,
          productId,
          variantId: resolvedVariantId,
          qty: Math.min(requestedQty, maxQty),
          quantity: Math.min(requestedQty, maxQty),
          name: resolvedProduct?.name || product?.name,
          color: chosenColor,
          size: chosenSize,
          price: chosenPrice,
          image: chosenImage,
          slug: resolvedProduct?.slug || product?.slug,
          stock: Number(chosenVariant?.stock ?? resolvedProduct?.stockTotal) || 0,
          available: true,
          issue: null,
          maxQuantity: maxQty,
        };
        return [...current, nextLine];
      });
      toast(toastMessage || (wasIncremented ? "Quantity updated" : "Added to bag"));
      if (openDrawer) {
        setIsCartOpen(true);
      }
      return { ok: true, wasIncremented };
    },
    [isAuth, applyServerCart, setIsCartOpen]
  );

  const removeItem = useCallback(
    (id) => {
      if (!isAuth) {
        setItems((current) => current.filter((line) => line.id !== id));
        return;
      }
      cartApi
        .removeItem(id)
        .then((res) => applyServerCart(res.data))
        .catch((error) => {
          toast(error?.message || "Could not remove this item");
        });
    },
    [isAuth, applyServerCart]
  );

  const updateQuantity = useCallback(
    (id, qty) => {
      const nextQty = Math.max(1, Number(qty) || 1);
      const line = items.find((item) => item.id === id);
      const maxQty = Math.min(
        Number(line?.maxQuantity || line?.stock || MAX_QTY_PER_LINE),
        MAX_QTY_PER_LINE
      );
      const clamped = Math.min(nextQty, maxQty);
      if (clamped < nextQty) {
        toast(`Only ${clamped} available — quantity adjusted`);
      }

      if (!isAuth) {
        setItems((current) =>
          current.map((item) =>
            item.id === id ? { ...item, qty: clamped, quantity: clamped } : item
          )
        );
        return;
      }

      cartApi
        .updateItem(id, { quantity: clamped })
        .then((res) => applyServerCart(res.data))
        .catch((error) => {
          toast(error?.message || "Could not update quantity");
        });
    },
    [isAuth, items, applyServerCart]
  );

  const clearCart = useCallback(() => {
    if (isAuth) {
      cartApi
        .clearCart()
        .then((res) => applyServerCart(res.data))
        .catch(() => setItems([]));
    } else {
      setItems([]);
      writeGuestCart([]);
    }
  }, [isAuth, applyServerCart, writeGuestCart]);

  const saveForLater = useCallback(
    (itemOrId) => {
      const item =
        typeof itemOrId === "object"
          ? itemOrId
          : items.find((entry) => entry.id === itemOrId);
      if (!item) return false;
      const key = savedKeyForUser(userIdentity);
      setSavedItems((current) => {
        const existing = current.find(
          (saved) =>
            saved.productId === item.productId && saved.variantId === item.variantId
        );
        const qty = Number(item.qty) || 1;
        const next = current.filter(
          (saved) =>
            !(
              saved.productId === item.productId &&
              saved.variantId === item.variantId
            )
        );
        const nextItem = { ...item, qty: (Number(existing?.qty) || 0) + qty };
        writeStoredValue(key, [...next, nextItem]);
        return [...next, nextItem];
      });
      trackAddToCart({
        productId,
        name: resolvedProduct?.name,
        price: chosenPrice,
        qty: requestedQty,
      });

      if (isAuth) {
        cartApi
          .removeItem(item.id)
          .then((res) => applyServerCart(res.data))
          .catch(() => {
            setItems((current) => current.filter((entry) => entry.id !== item.id));
          });
      } else {
        setItems((current) => current.filter((entry) => entry.id !== item.id));
      }
      return true;
    },
    [items, userIdentity, isAuth, applyServerCart]
  );

  const removeSavedItem = useCallback(
    (productId, variantId) => {
      const key = savedKeyForUser(userIdentity);
      setSavedItems((current) => {
        const next = current.filter(
          (saved) =>
            !(
              (String(saved.productId) === String(productId) ||
                String(saved.id) === String(productId)) &&
              (variantId == null || String(saved.variantId) === String(variantId))
            )
        );
        writeStoredValue(key, next);
        return next;
      });
    },
    [userIdentity]
  );

  const moveToBag = useCallback(
    async (itemOrId) => {
      const item =
        typeof itemOrId === "object"
          ? itemOrId
          : savedItems.find(
              (entry) =>
                String(entry.id) === String(itemOrId) ||
                String(entry.productId) === String(itemOrId) ||
                `${entry.productId}|${entry.variantId}` === String(itemOrId)
            ) ||
            items.find((entry) => String(entry.id) === String(itemOrId));
      if (!item) return false;

      const targetProductId = item.productId || item.id || item._id;
      const targetVariantId = item.variantId;
      const requestedQty = Number(item.qty || item.quantity) || 1;

      const result = await addProductToBag(item, {
        qty: requestedQty,
        variantId: targetVariantId,
        color: item.color,
        size: item.size,
        openDrawer: true,
        toastMessage: "Moved to bag",
      });

      if (result?.ok) {
        removeSavedItem(targetProductId, targetVariantId);
        setIsCartOpen(true);
        return true;
      }
      return false;
    },
    [savedItems, items, addProductToBag, removeSavedItem, setIsCartOpen]
  );

  const removeWishlistItem = useCallback(
    (productId) => {
      if (!isAuth) {
        setWishlistItems((current) =>
          current.filter(
            (item) =>
              String(item.productId) !== String(productId) &&
              String(item.id) !== String(productId)
          )
        );
        return;
      }
      wishlistApi
        .removeItem(productId)
        .then((res) => applyServerWishlist(res.data))
        .catch((error) => {
          toast(error?.message || "Could not remove this item");
        });
    },
    [isAuth, applyServerWishlist]
  );

  const clearWishlist = useCallback(() => {
    if (isAuth) {
      wishlistApi
        .clearWishlist()
        .then((res) => applyServerWishlist(res.data || { items: [] }))
        .catch(() => setWishlistItems([]));
    } else {
      setWishlistItems([]);
      writeGuestWishlist([]);
    }
  }, [isAuth, applyServerWishlist, writeGuestWishlist]);

  const isWishlisted = useCallback(
    (productId) =>
      wishlistItems.some(
        (item) =>
          String(item.productId) === String(productId) ||
          String(item.id) === String(productId)
      ),
    [wishlistItems]
  );

  const toggleWishlist = useCallback(
    async (product) => {
      const productId = product?.productId || product?.id || product?._id;
      if (!productId) return { ok: false, message: "Unknown product" };

      const already = isWishlisted(productId);

      if (isAuth) {
        const method = already ? wishlistApi.removeItem : wishlistApi.addItem;
        try {
          const res = await method(productId);
          applyServerWishlist(res.data);
          toast(already ? "Removed from your wishlist" : "Added to your wishlist");
          return { ok: true, added: !already, removed: already };
        } catch (error) {
          toast(error?.message || "Could not update wishlist");
          return { ok: false, message: error?.message };
        }
      }

      setWishlistItems((current) => {
        let next;
        if (
          current.some(
            (item) =>
              String(item.productId) === String(productId) ||
              String(item.id) === String(productId)
          )
        ) {
          next = current.filter(
            (item) =>
              String(item.productId) !== String(productId) &&
              String(item.id) !== String(productId)
          );
        } else {
          const nextItem = {
            ...guestWishlistEntryToProduct({
              productId,
              _snapshot: snapshotFromProduct(product),
            }),
            variants: product?.variants || [],
          };
          next = [...current, nextItem];
        }
        writeGuestWishlist(next);
        return next;
      });

      toast(already ? "Removed from your wishlist" : "Added to your wishlist");
      return { ok: true, added: !already, removed: already };
    },
    [isAuth, isWishlisted, applyServerWishlist, writeGuestWishlist]
  );

  const addWishlistItemToCart = useCallback(
    async (product, meta = {}) => {
      const productId = product?.productId || product?.id || product?._id;
      if (!productId) return { ok: false, message: "Unknown product" };

      let resolved = product;
      let variants = purchasableVariants(product);
      if (!product?.variants?.length) {
        try {
          const res = await productApi.getProduct(product.slug || productId);
          resolved = normalizeProduct(res.data) || product;
          variants = purchasableVariants(resolved);
        } catch {
          variants = [];
        }
      }

      if (variants.length === 0 && Array.isArray(resolved?.variants) && resolved.variants.length > 0) {
        variants = resolved.variants;
      }

      if (variants.length === 0) {
        toast("This item is sold out");
        return { ok: false, message: "Out of stock" };
      }

      const chosenVariant = variants[0];
      const result = await addProductToBag(resolved, {
        qty: 1,
        variantId: variantKey(chosenVariant),
        color: chosenVariant?.color || chosenVariant?.colorName || resolved?.color,
        size: chosenVariant?.size || resolved?.size,
        openDrawer: meta.openDrawer !== false,
      });

      if (result.ok && !result.needsOptions) {
        await Promise.resolve(removeWishlistItem(productId));
      }
      return result;
    },
    [addProductToBag, removeWishlistItem]
  );

  const moveAvailableToBag = useCallback(async () => {
    let count = 0;
    const itemsToMove = [...wishlistItems];
    for (const item of itemsToMove) {
      const result = await addWishlistItemToCart(item, { openDrawer: false });
      if (result.ok && !result.needsOptions) count += 1;
    }
    if (count > 0) {
      setIsCartOpen(true);
    }
    return count;
  }, [wishlistItems, addWishlistItemToCart, setIsCartOpen]);

  const placeOrder = useCallback((orderPayload) => {
    setCurrentOrder(orderPayload);
    writeStoredValue("novashop_current_order", orderPayload);
    setOrders((current) => {
      const next = [orderPayload, ...current];
      writeStoredValue("novashop_orders", next);
      return next;
    });
  }, []);

  const applyPromoCode = useCallback(async (code) => {
    if (!code || typeof code !== "string" || !code.trim()) {
      setAppliedPromo("");
      setPromoDiscount(0);
      setPromoMessage("");
      return { ok: false, message: "Please enter a promo code" };
    }

    const cleanCode = code.trim().toUpperCase();
    try {
      const res = await discountApi.validateDiscount({
        code: cleanCode,
        items,
        subtotal,
        shippingPrice: 0,
        customerEmail: user?.email || '',
      });

      const payload = res.data?.data || res.data;
      if (payload?.valid) {
        setAppliedPromo(cleanCode);
        setPromoDiscount(payload.discountAmount || 0);
        setPromoMessage(payload.message || `Code ${cleanCode} applied!`);
        return { ok: true, discountAmount: payload.discountAmount, discount: payload.discount };
      }

      setAppliedPromo("");
      setPromoDiscount(0);
      setPromoMessage(payload?.message || "Invalid discount code");
      return { ok: false, message: payload?.message || "Invalid discount code" };
    } catch (err) {
      const msg = err.response?.data?.message || err.message || "Invalid discount code";
      setAppliedPromo("");
      setPromoDiscount(0);
      setPromoMessage(msg);
      return { ok: false, message: msg };
    }
  }, [items, subtotal, user]);

  const removePromoCode = useCallback(() => {
    setAppliedPromo("");
    setPromoDiscount(0);
    setPromoMessage("");
  }, []);

  const resetCartState = useCallback(() => {
    setItems([]);
    setWishlistItems([]);
    setSavedItems([]);
    setOrders([]);
    setCurrentOrder(null);
    clearGuestStorage();
    removeStoredValue("novashop_current_order");
    currentUserIdRef.current = null;
    previousAuthRef.current = false;
    didMergeRef.current = false;
    setCartLoading(false);
  }, [clearGuestStorage]);

  useEffect(() => {
    if (isLoading) return;

    const nextUserId = user ? String(user._id) : null;
    const prevUserId = currentUserIdRef.current;

    if (!isAuthenticated || !user) {
      if (prevUserId || previousAuthRef.current) {
        resetCartState();
      }
      currentUserIdRef.current = null;
      previousAuthRef.current = false;
      didMergeRef.current = false;
      setCartLoading(false);
      return;
    }

    if (prevUserId && prevUserId !== nextUserId) {
      resetCartState();
    }

    currentUserIdRef.current = nextUserId;
    previousAuthRef.current = true;

    const bootstrap = async () => {
      if (!didMergeRef.current) {
        didMergeRef.current = true;
        await mergeGuest();
      }
      await Promise.all([refreshCart(), refreshWishlist()]);
    };

    bootstrap();
  }, [isAuthenticated, isLoading, user, mergeGuest, refreshCart, refreshWishlist, resetCartState]);

  useEffect(() => {
    window.addEventListener("novashop:auth-expired", resetCartState);
    return () => {
      window.removeEventListener("novashop:auth-expired", resetCartState);
    };
  }, [resetCartState]);

  useEffect(() => {
    setSavedItems(readStoredArray(savedKeyForUser(userIdentity), []));
  }, [userIdentity]);

  useEffect(() => {
    if (!isAuth) writeGuestCart(items);
  }, [items, isAuth, writeGuestCart]);

  useEffect(() => {
    if (!isAuth) writeGuestWishlist(wishlistItems);
  }, [wishlistItems, isAuth, writeGuestWishlist]);

  // Hydrate guest wishlist items from backend by IDs
  useEffect(() => {
    if (!isAuth) {
      try {
        const raw = localStorage.getItem("novashop-wishlist");
        if (raw) {
          const ids = JSON.parse(raw);
          if (Array.isArray(ids) && ids.length > 0) {
            productApi
              .getProductsByIds(ids)
              .then((res) => {
                if (res?.data && Array.isArray(res.data) && res.data.length > 0) {
                  setWishlistItems(res.data.map(normalizeProduct).filter(Boolean));
                }
              })
              .catch(() => {});
          }
        }
      } catch {
        // ignore
      }
    }
  }, [isAuth]);

  useEffect(() => {
    removeLegacyKeys();
  }, []);

  const value = useMemo(
    () => ({
      items,
      savedItems,
      subtotal,
      total,
      promoDiscount,
      hasCartIssues,
      cartLoading,
      addProductToBag,
      addItem: addProductToBag,
      removeItem,
      updateQuantity,
      clearCart,
      refreshCart,
      saveForLater,
      moveToBag,
      removeSavedItem,
      toggleWishlist,
      removeWishlistItem,
      clearWishlist,
      isWishlisted,
      addWishlistItemToCart,
      moveAvailableToBag,
      placeOrder,
      applyPromoCode,
      removePromoCode,
      orders,
      currentOrder,
      isAuth,
      userIdentity,
      formatCurrency,
      openCart: () => setIsCartOpen(true),
      closeCart: () => setIsCartOpen(false),
      openWishlist: () => setIsWishlistOpen(true),
      closeWishlist: () => setIsWishlistOpen(false),
      openSearch: () => setIsSearchOpen(true),
      closeSearch: () => setIsSearchOpen(false),
      isCartOpen,
      isWishlistOpen,
      isSearchOpen,
      appliedPromo,
      promoMessage,
      shipping: 0,
      wishlistItems,
      totalItems,
      distinctItemCount,
      wishlistCount,
    }),
    [
      items,
      savedItems,
      subtotal,
      total,
      hasCartIssues,
      cartLoading,
      addProductToBag,
      removeItem,
      updateQuantity,
      clearCart,
      refreshCart,
      saveForLater,
      moveToBag,
      removeSavedItem,
      toggleWishlist,
      removeWishlistItem,
      clearWishlist,
      isWishlisted,
      addWishlistItemToCart,
      moveAvailableToBag,
      placeOrder,
      applyPromoCode,
      removePromoCode,
      orders,
      currentOrder,
      isAuth,
      userIdentity,
      isCartOpen,
      isWishlistOpen,
      isSearchOpen,
      appliedPromo,
      promoMessage,
      wishlistItems,
      totalItems,
      distinctItemCount,
      wishlistCount,
    ]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
}

export function formatCurrency(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Number(value) || 0);
}

export { validPromoCodes };
