import { useEffect, useState } from "react";
import { AdminIcon } from "../../components/admin/AdminLayout";
import adminApi from "../../lib/api/adminApi";
import "./admin-category-edit.css";

export default function AdminCategoryEditPage({ categoryId, go, mode = "edit" }) {
  const isCreate = mode === "create";
  const [categories, setCategories] = useState([]);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [parent, setParent] = useState("");
  const [status, setStatus] = useState("active");
  const [sortOrder, setSortOrder] = useState(0);
  const [loading, setLoading] = useState(!isCreate);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");

  const notify = (msg) => {
    setNotice(msg);
    window.setTimeout(() => setNotice(""), 3000);
  };

  useEffect(() => {
    adminApi
      .getCategories()
      .then((res) => {
        if (Array.isArray(res.data)) {
          setCategories(res.data);
          if (!isCreate && categoryId) {
            const found = res.data.find(
              (c) => c._id === categoryId || c.slug === categoryId || c.id === categoryId
            );
            if (found) {
              setName(found.name || "");
              setSlug(found.slug || "");
              setDescription(found.description || "");
              setParent(found.parent?._id || found.parent || "");
              setStatus(found.status || "active");
              setSortOrder(found.sortOrder || 0);
            }
          }
        }
      })
      .catch((err) => {
        notify(err.response?.data?.message || err.message || "Failed to load categories.");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [categoryId, isCreate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      notify("Category name is required.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        slug: slug.trim() || undefined,
        description: description.trim(),
        parent: parent || null,
        status,
        sortOrder: Number(sortOrder) || 0,
      };

      if (isCreate) {
        await adminApi.createCategory(payload);
        notify("Category created successfully!");
      } else {
        await adminApi.updateCategory(categoryId, payload);
        notify("Category updated successfully!");
      }

      window.setTimeout(() => go("/admin/categories"), 500);
    } catch (err) {
      notify(err.response?.data?.message || err.message || "Failed to save category.");
    } finally {
      setSaving(false);
    }
  };

  // Derived category info for edit mode
  const currentCategory = !isCreate
    ? categories.find(
        (c) => c._id === categoryId || c.slug === categoryId || c.id === categoryId
      )
    : null;
  const subcategoryCount = !isCreate && categoryId
    ? categories.filter((c) => (c.parent?._id || c.parent) === categoryId).length
    : 0;

  if (loading) {
    return (
      <div className="admin-dashboard cat-edit-page">
        <div className="p-16 text-center text-xs text-[var(--text-muted)]">
          Loading category information…
        </div>
      </div>
    );
  }

  return (
    <div className="admin-dashboard cat-edit-page">
      {/* 1. Sticky Action Bar Header */}
      <header className="cat-edit-header">
        <div className="cat-edit-header-main">
          <button
            className="cat-edit-breadcrumb-btn"
            type="button"
            onClick={() => go("/admin/categories")}
          >
            <AdminIcon name="left" size={13} />
            <span>Categories</span>
          </button>
          <div className="cat-edit-title-row">
            <h1 className="cat-edit-page-title">
              {isCreate ? "Create Category" : name || "Edit Category"}
            </h1>
            {!isCreate && (
              <span className={`cat-edit-status-badge ${status}`}>
                {status === "active" ? "Active" : "Hidden"}
              </span>
            )}
          </div>
        </div>

        <div className="cat-edit-actions">
          <button
            className="cat-edit-discard-btn"
            type="button"
            onClick={() => go("/admin/categories")}
          >
            Discard
          </button>
          <button
            className="cat-edit-primary-btn"
            type="button"
            disabled={saving}
            onClick={handleSubmit}
          >
            {saving ? "Saving…" : isCreate ? "Create Category" : "Save Changes"}
          </button>
        </div>
      </header>

      {/* 2. Two-Column Layout */}
      <div className="cat-edit-grid">
        {/* Main Column */}
        <div className="cat-edit-main-col">
          <section className="cat-edit-card">
            <header className="cat-edit-card-header">
              <h2 className="cat-edit-card-title">Category Details</h2>
              <p className="cat-edit-card-subtitle">
                Set category name, storefront URL slug, and public collection description.
              </p>
            </header>

            <form onSubmit={handleSubmit} className="cat-edit-form">
              <label className="cat-edit-field">
                <span className="cat-edit-label">
                  Category Name <span className="cat-edit-required">*</span>
                </span>
                <input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Knitwear, Tailoring, Leather Goods"
                  className="cat-edit-input"
                  autoFocus={isCreate}
                />
              </label>

              <div className="cat-edit-field">
                <span className="cat-edit-label">Slug (URL Key)</span>
                <div className="cat-slug-input-wrap">
                  <span className="cat-slug-prefix">/categories/</span>
                  <input
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    placeholder="e.g. knitwear"
                    className="cat-slug-input"
                  />
                </div>
                <span className="cat-field-hint">
                  Auto-generated from category name if left blank.
                </span>
              </div>

              <div className="cat-edit-field">
                <span className="cat-edit-label">Description</span>
                <textarea
                  rows="4"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Short editorial description displayed on storefront collections header…"
                  className="cat-edit-textarea"
                />
                <div className="cat-textarea-footer">
                  <span className="cat-char-counter">
                    {description.length} characters
                  </span>
                </div>
              </div>
            </form>
          </section>
        </div>

        {/* Side Column */}
        <div className="cat-edit-side-col">
          <section className="cat-edit-card">
            <header className="cat-edit-card-header">
              <h2 className="cat-edit-card-title">Hierarchy &amp; Status</h2>
              <p className="cat-edit-card-subtitle">
                Control visibility, nesting hierarchy, and ordering.
              </p>
            </header>

            <div className="cat-edit-form">
              <div className="cat-edit-field">
                <span className="cat-edit-label">Visibility Status</span>
                <div className="cat-status-select-wrap">
                  <i className={`cat-status-dot ${status === "active" ? "is-active" : "is-hidden"}`} />
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="cat-edit-select"
                  >
                    <option value="active">Active (Visible)</option>
                    <option value="hidden">Hidden</option>
                  </select>
                </div>
                <span className="cat-field-hint">
                  Hidden categories are excluded from storefront navigation.
                </span>
              </div>

              <div className="cat-edit-field">
                <span className="cat-edit-label">Parent Category</span>
                <select
                  value={parent}
                  onChange={(e) => setParent(e.target.value)}
                  className="cat-edit-select"
                >
                  <option value="">None (Top-Level Category)</option>
                  {categories
                    .filter((c) => !c.parent && c._id !== categoryId)
                    .map((c) => (
                      <option key={c._id} value={c._id}>
                        {c.name}
                      </option>
                    ))}
                </select>
                <span className="cat-field-hint">
                  Assign a parent to nest this category as a subcategory.
                </span>
              </div>

              <div className="cat-edit-field">
                <span className="cat-edit-label">Sort Order</span>
                <input
                  type="number"
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value)}
                  placeholder="0"
                  className="cat-edit-input"
                />
                <span className="cat-field-hint">
                  Determines display order in navigation (lower numbers first).
                </span>
              </div>

              {/* Edit Mode Summary Strip */}
              {!isCreate && (
                <div className="cat-summary-strip">
                  <div className="cat-summary-item">
                    <span className="cat-summary-item-label">Subcategories</span>
                    <span className="cat-summary-item-val">{subcategoryCount}</span>
                  </div>
                  <div className="cat-summary-item">
                    <span className="cat-summary-item-label">Status</span>
                    <span className="cat-summary-item-val">
                      {status === "active" ? "Active" : "Hidden"}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>

      {/* 3. Sticky Bottom Save Bar for Mobile */}
      <div className="cat-mobile-save-bar">
        <button
          className="cat-edit-discard-btn"
          type="button"
          onClick={() => go("/admin/categories")}
        >
          Discard
        </button>
        <button
          className="cat-edit-primary-btn"
          type="button"
          disabled={saving}
          onClick={handleSubmit}
        >
          {saving ? "Saving…" : isCreate ? "Create Category" : "Save Changes"}
        </button>
      </div>

      {notice && <div className="admin-toast" role="status">{notice}</div>}
    </div>
  );
}
