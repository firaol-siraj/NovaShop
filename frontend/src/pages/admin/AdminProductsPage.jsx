import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import adminApi from "../../lib/api/adminApi";
import { AdminIcon } from "../../components/admin/AdminLayout";
import AdminRowActionMenu from "../../components/admin/AdminRowActionMenu";
import { formatCurrency, formatRelativeTime } from "../../lib/formatters";

function ProductStatusPill({ status }) {
  const norm = String(status || "draft").toLowerCase();
  return (
    <span className={`products-status-pill ${norm}`}>
      <i />
      {norm.charAt(0).toUpperCase() + norm.slice(1)}
    </span>
  );
}

function InventoryState({ stock, threshold = 5 }) {
  const qty = Number(stock || 0);
  if (qty === 0) {
    return (
      <span className="products-inventory-state out">
        <i />
        Out of stock
      </span>
    );
  }
  if (qty <= threshold) {
    return (
      <span className="products-inventory-state low">
        <i />
        {qty} left
      </span>
    );
  }
  return (
    <span className="products-inventory-state in">
      <i />
      {qty} in stock
    </span>
  );
}

export default function AdminProductsPage({ go, search: searchProp }) {
  const [products, setProducts] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 10, totalPages: 1 });
  const [stats, setStats] = useState({
    totalProducts: 0,
    activeProducts: 0,
    lowStockProducts: 0,
    outOfStockProducts: 0,
    globalThreshold: 5,
  });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  // Filters & Search
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [category, setCategory] = useState(() => {
    try {
      const sp = new URLSearchParams(searchProp || window.location.search);
      return sp.get("category") || sp.get("categoryId") || "All categories";
    } catch {
      return "All categories";
    }
  });
  const [productFilter, setProductFilter] = useState(() => {
    try {
      const sp = new URLSearchParams(searchProp || window.location.search);
      return sp.get("product") || sp.get("productId") || "";
    } catch {
      return "";
    }
  });
  const [menuTarget, setMenuTarget] = useState(null);
  const [status, setStatus] = useState("all");
  const [stockFilter, setStockFilter] = useState("all");
  const [categoriesList, setCategoriesList] = useState([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Sync category and product filters when URL search params change
  useEffect(() => {
    try {
      const sp = new URLSearchParams(searchProp || window.location.search);
      const catParam = sp.get("category") || sp.get("categoryId") || "All categories";
      if (catParam !== category) {
        setCategory(catParam);
        setPage(1);
      }
      const prodParam = sp.get("product") || sp.get("productId") || "";
      if (prodParam !== productFilter) {
        setProductFilter(prodParam);
        setPage(1);
      }
    } catch {}
  }, [searchProp]);

  // Selection & Actions
  const [selectedIds, setSelectedIds] = useState([]);
  const [openMenu, setOpenMenu] = useState(null);
  const [toast, setToast] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const notify = (message) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2800);
  };

  // Debounce search
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 350);
    return () => clearTimeout(handler);
  }, [search]);

  // Load categories dropdown
  useEffect(() => {
    adminApi
      .getCategories()
      .then((res) => {
        const list = Array.isArray(res.data) ? res.data : Array.isArray(res) ? res : [];
        setCategoriesList(list);
        if (category && category !== "All categories") {
          const match = list.find(
            (c) => c._id === category || c.slug === category || (c.name && c.name.toLowerCase() === category.toLowerCase())
          );
          if (match && match._id !== category) {
            setCategory(match._id);
          }
        }
      })
      .catch(() => {});
  }, []);

  const activeCategoryName = useMemo(() => {
    if (!category || category === "All categories") return null;
    const match = categoriesList.find((c) => c._id === category || c.slug === category);
    return match ? match.name : category;
  }, [category, categoriesList]);

  const activeProductName = useMemo(() => {
    if (!productFilter) return null;
    const match = products.find((p) => p._id === productFilter);
    return match ? match.name : productFilter;
  }, [productFilter, products]);

  // Fetch products from backend
  const loadProducts = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const params = {
        page,
        limit: pageSize,
        search: debouncedSearch.trim() || undefined,
        category: category !== "All categories" ? category : undefined,
        product: productFilter || undefined,
        status: status !== "all" ? status : undefined,
        stockState: stockFilter !== "all" ? stockFilter : undefined,
        sortBy: "createdAt",
        sortOrder: "desc",
      };

      const res = await adminApi.getProducts(params);
      if (res.data) {
        setProducts(res.data);
        if (res.pagination) setPagination(res.pagination);
        if (res.stats) setStats(res.stats);
      }
    } catch (err) {
      setLoadError(err.response?.data?.message || err.message || "Unable to load products.");
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, debouncedSearch, category, productFilter, status, stockFilter]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  // Bulk Selection
  const allVisibleSelected =
    products.length > 0 && products.every((product) => selectedIds.includes(product._id));

  const toggleProduct = (id) => {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    );
  };

  const toggleVisible = () => {
    setSelectedIds((current) =>
      allVisibleSelected
        ? current.filter((id) => !products.some((product) => product._id === id))
        : [...new Set([...current, ...products.map((product) => product._id)])]
    );
  };

  // Bulk Status Update
  const handleBulkStatus = async (newStatus) => {
    if (!selectedIds.length) return;
    setActionLoading(true);
    try {
      await adminApi.bulkUpdateProductStatus(selectedIds, newStatus);
      notify(`Updated ${selectedIds.length} product(s) to ${newStatus}.`);
      setSelectedIds([]);
      await loadProducts();
    } catch (err) {
      notify(err.response?.data?.message || err.message || "Failed to update products.");
    } finally {
      setActionLoading(false);
    }
  };

  // Row actions
  const handleMenuAction = async (action, product) => {
    setOpenMenu(null);

    if (action === "Edit product") {
      go(`/admin/products/${product._id}/edit`);
    } else if (action === "View product") {
      go(`/admin/products/${product._id}`);
    } else if (action === "Duplicate") {
      setActionLoading(true);
      try {
        const res = await adminApi.duplicateProduct(product._id);
        notify(`Duplicated as "${res.data?.name || "Product (Copy)"}".`);
        await loadProducts();
      } catch (err) {
        notify(err.response?.data?.message || err.message || "Failed to duplicate product.");
      } finally {
        setActionLoading(false);
      }
    } else if (action === "Archive" || action === "Restore") {
      const nextStatus = action === "Archive" ? "archived" : "active";
      try {
        await adminApi.updateProductStatus(product._id, nextStatus);
        notify(`Product ${action === "Archive" ? "archived" : "restored"}.`);
        await loadProducts();
      } catch (err) {
        notify(err.response?.data?.message || err.message || "Failed to update product status.");
      }
    } else if (action === "Delete") {
      if (!window.confirm(`Delete "${product.name}"? If it has order history, it will be safely archived instead.`)) {
        return;
      }
      try {
        const res = await adminApi.deleteProduct(product._id);
        notify(res.message || "Product removed.");
        setSelectedIds((curr) => curr.filter((id) => id !== product._id));
        await loadProducts();
      } catch (err) {
        notify(err.response?.data?.message || err.message || "Failed to delete product.");
      }
    } else if (action === "View in store") {
      window.open(`/product/${product.slug || product._id}`, "_blank");
    }
  };

  // Export CSV
  const exportProducts = () => {
    const rows = [
      ["Product Name", "SKU", "Category", "Base Price", "On Hand Stock", "Units Sold", "Status", "Created At"],
      ...products.map((p) => {
        const variants = p.variants || [];
        const sku = variants[0]?.sku || p.slug || "—";
        const cat = p.category?.name || "Uncategorized";
        return [
          p.name,
          sku,
          cat,
          p.price,
          p.countInStock,
          p.unitsSold || 0,
          p.status,
          new Date(p.createdAt).toISOString().split("T")[0],
        ];
      }),
    ];

    const csv = rows
      .map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(","))
      .join("\n");

    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "novashop-products.csv";
    anchor.click();
    URL.revokeObjectURL(url);
    notify("Products exported.");
  };

  const clearFilters = () => {
    setSearch("");
    setCategory("All categories");
    setStatus("all");
    setStockFilter("all");
    setPage(1);
  };

  return (
    <div className="admin-dashboard products-page">
      {/* Page Heading */}
      <section className="admin-page-heading products-page-heading">
        <div>
          <h1 className="admin-page-title">Products</h1>
          <p className="admin-page-description">
            Authoritative catalog, variant matrices, and live inventory.
          </p>
        </div>
        <div className="admin-page-actions">
          <button className="admin-action-button" type="button" onClick={exportProducts}>
            <AdminIcon name="download" size={15} /> Export
          </button>
          <button
            className="admin-action-button is-primary"
            type="button"
            onClick={() => go("/admin/products/new")}
          >
            <AdminIcon name="plus" size={15} /> Add Product
          </button>
        </div>
      </section>

      {/* KPI Stats */}
      <section className="admin-stat-grid products-stat-grid" aria-label="Catalog summary">
        <article className="admin-stat-card">
          <div className="admin-stat-heading">
            <span className="admin-stat-label">Total products</span>
          </div>
          <div className="admin-stat-value">{stats.totalProducts}</div>
        </article>
        <article className="admin-stat-card">
          <div className="admin-stat-heading">
            <span className="admin-stat-label">Active products</span>
          </div>
          <div className="admin-stat-value">{stats.activeProducts}</div>
        </article>
        <article className="admin-stat-card">
          <div className="admin-stat-heading">
            <span className="admin-stat-label">Low stock</span>
          </div>
          <div className="admin-stat-value">{stats.lowStockProducts}</div>
        </article>
        <article className="admin-stat-card">
          <div className="admin-stat-heading">
            <span className="admin-stat-label">Out of stock</span>
          </div>
          <div className="admin-stat-value">{stats.outOfStockProducts}</div>
        </article>
      </section>

      {/* Toolbar & Filters */}
      <section className="products-catalog-toolbar" aria-label="Catalog filters">
        <div className="products-filter-row">
          <label className="products-search-field">
            <AdminIcon name="search" size={16} />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by product name, brand, or SKU…"
              aria-label="Search products"
            />
          </label>
          <select
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              setPage(1);
            }}
            aria-label="Filter by category"
          >
            <option>All categories</option>
            {categoriesList.map((cat) => (
              <option key={cat._id} value={cat._id}>
                {cat.name}
              </option>
            ))}
          </select>
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            aria-label="Filter by status"
          >
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="draft">Draft</option>
            <option value="archived">Archived</option>
          </select>
        </div>

        {activeCategoryName && (
          <div className="products-active-chips" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '2px 0' }}>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 10px',
              borderRadius: '99px',
              fontSize: '11px',
              fontWeight: 600,
              background: 'var(--bg-surface-raised)',
              border: '1px solid var(--border-default)',
              color: 'var(--text-primary)',
            }}>
              <span>Category: <strong>{activeCategoryName}</strong></span>
              <button
                type="button"
                style={{
                  background: 'transparent',
                  border: 0,
                  cursor: 'pointer',
                  color: 'var(--text-muted)',
                  fontWeight: 'bold',
                  padding: '0 2px',
                  fontSize: '12px',
                  display: 'inline-flex',
                  alignItems: 'center',
                }}
                onClick={() => {
                  setCategory("All categories");
                  setPage(1);
                  if (go) go("/admin/products");
                }}
                aria-label="Clear category filter"
              >
                ✕
              </button>
            </span>
          </div>
        )}

        {productFilter && (
          <div className="products-active-chips" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '2px 0' }}>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 10px',
              borderRadius: '99px',
              fontSize: '11px',
              fontWeight: 600,
              background: 'var(--bg-surface-raised)',
              border: '1px solid var(--border-default)',
              color: 'var(--text-primary)',
            }}>
              <span>Product: <strong>{activeProductName}</strong></span>
              <button
                type="button"
                style={{
                  background: 'transparent',
                  border: 0,
                  cursor: 'pointer',
                  color: 'var(--text-muted)',
                  fontWeight: 'bold',
                  padding: '0 2px',
                  fontSize: '12px',
                  display: 'inline-flex',
                  alignItems: 'center',
                }}
                onClick={() => {
                  setProductFilter("");
                  setPage(1);
                  if (go) go("/admin/products");
                }}
                aria-label="Clear product filter"
              >
                ✕
              </button>
            </span>
          </div>
        )}

        <div className="products-quick-filters" role="group" aria-label="Inventory filters">
          {[
            { label: "All", value: "all" },
            { label: "In stock", value: "in_stock" },
            { label: "Low stock", value: "low_stock" },
            { label: "Out of stock", value: "out_of_stock" },
          ].map((item) => (
            <button
              key={item.value}
              type="button"
              className={`products-quick-filter${stockFilter === item.value ? " is-active" : ""}`}
              onClick={() => {
                setStockFilter(item.value);
                setPage(1);
              }}
              aria-pressed={stockFilter === item.value}
            >
              {item.value !== "all" && (
                <i
                  className={`products-filter-dot ${
                    item.value === "low_stock" ? "low" : item.value === "out_of_stock" ? "out" : "in"
                  }`}
                />
              )}
              {item.label}
            </button>
          ))}
        </div>
      </section>

      {/* Error / Loading State */}
      {loadError && (
        <div className="p-4 mb-4 text-xs font-semibold text-[var(--color-danger)] bg-[var(--color-danger-soft)] border border-[var(--border-default)] rounded-lg flex items-center justify-between">
          <span>{loadError}</span>
          <button type="button" className="underline font-bold" onClick={loadProducts}>
            Retry
          </button>
        </div>
      )}

      {/* Products Table Card */}
      <section className="products-table-card" aria-label="Product catalog">
        <div className="products-table-scroll">
          <table className="products-table">
            <thead>
              <tr>
                <th className="products-checkbox-cell">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={toggleVisible}
                    aria-label="Select all visible products"
                  />
                </th>
                <th>PRODUCT</th>
                <th>PRICE</th>
                <th>INVENTORY</th>
                <th>VARIANTS</th>
                <th>PAID SALES</th>
                <th>STATUS</th>
                <th>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="8" className="py-16 text-center text-xs text-[var(--text-muted)]">
                    Loading products from database…
                  </td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan="8" className="products-empty-state">
                    <AdminIcon name="searchSlash" size={24} />
                    <strong>No products match your criteria.</strong>
                    <button type="button" onClick={clearFilters}>
                      Reset filters
                    </button>
                  </td>
                </tr>
              ) : (
                products.map((product) => {
                  const variants = product.variants || [];
                  const primarySku = variants[0]?.sku || product.slug || "—";
                  const primaryImg = product.image || (product.images && product.images[0]) || "";
                  const categoryName = product.category?.name || "Uncategorized";

                  return (
                    <tr key={product._id}>
                      <td className="products-checkbox-cell">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(product._id)}
                          onChange={() => toggleProduct(product._id)}
                          aria-label={`Select ${product.name}`}
                        />
                      </td>
                      <td className="products-product-cell">
                        <div className="products-product-info">
                          {primaryImg ? (
                            <img src={primaryImg} alt={product.name} />
                          ) : (
                            <span className="products-img-placeholder" aria-hidden="true" />
                          )}
                          <div>
                            <button
                              className="pd-product-open-link text-left"
                              type="button"
                              onClick={() => go(`/admin/products/${product._id}`)}
                            >
                              {product.name}
                            </button>
                            <span className="text-[var(--text-muted)]">{categoryName}</span>
                            <span className="text-[10px] text-[var(--text-subtle)] block font-mono">
                              SKU: {primarySku}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="products-price-cell">{formatCurrency(product.price)}</td>
                      <td>
                        <InventoryState
                          stock={product.countInStock}
                          threshold={stats.globalThreshold}
                        />
                      </td>
                      <td>
                        <div className="products-variants">
                          <span className="text-xs font-semibold text-[var(--text-secondary)]">
                            {variants.length} variant{variants.length === 1 ? "" : "s"}
                          </span>
                        </div>
                      </td>
                      <td>
                        <span className="text-xs font-bold text-[var(--text-primary)]">
                          {product.unitsSold || 0} unit{(product.unitsSold || 0) === 1 ? "" : "s"}
                        </span>
                      </td>
                      <td>
                        <ProductStatusPill status={product.status} />
                      </td>
                      <td className="products-row-action-cell relative">
                        <button
                          className="admin-icon-button"
                          type="button"
                          aria-label="Product options"
                          onClick={(e) => {
                            e.stopPropagation();
                            const btn = e.currentTarget;
                            setMenuTarget({ product, triggerRef: { current: btn } });
                          }}
                        >
                          <AdminIcon name="more" size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Universal Portal Row Action Menu */}
        <AdminRowActionMenu
          isOpen={Boolean(menuTarget)}
          onClose={() => setMenuTarget(null)}
          triggerRef={menuTarget?.triggerRef}
          header={{
            title: menuTarget?.product?.name,
            subtitle: `SKU: ${menuTarget?.product?.variants?.[0]?.sku || menuTarget?.product?.slug || '—'} · Stock: ${menuTarget?.product?.countInStock ?? 0}`,
          }}
          items={[
            {
              id: 'view',
              label: 'View details',
              icon: 'eye',
              onClick: () => handleMenuAction("View product", menuTarget.product),
            },
            {
              id: 'edit',
              label: 'Edit product',
              icon: 'edit',
              onClick: () => handleMenuAction("Edit product", menuTarget.product),
            },
            {
              id: 'duplicate',
              label: 'Duplicate product',
              icon: 'copy',
              onClick: () => handleMenuAction("Duplicate", menuTarget.product),
            },
            {
              id: 'store',
              label: 'View in store',
              icon: 'external',
              onClick: () => handleMenuAction("View in store", menuTarget.product),
            },
            {
              id: 'divider',
              isDivider: true,
            },
            {
              id: 'archive',
              label: menuTarget?.product?.status === 'archived' ? 'Restore to Active' : 'Archive product',
              icon: menuTarget?.product?.status === 'archived' ? 'check' : 'stop',
              onClick: () => handleMenuAction(menuTarget?.product?.status === 'archived' ? 'Restore' : 'Archive', menuTarget.product),
            },
            {
              id: 'delete',
              label: 'Delete product',
              icon: 'trash',
              danger: true,
              onClick: () => handleMenuAction("Delete", menuTarget.product),
            },
          ]}
        />

        {/* Server-Side Pagination */}
        <div className="products-pagination">
          <span>
            Showing {products.length === 0 ? 0 : (pagination.page - 1) * pagination.limit + 1}–
            {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}{" "}
            products
          </span>
          <div className="products-pagination-controls">
            <label>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
                aria-label="Products per page"
              >
                <option value="10">10 per page</option>
                <option value="25">25 per page</option>
                <option value="50">50 per page</option>
              </select>
              <AdminIcon name="chevron" size={12} />
            </label>
            <button
              type="button"
              disabled={pagination.page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              aria-label="Previous page"
            >
              Previous
            </button>
            <span className="px-3 text-xs font-bold text-[var(--text-primary)]">
              {pagination.page} / {pagination.totalPages}
            </span>
            <button
              type="button"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => setPage((p) => p + 1)}
              aria-label="Next page"
            >
              Next
            </button>
          </div>
        </div>
      </section>

      {/* Bulk Action Bar */}
      {selectedIds.length > 0 && (
        <div className="products-bulk-bar">
          <strong>{selectedIds.length} selected</strong>
          <button
            type="button"
            disabled={actionLoading}
            onClick={() => handleBulkStatus("active")}
          >
            Set Active
          </button>
          <button
            type="button"
            disabled={actionLoading}
            onClick={() => handleBulkStatus("draft")}
          >
            Set Draft
          </button>
          <button
            type="button"
            disabled={actionLoading}
            onClick={() => handleBulkStatus("archived")}
          >
            Set Archived
          </button>
          <button
            type="button"
            className="is-secondary"
            onClick={() => setSelectedIds([])}
          >
            Clear selection
          </button>
        </div>
      )}

      {/* Floating Toast Notification */}
      {toast && (
        <div className="admin-toast" role="status">
          {toast}
        </div>
      )}
    </div>
  );
}
