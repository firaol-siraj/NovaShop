import { useCallback, useEffect, useMemo, useState } from "react";
import { productApi } from "../../lib/api/productApi";
import { AdminIcon } from "../../components/admin/AdminLayout";

const toAdminProduct = (product) => {
  const variants = Array.isArray(product.variants) ? product.variants : [];
  const categoryName = product.category?.name || "Uncategorized";
  const colors = [
    ...new Set(variants.map((variant) => variant.color?.hex).filter(Boolean)),
  ];
  const status = String(product.status || "draft");
  return {
    id: String(product._id),
    slug: product.slug,
    name: product.name,
    sku: variants[0]?.sku || product.slug || "—",
    category: categoryName,
    collection: categoryName,
    price: Number(product.price) || 0,
    stock: Number(product.countInStock) || 0,
    variants: variants.length,
    colors: colors.length ? colors : ["#B8AA98"],
    status: status.charAt(0).toUpperCase() + status.slice(1),
    image: product.image || (product.images && product.images[0]) || "",
  };
};

const formatPrice = (price) =>
  `$${Number(price).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function ProductStatus({ status }) {
  return (
    <span className={`products-status-pill ${status.toLowerCase()}`}>
      <i />
      {status}
    </span>
  );
}

function InventoryState({ stock }) {
  if (stock === 0)
    return (
      <span className="products-inventory-state out">
        <i />
        Out of stock
      </span>
    );
  if (stock <= 15)
    return (
      <span className="products-inventory-state low">
        <i />
        {stock} left
      </span>
    );
  return (
    <span className="products-inventory-state in">
      <i />
      {stock} in stock
    </span>
  );
}

function ProductModal({ product, onClose, onSave }) {
  const [name, setName] = useState(product?.name || "");
  const [sku, setSku] = useState(product?.sku || "");
  const [price, setPrice] = useState(product?.price || "");
  const [stock, setStock] = useState(product?.stock ?? "");
  const [category, setCategory] = useState(product?.category || "Outerwear");

  const submit = (event) => {
    event.preventDefault();
    onSave({
      ...product,
      name: name.trim(),
      sku: sku.trim(),
      price: Number(price),
      stock: Number(stock),
      category,
    });
  };

  return (
    <div
      className="admin-modal-backdrop"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section
        className="admin-order-modal products-edit-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="products-modal-title"
      >
        <div className="admin-modal-heading">
          <div>
            <span className="admin-modal-eyebrow">Catalog</span>
            <h2 id="products-modal-title">
              {product ? "Edit product" : "Add product"}
            </h2>
          </div>
          <button
            className="admin-icon-button"
            type="button"
            onClick={onClose}
            aria-label="Close product editor"
          >
            <AdminIcon name="close" />
          </button>
        </div>
        <form onSubmit={submit}>
          <label>
            Product name
            <input
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Product name"
            />
          </label>
          <label>
            SKU
            <input
              required
              value={sku}
              onChange={(event) => setSku(event.target.value)}
              placeholder="NS-XX-0000"
            />
          </label>
          <div className="products-form-grid">
            <label>
              Price
              <input
                required
                type="number"
                min="0"
                step="0.01"
                value={price}
                onChange={(event) => setPrice(event.target.value)}
              />
            </label>
            <label>
              Inventory
              <input
                required
                type="number"
                min="0"
                value={stock}
                onChange={(event) => setStock(event.target.value)}
              />
            </label>
          </div>
          <label>
            Category
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value)}
            >
              {[
                "Outerwear",
                "Dresses",
                "Accessories",
                "Knitwear",
                "Tailoring",
                "Footwear",
              ].map((option) => (
                <option key={option}>{option}</option>
              ))}
            </select>
          </label>
          <button className="admin-action-button is-primary" type="submit">
            <AdminIcon name="check" size={14} /> Save Product
          </button>
        </form>
      </section>
    </div>
  );
}

export default function AdminProductsPage({ go }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All categories");
  const [collection, setCollection] = useState("All collections");
  const [status, setStatus] = useState("All statuses");
  const [stockFilter, setStockFilter] = useState("All");
  const [selectedIds, setSelectedIds] = useState([]);
  const [openMenu, setOpenMenu] = useState(null);
  const [editingProduct, setEditingProduct] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [toast, setToast] = useState("");
  const [pageSize, setPageSize] = useState("10");
  const [collectionMenu, setCollectionMenu] = useState(false);

  const notify = (message) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2300);
  };

  const loadProducts = useCallback(async () => {
    try {
      const response = await productApi.getAdminProducts({ pageSize: 200 });
      setProducts(
        (Array.isArray(response?.data) ? response.data : []).map(
          toAdminProduct,
        ),
      );
      setLoadError("");
    } catch (requestError) {
      setLoadError(requestError.message || "Unable to load products.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    productApi
      .getAdminProducts({ pageSize: 200 })
      .then((response) => {
        if (cancelled) return;
        setProducts(
          (Array.isArray(response?.data) ? response.data : []).map(
            toAdminProduct,
          ),
        );
        setLoadError("");
      })
      .catch((requestError) => {
        if (!cancelled)
          setLoadError(requestError.message || "Unable to load products.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const categoryOptions = useMemo(
    () => [...new Set(products.map((product) => product.category))],
    [products],
  );

  const filteredProducts = useMemo(
    () =>
      products.filter((product) => {
        const query = search.trim().toLowerCase();
        const matchesSearch =
          !query ||
          `${product.name} ${product.sku}`.toLowerCase().includes(query);
        const matchesCategory =
          category === "All categories" || product.category === category;
        const matchesCollection =
          collection === "All collections" || product.collection === collection;
        const matchesStatus =
          status === "All statuses" || product.status === status;
        const matchesStock =
          stockFilter === "All" ||
          (stockFilter === "In stock" && product.stock > 15) ||
          (stockFilter === "Low stock" &&
            product.stock > 0 &&
            product.stock <= 15) ||
          (stockFilter === "Out of stock" && product.stock === 0);
        return (
          matchesSearch &&
          matchesCategory &&
          matchesCollection &&
          matchesStatus &&
          matchesStock
        );
      }),
    [category, collection, products, search, status, stockFilter],
  );

  const allVisibleSelected =
    filteredProducts.length > 0 &&
    filteredProducts.every((product) => selectedIds.includes(product.id));
  const toggleProduct = (id) =>
    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter((selectedId) => selectedId !== id)
        : [...current, id],
    );
  const toggleVisible = () =>
    setSelectedIds((current) =>
      allVisibleSelected
        ? current.filter(
            (id) => !filteredProducts.some((product) => product.id === id),
          )
        : [
            ...new Set([
              ...current,
              ...filteredProducts.map((product) => product.id),
            ]),
          ],
    );
  const updateSelected = async (updates) => {
    const payload = {};
    if (updates.status) payload.status = updates.status.toLowerCase();
    if (!Object.keys(payload).length) {
      notify("That bulk change is not supported yet.");
      return;
    }
    try {
      await Promise.all(
        selectedIds.map((id) => productApi.updateProduct(id, payload)),
      );
      notify("Selected products updated.");
    } catch (requestError) {
      notify(requestError.message || "Unable to update products.");
    }
    await loadProducts();
  };
  const deleteProducts = async (ids) => {
    if (
      !window.confirm(
        `Delete ${ids.length} product${ids.length === 1 ? "" : "s"}? This cannot be undone.`,
      )
    )
      return;
    let failure = "";
    for (const id of ids) {
      try {
        await productApi.deleteProduct(id);
      } catch (requestError) {
        failure = requestError.message || "Unable to delete product.";
      }
    }
    setSelectedIds((current) => current.filter((id) => !ids.includes(id)));
    notify(failure || "Product removed from the catalog.");
    await loadProducts();
  };

  const saveProduct = async (productData) => {
    if (!productData.id) return;
    try {
      await productApi.updateProduct(productData.id, {
        name: productData.name,
        price: productData.price,
        countInStock: productData.stock,
      });
      setEditingProduct(null);
      notify("Product changes saved.");
      await loadProducts();
    } catch (requestError) {
      notify(requestError.message || "Unable to save product.");
    }
  };

  const exportProducts = () => {
    const rows = [
      [
        "Product",
        "SKU",
        "Category",
        "Collection",
        "Price",
        "Inventory",
        "Status",
      ],
      ...filteredProducts.map((product) => [
        product.name,
        product.sku,
        product.category,
        product.collection,
        formatPrice(product.price),
        product.stock,
        product.status,
      ]),
    ];
    const csv = rows
      .map((row) =>
        row
          .map((value) => `"${String(value).replaceAll('"', '""')}"`)
          .join(","),
      )
      .join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "novashop-product-catalog.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const handleMenuAction = async (action, product) => {
    setOpenMenu(null);
    if (action === "Edit product") setEditingProduct(product);
    else if (action === "Duplicate")
      notify("Duplicating products is not supported yet.");
    else if (action === "Archive") {
      try {
        await productApi.updateProduct(product.id, { status: "archived" });
        notify("Product archived.");
      } catch (requestError) {
        notify(requestError.message || "Unable to archive product.");
      }
      await loadProducts();
    } else if (action === "Delete") await deleteProducts([product.id]);
    else go(`/product/${product.id}`);
  };

  const clearFilters = () => {
    setSearch("");
    setCategory("All categories");
    setCollection("All collections");
    setStatus("All statuses");
    setStockFilter("All");
  };

  return (
    <div className="admin-dashboard products-page">
      <section className="admin-page-heading products-page-heading">
        <div>
          <h1 className="admin-page-title">Products</h1>
          <p className="admin-page-description">
            Manage your catalog, pricing, and inventory.
          </p>
        </div>
        <div className="admin-page-actions">
          <button
            className="admin-action-button"
            type="button"
            onClick={exportProducts}
          >
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

      <section
        className="admin-stat-grid products-stat-grid"
        aria-label="Catalog summary"
      >
        <article className="admin-stat-card">
          <div className="admin-stat-heading">
            <span className="admin-stat-label">Total products</span>
          </div>
          <div className="admin-stat-value">{products.length}</div>
        </article>
        <article className="admin-stat-card">
          <div className="admin-stat-heading">
            <span className="admin-stat-label">Active products</span>
          </div>
          <div className="admin-stat-value">
            {products.filter((product) => product.status === "Active").length}
          </div>
        </article>
        <article className="admin-stat-card">
          <div className="admin-stat-heading">
            <span className="admin-stat-label">Low stock</span>
          </div>
          <div className="admin-stat-value">
            {
              products.filter(
                (product) => product.stock > 0 && product.stock <= 15,
              ).length
            }
          </div>
        </article>
        <article className="admin-stat-card">
          <div className="admin-stat-heading">
            <span className="admin-stat-label">Out of stock</span>
          </div>
          <div className="admin-stat-value">
            {products.filter((product) => product.stock === 0).length}
          </div>
        </article>
      </section>

      {loading && (
        <p className="products-empty-state" role="status">
          Loading products…
        </p>
      )}
      {loadError && (
        <p className="products-empty-state" role="alert">
          {loadError}{" "}
          <button
            type="button"
            onClick={() => {
              setLoading(true);
              void loadProducts();
            }}
          >
            Retry
          </button>
        </p>
      )}

      <section
        className="products-catalog-toolbar"
        aria-label="Catalog filters"
      >
        <div className="products-filter-row">
          <label className="products-search-field">
            <AdminIcon name="search" size={16} />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by product name or SKU"
              aria-label="Search by product name or SKU"
            />
          </label>
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            aria-label="Filter by category"
          >
            <option>All categories</option>
            {categoryOptions.map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>
          <select
            value={collection}
            onChange={(event) => setCollection(event.target.value)}
            aria-label="Filter by collection"
          >
            <option>All collections</option>
            {[...new Set(products.map((product) => product.collection))].map(
              (option) => (
                <option key={option}>{option}</option>
              ),
            )}
          </select>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            aria-label="Filter by status"
          >
            <option>All statuses</option>
            <option>Active</option>
            <option>Draft</option>
            <option>Archived</option>
          </select>
        </div>
        <div
          className="products-quick-filters"
          role="group"
          aria-label="Inventory filters"
        >
          {["All", "In stock", "Low stock", "Out of stock"].map((filter) => (
            <button
              key={filter}
              type="button"
              className={`products-quick-filter${stockFilter === filter ? " is-active" : ""}`}
              onClick={() => setStockFilter(filter)}
              aria-pressed={stockFilter === filter}
            >
              {filter !== "All" && (
                <i
                  className={`products-filter-dot ${filter === "Low stock" ? "low" : filter === "Out of stock" ? "out" : "in"}`}
                />
              )}
              {filter}
            </button>
          ))}
        </div>
      </section>

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
                <th>STATUS</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map((product) => (
                <tr key={product.id}>
                  <td className="products-checkbox-cell">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(product.id)}
                      onChange={() => toggleProduct(product.id)}
                      aria-label={`Select ${product.name}`}
                    />
                  </td>
                  <td className="products-product-cell">
                    <div className="products-product-info">
                      {product.image ? (
                        <img src={product.image} alt="" />
                      ) : (
                        <span
                          className="products-img-placeholder"
                          aria-hidden="true"
                        />
                      )}
                      <div>
                        {product.id === "p1" ? (
                          <button
                            className="pd-product-open-link"
                            type="button"
                            onClick={() =>
                              go("/admin/products/cashmere-overcoat")
                            }
                          >
                            {product.name}
                          </button>
                        ) : (
                          <strong>{product.name}</strong>
                        )}
                        <span>{product.category}</span>
                        <button
                          className="products-sku-trigger"
                          type="button"
                          aria-label={`SKU ${product.sku}`}
                          title={`SKU: ${product.sku} · Updated 2 days ago`}
                        >
                          {product.sku}
                          <span>SKU: {product.sku} · Updated 2 days ago</span>
                        </button>
                      </div>
                    </div>
                  </td>
                  <td className="products-price-cell">
                    {formatPrice(product.price)}
                  </td>
                  <td>
                    <InventoryState stock={product.stock} />
                  </td>
                  <td>
                    <div className="products-variants">
                      <span className="products-swatch-stack">
                        {product.colors.slice(0, 3).map((color, index) => (
                          <i
                            key={color}
                            style={{ background: color, zIndex: 3 - index }}
                          />
                        ))}
                      </span>
                      <span>{product.variants} variants</span>
                      {product.variants > 3 && (
                        <small>+{product.variants - 3}</small>
                      )}
                    </div>
                  </td>
                  <td>
                    <ProductStatus status={product.status} />
                  </td>
                  <td className="products-actions-cell">
                    <div className="products-menu-anchor">
                      <button
                        className="products-row-menu-button"
                        type="button"
                        aria-label={`More actions for ${product.name}`}
                        aria-expanded={openMenu === product.id}
                        onClick={() =>
                          setOpenMenu((current) =>
                            current === product.id ? null : product.id,
                          )
                        }
                      >
                        <AdminIcon name="more" size={16} />
                      </button>
                      {openMenu === product.id && (
                        <div className="products-row-menu">
                          {[
                            "Edit product",
                            "Duplicate",
                            "View in store",
                            "Archive",
                            "Delete",
                          ].map((action) => (
                            <button
                              key={action}
                              className={action === "Delete" ? "is-danger" : ""}
                              type="button"
                              onClick={() => handleMenuAction(action, product)}
                            >
                              {action}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filteredProducts.length === 0 && (
                <tr>
                  <td colSpan="7" className="products-empty-state">
                    <AdminIcon name="searchSlash" size={20} />
                    <strong>
                      {products.length === 0 && !loading
                        ? "No products yet. Click Add Product to create one."
                        : "No products match these filters."}
                    </strong>
                    <button type="button" onClick={clearFilters}>
                      Reset filters
                    </button>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="products-pagination">
          <span>
            Showing {filteredProducts.length === 0 ? 0 : 1}–
            {Math.min(Number(pageSize), filteredProducts.length)} of{" "}
            {filteredProducts.length} products
          </span>
          <div className="products-pagination-controls">
            <label>
              <select
                value={pageSize}
                onChange={(event) => setPageSize(event.target.value)}
                aria-label="Products per page"
              >
                <option value="10">10 per page</option>
                <option value="25">25 per page</option>
                <option value="50">50 per page</option>
              </select>
              <AdminIcon name="chevron" size={12} />
            </label>
            <button type="button" disabled aria-label="Previous page">
              Previous
            </button>
            <button type="button" className="is-active">
              1
            </button>
            <button type="button" disabled>
              Next
            </button>
          </div>
        </div>
      </section>

      {selectedIds.length > 0 && (
        <div className="products-bulk-bar">
          <strong>{selectedIds.length} selected</strong>
          <button
            type="button"
            onClick={() => updateSelected({ status: "Active" })}
          >
            <AdminIcon name="check" size={14} /> Set as Active
          </button>
          <button
            type="button"
            onClick={() => updateSelected({ status: "Draft" })}
          >
            <AdminIcon name="document" size={14} /> Set as Draft
          </button>
          <div className="products-bulk-collection">
            <button
              type="button"
              onClick={() => setCollectionMenu((open) => !open)}
            >
              <AdminIcon name="categories" size={14} /> Add to collection
            </button>
            {collectionMenu && (
              <div>
                <button
                  type="button"
                  onClick={() => {
                    setCollectionMenu(false);
                    notify("Collections are not supported by the backend yet.");
                  }}
                >
                  Autumn 2026
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCollectionMenu(false);
                    notify("Collections are not supported by the backend yet.");
                  }}
                >
                  Core Collection
                </button>
              </div>
            )}
          </div>
          <i className="products-bulk-divider" />
          <button
            className="products-bulk-delete"
            type="button"
            onClick={() => deleteProducts(selectedIds)}
          >
            <AdminIcon name="warning" size={14} /> Delete
          </button>
          <button
            className="products-bulk-clear"
            type="button"
            onClick={() => setSelectedIds([])}
            aria-label="Clear selection"
          >
            <AdminIcon name="close" size={16} />
          </button>
        </div>
      )}

      {(createOpen || editingProduct) && (
        <ProductModal
          product={editingProduct}
          onClose={() => {
            setCreateOpen(false);
            setEditingProduct(null);
          }}
          onSave={saveProduct}
        />
      )}
      {toast && (
        <div className="admin-toast" role="status">
          {toast}
        </div>
      )}
    </div>
  );
}
