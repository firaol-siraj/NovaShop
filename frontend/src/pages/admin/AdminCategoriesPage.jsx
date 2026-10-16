import { useCallback, useEffect, useMemo, useState } from "react";
import { categoryApi } from "../../lib/api/categoryApi";
import { AdminIcon } from "../../components/admin/AdminLayout";
import { parseCategoryList, toCategoryPayload } from "./categoryAdapter";
import "./admin-categories.css";

const formatCsv = (rows) =>
  rows
    .map((row) =>
      row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(","),
    )
    .join("\n");

function CategoryStatus({ status }) {
  if (!status) return <span className="cat-neutral-status">—</span>;
  return (
    <span className={`cat-status-pill ${status.toLowerCase()}`}>
      <i />
      {status}
    </span>
  );
}

function CategoryModal({ category, parentId, categories, onClose, onSave }) {
  const [name, setName] = useState(category?.name || "");
  const [parent, setParent] = useState(category?.parentId || parentId || "");
  const [status, setStatus] = useState(category?.status || "Active");
  const [error, setError] = useState("");
  const submit = (event) => {
    event.preventDefault();
    if (!name.trim()) {
      setError("Enter a category name.");
      return;
    }
    onSave({
      ...category,
      name: name.trim(),
      parentId: parent || undefined,
      status,
    });
  };
  return (
    <div
      className="admin-modal-backdrop"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section
        className="admin-order-modal cat-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cat-modal-title"
      >
        <header className="admin-modal-heading">
          <div>
            <span className="admin-modal-eyebrow">Product catalog</span>
            <h2 id="cat-modal-title">
              {category
                ? "Edit category"
                : parent
                  ? "Add subcategory"
                  : "Add category"}
            </h2>
          </div>
          <button
            className="admin-icon-button"
            type="button"
            aria-label="Close category editor"
            onClick={onClose}
          >
            <AdminIcon name="close" />
          </button>
        </header>
        <form onSubmit={submit}>
          <label>
            Category name
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Outerwear"
              autoFocus
            />
          </label>
          <label>
            Parent category
            <select
              value={parent}
              onChange={(event) => setParent(event.target.value)}
            >
              <option value="">No parent category</option>
              {categories
                .filter((item) => !item.parentId && item.id !== category?.id)
                .map((item) => (
                  <option value={item.id} key={item.id}>
                    {item.name}
                  </option>
                ))}
            </select>
          </label>
          <label>
            Status
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              <option>Active</option>
              <option>Hidden</option>
            </select>
          </label>
          {error && <span className="cat-form-error">{error}</span>}
          <button className="admin-action-button is-primary" type="submit">
            Save category
          </button>
        </form>
      </section>
    </div>
  );
}

export default function AdminCategoriesPage({ go }) {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");
  const [parentFilter, setParentFilter] = useState("All parent categories");
  const [productFilter, setProductFilter] = useState("All products");
  const [quickFilter, setQuickFilter] = useState("All");
  const [expandedIds, setExpandedIds] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [openMenu, setOpenMenu] = useState(null);
  const [moveMenuOpen, setMoveMenuOpen] = useState(false);
  const [modal, setModal] = useState(null);
  const [notice, setNotice] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState("10");
  const [draggedId, setDraggedId] = useState(null);

  const notify = (message) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2300);
  };
  const loadCategories = useCallback(async () => {
    try {
      const response = await categoryApi.getCategories();
      setCategories(parseCategoryList(response));
      setLoadError("");
    } catch (requestError) {
      setLoadError(requestError.message || "Unable to load categories.");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    let cancelled = false;
    categoryApi
      .getCategories()
      .then((response) => {
        if (cancelled) return;
        setCategories(parseCategoryList(response));
        setLoadError("");
      })
      .catch((requestError) => {
        if (!cancelled)
          setLoadError(requestError.message || "Unable to load categories.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const childCounts = useMemo(
    () =>
      categories.reduce((counts, category) => {
        if (category.parentId)
          counts[category.parentId] = (counts[category.parentId] || 0) + 1;
        return counts;
      }, {}),
    [categories],
  );
  const visibleRows = useMemo(() => {
    const rows = [];
    categories
      .filter((category) => !category.parentId)
      .forEach((parent) => {
        const children = categories.filter(
          (category) => category.parentId === parent.id,
        );
        const showParent =
          parentFilter === "All parent categories" ||
          parentFilter === "Root categories" ||
          parent.id === parentFilter;
        if (showParent) rows.push(parent);
        if (expandedIds.includes(parent.id) || search.trim())
          rows.push(...children);
      });
    return rows.filter((category) => {
      const query = search.trim().toLowerCase();
      const parent = categories.find(
        (candidate) => candidate.id === category.parentId,
      );
      const matchesSearch =
        !query ||
        `${category.name} ${category.slug} ${category.id} ${parent?.name || ""}`
          .toLowerCase()
          .includes(query);
      const matchesStatus =
        quickFilter === "All" ||
        (quickFilter === "Active" && category.status === "Active") ||
        (quickFilter === "Hidden" && category.status === "Hidden") ||
        (quickFilter === "Empty" && category.products === 0);
      const matchesProducts =
        productFilter === "All products" ||
        (productFilter === "Has products" && category.products > 0) ||
        (productFilter === "Empty" && category.products === 0);
      const matchesParent =
        parentFilter === "All parent categories" ||
        (parentFilter === "Root categories"
          ? !category.parentId
          : category.id === parentFilter || category.parentId === parentFilter);
      return matchesSearch && matchesStatus && matchesProducts && matchesParent;
    });
  }, [
    categories,
    expandedIds,
    parentFilter,
    productFilter,
    quickFilter,
    search,
  ]);
  const allVisibleSelected =
    visibleRows.length > 0 &&
    visibleRows.every((category) => selectedIds.includes(category.id));
  const toggleCategory = (id) =>
    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );
  const toggleVisible = () =>
    setSelectedIds((current) =>
      allVisibleSelected
        ? current.filter(
            (id) => !visibleRows.some((category) => category.id === id),
          )
        : [
            ...new Set([
              ...current,
              ...visibleRows.map((category) => category.id),
            ]),
          ],
    );
  const toggleExpanded = (id) =>
    setExpandedIds((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );

  const setStatusForSelected = () =>
    notify("Category visibility is not supported by the backend yet.");
  const moveSelected = async (parentId) => {
    setMoveMenuOpen(false);
    try {
      await Promise.all(
        selectedIds.map((id) =>
          categoryApi.updateCategory(id, { parent: parentId || null }),
        ),
      );
      notify("Selected categories moved.");
    } catch (requestError) {
      notify(requestError.message || "Unable to move categories.");
    }
    await loadCategories();
  };
  const deleteCategories = async (ids) => {
    // Delete children before parents so parent references never dangle.
    const ordered = [...ids].sort(
      (x, y) =>
        Number(Boolean(categories.find((c) => c.id === y)?.parentId)) -
        Number(Boolean(categories.find((c) => c.id === x)?.parentId)),
    );
    let failure = "";
    for (const id of ordered) {
      try {
        await categoryApi.deleteCategory(id);
      } catch (requestError) {
        failure = requestError.message || "Unable to delete category.";
      }
    }
    setSelectedIds((current) => current.filter((id) => !ids.includes(id)));
    notify(
      failure ||
        (ids.length > 1
          ? "Selected categories deleted."
          : "Category deleted from the catalog."),
    );
    await loadCategories();
  };
  const deleteSelected = () => deleteCategories(selectedIds);
  const saveCategory = async (nextCategory) => {
    try {
      const payload = toCategoryPayload(nextCategory);
      if (nextCategory.id)
        await categoryApi.updateCategory(nextCategory.id, payload);
      else await categoryApi.createCategory(payload);
      if (nextCategory.parentId)
        setExpandedIds((current) =>
          current.includes(nextCategory.parentId)
            ? current
            : [...current, nextCategory.parentId],
        );
      setModal(null);
      notify(
        nextCategory.id
          ? "Category changes saved."
          : "Category added to the catalog.",
      );
      await loadCategories();
    } catch (requestError) {
      notify(requestError.message || "Unable to save category.");
    }
  };
  const runRowAction = (action, category) => {
    setOpenMenu(null);
    if (action === "Edit category") go(`/admin/categories/${category.id}/edit`);
    else if (action === "Add subcategory") setModal({ parentId: category.id });
    else if (action === "View products")
      notify(`${category.products} products assigned to ${category.name}.`);
    else if (action === "Duplicate")
      setModal({
        category: {
          ...category,
          id: undefined,
          slug: "",
          name: `${category.name} Copy`,
        },
      });
    else {
      void deleteCategories([category.id]);
    }
  };
  const exportCategories = () => {
    const rows = [
      [
        "Category",
        "ID",
        "URL",
        "Parent category",
        "Products",
        "Status",
        "Last updated",
      ],
      ...categories.map((category) => [
        category.name,
        category.id,
        `/${category.slug}`,
        categories.find((item) => item.id === category.parentId)?.name || "",
        category.products,
        category.status,
        category.date,
      ]),
    ];
    const url = URL.createObjectURL(
      new Blob([formatCsv(rows)], { type: "text/csv" }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "novashop-categories.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  };
  const reorderRows = (targetId) => {
    if (!draggedId || draggedId === targetId) return;
    setCategories((current) => {
      const source = current.findIndex((item) => item.id === draggedId);
      const target = current.findIndex((item) => item.id === targetId);
      if (source < 0 || target < 0) return current;
      const reordered = [...current];
      const [moved] = reordered.splice(source, 1);
      reordered.splice(target, 0, moved);
      return reordered;
    });
    setDraggedId(null);
  };

  return (
    <div className="admin-dashboard categories-page">
      <section className="admin-page-heading categories-page-heading">
        <div>
          <h1 className="admin-page-title">Categories</h1>
          <p className="admin-page-description">
            Organize your catalog into categories and subcategories.
          </p>
        </div>
        <div className="admin-page-actions">
          <button
            className="admin-action-button"
            type="button"
            onClick={exportCategories}
          >
            <AdminIcon name="download" size={15} /> Export
          </button>
          <button
            className="admin-action-button is-primary"
            type="button"
            onClick={() => go("/admin/categories/new")}
          >
            <AdminIcon name="plus" size={15} /> Add Category
          </button>
        </div>
      </section>

      <section
        className="admin-stat-grid cat-stat-grid"
        aria-label="Category summary"
      >
        <article className="admin-stat-card">
          <div className="admin-stat-heading">
            <span className="admin-stat-label">Total categories</span>
          </div>
          <div className="admin-stat-value">{categories.length}</div>
        </article>
        <article className="admin-stat-card">
          <div className="admin-stat-heading">
            <span className="admin-stat-label">Top-level categories</span>
          </div>
          <div className="admin-stat-value">
            {categories.filter((category) => !category.parentId).length}
          </div>
        </article>
        <article className="admin-stat-card">
          <div className="admin-stat-heading">
            <span className="admin-stat-label">Subcategories</span>
          </div>
          <div className="admin-stat-value">
            {categories.filter((category) => category.parentId).length}
          </div>
        </article>
      </section>

      {loading && (
        <p className="cat-empty-state" role="status">
          Loading categories…
        </p>
      )}
      {loadError && (
        <p className="cat-empty-state" role="alert">
          {loadError}{" "}
          <button
            type="button"
            onClick={() => {
              setLoading(true);
              void loadCategories();
            }}
          >
            Retry
          </button>
        </p>
      )}

      <section className="cat-catalog-toolbar" aria-label="Category filters">
        <div className="cat-filter-row">
          <label className="products-search-field">
            <AdminIcon name="search" size={16} />
            <input
              type="search"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Search categories"
              aria-label="Search categories"
            />
          </label>
          <select
            value={parentFilter}
            onChange={(event) => setParentFilter(event.target.value)}
            aria-label="Filter by parent category"
          >
            <option>All parent categories</option>
            <option>Root categories</option>
            {categories
              .filter((category) => !category.parentId)
              .map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
          </select>
          <select
            value={productFilter}
            onChange={(event) => setProductFilter(event.target.value)}
            aria-label="Filter by assigned products"
          >
            <option>All products</option>
            <option>Has products</option>
            <option>Empty</option>
          </select>
        </div>
        <div
          className="cat-quick-filters"
          role="group"
          aria-label="Category status filters"
        >
          {["All", "Active", "Hidden", "Empty"].map((filter) => (
            <button
              type="button"
              key={filter}
              className={`cat-quick-filter${quickFilter === filter ? " is-active" : ""}`}
              aria-pressed={quickFilter === filter}
              onClick={() => setQuickFilter(filter)}
            >
              {filter !== "All" && <i className={filter.toLowerCase()} />}
              {filter}
            </button>
          ))}
        </div>
      </section>

      <section className="cat-table-card" aria-label="Catalog categories">
        <div className="cat-table-scroll">
          <table className="cat-table">
            <thead>
              <tr>
                <th className="cat-check-cell">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={toggleVisible}
                    aria-label="Select all visible categories"
                  />
                </th>
                <th className="cat-name-heading">CATEGORY</th>
                <th>PRODUCTS</th>
                <th>LAST UPDATED</th>
                <th>STATUS</th>
                <th className="cat-actions-heading">ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows
                .slice((page - 1) * Number(pageSize), page * Number(pageSize))
                .map((category) => {
                  const parent = categories.find(
                    (item) => item.id === category.parentId,
                  );
                  const childrenCount = childCounts[category.id] || 0;
                  return (
                    <tr
                      key={category.id}
                      className={`${category.parentId ? "is-child" : "is-parent"}${draggedId === category.id ? " is-dragging" : ""}`}
                      draggable
                      onDragStart={(event) => {
                        event.dataTransfer.effectAllowed = "move";
                        event.dataTransfer.setData("text/plain", category.id);
                        setDraggedId(category.id);
                      }}
                      onDragOver={(event) => {
                        event.preventDefault();
                        event.dataTransfer.dropEffect = "move";
                      }}
                      onDrop={(event) => {
                        event.preventDefault();
                        reorderRows(
                          event.dataTransfer.getData("text/plain") ||
                            draggedId ||
                            category.id,
                        );
                      }}
                      onDragEnd={() => setDraggedId(null)}
                    >
                      <td className="cat-check-cell">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(category.id)}
                          onChange={() => toggleCategory(category.id)}
                          aria-label={`Select ${category.name}`}
                        />
                      </td>
                      <td className="cat-name-cell">
                        <div
                          className={`cat-name-content${category.parentId ? " is-nested" : ""}`}
                        >
                          <span
                            className="cat-drag-grip"
                            aria-label="Drag to reorder"
                          >
                            <i />
                            <i />
                            <i />
                            <i />
                            <i />
                            <i />
                          </span>
                          {childrenCount > 0 ? (
                            <button
                              className={`cat-expand-button${expandedIds.includes(category.id) ? " is-expanded" : ""}`}
                              type="button"
                              aria-label={`${expandedIds.includes(category.id) ? "Collapse" : "Expand"} ${category.name}`}
                              aria-expanded={expandedIds.includes(category.id)}
                              onClick={() => toggleExpanded(category.id)}
                            >
                              <AdminIcon name="chevron" size={13} />
                            </button>
                          ) : (
                            <span className="cat-tree-spacer" />
                          )}
                          {category.image ? (
                            <img src={category.image} alt="" />
                          ) : (
                            <span
                              className="cat-img-placeholder"
                              aria-hidden="true"
                            />
                          )}
                          <div className="cat-name-copy">
                            <strong
                              title={`URL: /${category.slug} · ${category.id}`}
                            >
                              {category.name}
                              <span className="cat-slug-tooltip">
                                URL: /{category.slug} · {category.id}
                              </span>
                            </strong>
                            <span>
                              {parent
                                ? `In ${parent.name}`
                                : childrenCount
                                  ? `${childrenCount} subcategories`
                                  : "No subcategories"}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td>
                        {category.products === 0 ? (
                          <span className="cat-empty-count">
                            <i />0
                          </span>
                        ) : (
                          <span className="cat-product-count">
                            {category.products}
                          </span>
                        )}
                      </td>
                      <td>
                        <div className="cat-updated-cell">
                          <strong>{category.updated}</strong>
                          <span>{category.date}</span>
                        </div>
                      </td>
                      <td>
                        <CategoryStatus status={category.status} />
                      </td>
                      <td className="cat-actions-cell">
                        <div className="cat-row-menu-anchor">
                          <button
                            className="products-row-menu-button"
                            type="button"
                            aria-label={`More actions for ${category.name}`}
                            aria-expanded={openMenu === category.id}
                            onClick={() =>
                              setOpenMenu((current) =>
                                current === category.id ? null : category.id,
                              )
                            }
                          >
                            <AdminIcon name="more" size={16} />
                          </button>
                          {openMenu === category.id && (
                            <div className="products-row-menu cat-row-menu">
                              {[
                                "Edit category",
                                "Add subcategory",
                                "View products",
                                "Duplicate",
                                "Delete category",
                              ].map((action) => (
                                <button
                                  key={action}
                                  type="button"
                                  className={
                                    action === "Delete category"
                                      ? "is-danger"
                                      : ""
                                  }
                                  onClick={() => runRowAction(action, category)}
                                >
                                  {action}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              {visibleRows.length === 0 && (
                <tr>
                  <td colSpan="6" className="cat-empty-state">
                    <AdminIcon name="searchSlash" size={20} />
                    <strong>
                      {categories.length === 0 && !loading
                        ? "No categories yet. Add your first category."
                        : "No categories match these filters."}
                    </strong>
                    <button
                      type="button"
                      onClick={() => {
                        setSearch("");
                        setParentFilter("All parent categories");
                        setProductFilter("All products");
                        setQuickFilter("All");
                      }}
                    >
                      Reset filters
                    </button>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="cat-pagination">
          <span>
            Showing{" "}
            {visibleRows.length === 0 ? 0 : (page - 1) * Number(pageSize) + 1}–
            {Math.min(page * Number(pageSize), visibleRows.length)} of{" "}
            {visibleRows.length} categories
          </span>
          <div className="cat-pagination-controls">
            <label>
              <select
                value={pageSize}
                onChange={(event) => {
                  setPageSize(event.target.value);
                  setPage(1);
                }}
                aria-label="Categories per page"
              >
                <option value="10">10 per page</option>
                <option value="25">25 per page</option>
                <option value="50">50 per page</option>
              </select>
              <AdminIcon name="chevron" size={12} />
            </label>
            <button
              type="button"
              disabled={page === 1}
              aria-label="Previous page"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              <AdminIcon name="left" size={13} />
            </button>
            {Array.from(
              {
                length: Math.max(
                  1,
                  Math.ceil(visibleRows.length / Number(pageSize)),
                ),
              },
              (_, index) => index + 1,
            ).map((pageNumber) => (
              <button
                type="button"
                key={pageNumber}
                className={page === pageNumber ? "is-active" : ""}
                aria-current={page === pageNumber ? "page" : undefined}
                onClick={() => setPage(pageNumber)}
              >
                {pageNumber}
              </button>
            ))}
            <button
              type="button"
              disabled={
                page >=
                Math.max(1, Math.ceil(visibleRows.length / Number(pageSize)))
              }
              aria-label="Next page"
              onClick={() =>
                setPage((current) =>
                  Math.min(
                    Math.max(
                      1,
                      Math.ceil(visibleRows.length / Number(pageSize)),
                    ),
                    current + 1,
                  ),
                )
              }
            >
              <AdminIcon name="chevron" size={13} />
            </button>
          </div>
        </div>
      </section>

      {selectedIds.length > 0 && (
        <div className="cat-bulk-bar">
          <strong>
            <i />
            {selectedIds.length} selected
          </strong>
          <button type="button" onClick={() => setStatusForSelected("Active")}>
            <AdminIcon name="check" size={14} /> Set as Active
          </button>
          <button type="button" onClick={() => setStatusForSelected("Hidden")}>
            <AdminIcon name="document" size={14} /> Set as Hidden
          </button>
          <div className="cat-bulk-move">
            <button
              type="button"
              aria-expanded={moveMenuOpen}
              onClick={() => setMoveMenuOpen((open) => !open)}
            >
              <AdminIcon name="categories" size={14} /> Move to{" "}
              <AdminIcon name="chevron" size={12} />
            </button>
            {moveMenuOpen && (
              <div>
                {categories
                  .filter(
                    (category) =>
                      !category.parentId && !selectedIds.includes(category.id),
                  )
                  .map((category) => (
                    <button
                      type="button"
                      key={category.id}
                      onClick={() => moveSelected(category.id)}
                    >
                      {category.name}
                    </button>
                  ))}
                <button type="button" onClick={() => moveSelected("")}>
                  Root categories
                </button>
              </div>
            )}
          </div>
          <i className="cat-bulk-divider" />
          <button
            className="cat-bulk-delete"
            type="button"
            onClick={deleteSelected}
          >
            <AdminIcon name="warning" size={14} /> Delete
          </button>
          <button
            className="cat-bulk-clear"
            type="button"
            aria-label="Clear category selection"
            onClick={() => setSelectedIds([])}
          >
            <AdminIcon name="close" size={16} />
          </button>
        </div>
      )}

      {modal && (
        <CategoryModal
          category={modal.category}
          parentId={modal.parentId}
          categories={categories}
          onClose={() => setModal(null)}
          onSave={saveCategory}
        />
      )}
      {notice && (
        <div className="admin-toast" role="status">
          {notice}
        </div>
      )}
    </div>
  );
}
