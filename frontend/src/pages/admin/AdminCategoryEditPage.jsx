import { useEffect, useMemo, useRef, useState } from "react";
import { AdminIcon } from "../../components/admin/AdminLayout";
import { categoryApi } from "../../lib/api/categoryApi";
import { uploadApi } from "../../lib/api/uploadApi";
import {
  parseCategory,
  parseCategoryList,
  toCategoryPayload,
} from "./categoryAdapter";
import { PRODUCT_DATA } from "../../data/products";
import "./admin-product-edit.css";
import "./admin-category-edit.css";

const assignedProducts = [
  {
    id: "prd-coat-0142",
    name: "Cashmere Overcoat",
    price: "$1,450.00",
    image: PRODUCT_DATA[1].primaryImage,
    status: "Active",
    categories: ["CAT-0007", "CAT-0011"],
  },
  {
    id: "prd-trench-0183",
    name: "Relaxed Linen Trench Coat",
    price: "$980.00",
    image: PRODUCT_DATA[1].hoverImage,
    status: "Active",
    categories: ["CAT-0007", "CAT-0011"],
  },
  {
    id: "prd-blazer-0001",
    name: "Tailored Double-Breasted Blazer",
    price: "$690.00",
    image: PRODUCT_DATA[0].primaryImage,
    status: "Active",
    categories: ["CAT-0007", "CAT-0013"],
  },
  {
    id: "prd-jacket-0034",
    name: "Cropped Utility Jacket",
    price: "$520.00",
    image: PRODUCT_DATA[0].hoverImage,
    status: "Active",
    categories: ["CAT-0007", "CAT-0012"],
  },
  ...PRODUCT_DATA.slice(2, 8).map((product, index) => ({
    id: `prd-catalog-${index}`,
    name: product.name,
    price: `${product.price}.00`,
    image: product.primaryImage,
    status: index === 5 ? "Draft" : "Active",
    categories: [],
  })),
];

function createCategoryForm(category, allCategories = []) {
  if (!category) {
    return {
      id: "",
      name: "",
      slug: "",
      description: "",
      image: "",
      parentId: "",
      subcategories: [],
      productIds: [],
      productCount: 0,
      status: "Draft",
      sortOrder: "Best selling",
      showInNavigation: false,
      metaTitle: "",
      metaDescription: "",
      internalNotes: "",
      created: "",
      lastUpdated: "",
    };
  }
  return {
    id: category.id,
    name: category.name,
    slug: category.slug,
    description: category.description,
    image: category.image,
    parentId: category.parentId || "",
    subcategories: allCategories
      .filter((item) => item.parentId === category.id)
      .map((item) => ({ id: item.id, name: item.name })),
    productIds: [],
    productCount: category.products,
    status: "Active",
    sortOrder: "Best selling",
    showInNavigation: !category.parentId,
    metaTitle: `${category.name} | NovaShop`,
    metaDescription: "",
    internalNotes: "",
    created: category.date,
    lastUpdated: category.updated,
  };
}

function EditorCard({ title, tag, right, children, className = "" }) {
  return (
    <section className={`admin-card pe-card ${className}`}>
      <header className="pe-card-heading">
        <h2>{title}</h2>
        {right || (tag && <span className="pe-card-tag">{tag}</span>)}
      </header>
      {children}
    </section>
  );
}

function CategoryChildModal({ onClose, onCreate }) {
  const [name, setName] = useState("");
  const submit = (event) => {
    event.preventDefault();
    if (name.trim()) onCreate(name.trim());
  };
  return (
    <div
      className="admin-modal-backdrop"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section
        className="admin-order-modal ce-small-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ce-child-title"
      >
        <header className="admin-modal-heading">
          <div>
            <span className="admin-modal-eyebrow">Category hierarchy</span>
            <h2 id="ce-child-title">Add subcategory</h2>
          </div>
          <button
            className="admin-icon-button"
            type="button"
            aria-label="Close subcategory form"
            onClick={onClose}
          >
            <AdminIcon name="close" />
          </button>
        </header>
        <form onSubmit={submit}>
          <label>
            Subcategory name
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Raincoats"
              autoFocus
            />
          </label>
          <p>Added under this parent category in your catalog.</p>
          <button
            className="admin-action-button is-primary"
            type="submit"
            disabled={!name.trim()}
          >
            Add subcategory
          </button>
        </form>
      </section>
    </div>
  );
}

function ProductPicker({ products, selectedIds, onClose, onSave }) {
  const [search, setSearch] = useState("");
  const [selection, setSelection] = useState(selectedIds);
  const filtered = products.filter((product) =>
    `${product.name} ${product.id}`
      .toLowerCase()
      .includes(search.trim().toLowerCase()),
  );
  const toggle = (id) =>
    setSelection((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );
  return (
    <div
      className="admin-modal-backdrop"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section
        className="admin-order-modal ce-product-picker"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ce-product-picker-title"
      >
        <header className="admin-modal-heading">
          <div>
            <span className="admin-modal-eyebrow">Catalog assignment</span>
            <h2 id="ce-product-picker-title">Add products</h2>
          </div>
          <button
            className="admin-icon-button"
            type="button"
            aria-label="Close product picker"
            onClick={onClose}
          >
            <AdminIcon name="close" />
          </button>
        </header>
        <label className="products-search-field ce-picker-search">
          <AdminIcon name="search" size={15} />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search catalog products"
            aria-label="Search catalog products"
          />
        </label>
        <div className="ce-picker-list">
          {filtered.map((product) => (
            <label className="ce-picker-row" key={product.id}>
              <input
                type="checkbox"
                checked={selection.includes(product.id)}
                onChange={() => toggle(product.id)}
              />
              <img src={product.image} alt="" />
              <span>
                <strong>{product.name}</strong>
                <small>{product.price}</small>
              </span>
              <span
                className={`ce-picker-status ${product.status.toLowerCase()}`}
              >
                {product.status}
              </span>
            </label>
          ))}
          {filtered.length === 0 && (
            <p className="ce-picker-empty">
              No catalog products match that search.
            </p>
          )}
        </div>
        <footer className="ce-picker-footer">
          <span>{selection.length} selected</span>
          <button
            className="admin-action-button is-primary"
            type="button"
            onClick={() => onSave(selection)}
          >
            Add selected products
          </button>
        </footer>
      </section>
    </div>
  );
}

export default function AdminCategoryEditPage({
  categoryId,
  go,
  mode = "edit",
}) {
  const isCreate = mode === "create";
  const [form, setForm] = useState(() => createCategoryForm(null));
  const [savedForm, setSavedForm] = useState(() => createCategoryForm(null));
  const [allCategories, setAllCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [seoOpen, setSeoOpen] = useState(false);
  const [metadataOpen, setMetadataOpen] = useState(false);
  const [seoPreviewOpen, setSeoPreviewOpen] = useState(false);
  const [childModalOpen, setChildModalOpen] = useState(false);
  const [productPickerOpen, setProductPickerOpen] = useState(false);
  const [unassignPrompt, setUnassignPrompt] = useState(null);
  const [imageInput, setImageInput] = useState(null);
  const descriptionRef = useRef(null);
  const slugManuallyEdited = useRef(false);
  const [selectedImageFile, setSelectedImageFile] = useState(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const originalImageRef = useRef("");
  const isDirty = JSON.stringify(form) !== JSON.stringify(savedForm);
  const isCategoryValid = Boolean(form.name.trim());
  const parentCategory = allCategories.find(
    (item) => item.id === form.parentId,
  );
  const collectionPath = `${parentCategory ? `${parentCategory.slug}/` : ""}${form.slug}`;
  const subcategories = form.subcategories;
  const categoryProducts = useMemo(
    () =>
      form.productIds
        .map((id) => assignedProducts.find((product) => product.id === id))
        .filter(Boolean),
    [form.productIds],
  );
  const productCount =
    form.productCount +
    Math.max(0, categoryProducts.length - form.productIds.length);
  const availableParents = allCategories.filter(
    (item) => !item.parentId && item.id !== form.id,
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = parseCategoryList(await categoryApi.getCategories());
        if (cancelled) return;
        setAllCategories(list);
        if (!isCreate) {
          const current = parseCategory(
            await categoryApi.getCategory(categoryId),
          );
          if (cancelled) return;
          const loaded = createCategoryForm(current, list);
          setForm(loaded);
          setSavedForm(JSON.parse(JSON.stringify(loaded)));
        }
      } catch (requestError) {
        if (!cancelled)
          setLoadError(requestError.message || "Unable to load category.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [categoryId, isCreate]);

  useEffect(() => {
    if (
      descriptionRef.current &&
      descriptionRef.current.innerText !== form.description
    )
      descriptionRef.current.innerText = form.description;
  }, [form.description]);

  const updateForm = (patch) =>
    setForm((current) => ({ ...current, ...patch }));
  const notify = (message) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2300);
  };
  const discard = () => {
    setForm(JSON.parse(JSON.stringify(savedForm)));
    setUnassignPrompt(null);
    setMenuOpen(false);
  };
  const save = async (event) => {
    event?.preventDefault();

    if (!isCategoryValid || saving || uploadingImage) return;

    const status = event?.currentTarget?.dataset?.status;
    const nextForm = status ? { ...form, status } : form;

    setSaving(true);

    let uploadedPublicId = null;

    try {
      let imageUrl = nextForm.image;

      // A blob URL is only a local preview; it must never be saved
      // to the database.
      if (selectedImageFile) {
        setUploadingImage(true);

        const response = await uploadApi.uploadImage(selectedImageFile);

        if (!response?.image || !response?.publicId) {
          throw new Error("Image upload returned incomplete data.");
        }

        imageUrl = response.image;
        uploadedPublicId = response.publicId;

        setUploadingImage(false);
      }

      const payload = toCategoryPayload({
        ...nextForm,
        image: imageUrl,
      });

      if (isCreate) {
        await categoryApi.createCategory(payload);
        go("/admin/categories");
        return;
      }

      await categoryApi.updateCategory(form.id, payload);

      const response = await categoryApi.getCategory(form.id);
      const updated = parseCategory(response);
      const refreshed = createCategoryForm(updated, allCategories);

      setForm(refreshed);
      setSavedForm(JSON.parse(JSON.stringify(refreshed)));
      setSelectedImageFile(null);
      originalImageRef.current = updated.image || "";

      notify("Category changes saved.");
    } catch (requestError) {
      // Only attempt cleanup for the image uploaded in this save.
      // The backend refuses to delete images referenced by records.
      if (uploadedPublicId) {
        try {
          const currentCategory = isCreate
            ? null
            : parseCategory(await categoryApi.getCategory(form.id));

          const imageWasSaved =
            currentCategory?.image === form.image ||
            currentCategory?.image === nextForm.image;

          if (!imageWasSaved) {
            const { productApi } = await import("../../lib/api/productApi");
            await productApi.deleteImage(uploadedPublicId);
          }
        } catch {
          // Preserve the original save error; cleanup can be retried later.
        }
      }

      setUploadingImage(false);
      notify(requestError.message || "Unable to save category.");
    } finally {
      setSaving(false);
      setUploadingImage(false);
    }
  };
  const handleNameChange = (name) => {
    const slug = name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    setForm((current) => ({
      ...current,
      name,
      ...(!slugManuallyEdited.current ? { slug } : {}),
    }));
  };
  const addSubcategory = async (name) => {
    if (isCreate || !form.id) return;
    try {
      const created = parseCategory(
        await categoryApi.createCategory({ name, parent: form.id }),
      );
      updateForm({
        subcategories: [
          ...form.subcategories,
          { id: created.id, name: created.name },
        ],
      });
      setSavedForm((current) => ({
        ...current,
        subcategories: [
          ...current.subcategories,
          { id: created.id, name: created.name },
        ],
      }));
      setAllCategories((current) => [...current, created]);
      setChildModalOpen(false);
      notify(`${name} added as a subcategory.`);
    } catch (requestError) {
      notify(requestError.message || "Unable to add subcategory.");
    }
  };
  const unassignSubcategory = async (child) => {
    try {
      await categoryApi.updateCategory(child.id, { parent: null });
      updateForm({
        subcategories: form.subcategories.filter(
          (item) => item.id !== child.id,
        ),
      });
      setSavedForm((current) => ({
        ...current,
        subcategories: current.subcategories.filter(
          (item) => item.id !== child.id,
        ),
      }));
      setUnassignPrompt(null);
      notify(`${child.name} moved to top-level categories.`);
    } catch (requestError) {
      notify(requestError.message || "Unable to update subcategory.");
    }
  };
  const validateImageFile = (file) => {
    if (!file) return false;

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      notify("Choose a JPG, PNG, or WebP image.");
      return false;
    }

    if (file.size > 5 * 1024 * 1024) {
      notify("Image must be 5 MB or smaller.");
      return false;
    }

    return true;
  };

  const selectImage = (file) => {
    if (!validateImageFile(file)) return;

    setSelectedImageFile(file);
    updateForm({ image: URL.createObjectURL(file) });
  };

  const setImage = (event) => {
    const file = event.target.files?.[0];

    if (file) selectImage(file);

    event.target.value = "";
  };

  const dropImage = (event) => {
    event.preventDefault();

    const file = event.dataTransfer.files?.[0];

    if (file) selectImage(file);
  };
  const assignProducts = (ids) => {
    const newAssignments = ids.filter(
      (id) => !form.productIds.includes(id),
    ).length;
    updateForm({
      productIds: ids,
      productCount: form.productCount + newAssignments,
    });
    setProductPickerOpen(false);
    notify(`${newAssignments} products assigned to ${form.name}.`);
  };

  return (
    <div
      className={`admin-dashboard pe-page ce-page${isCreate ? " is-create" : ""}`}
    >
      {loading && (
        <p className="pe-field-hint" role="status">
          Loading category…
        </p>
      )}
      {loadError && (
        <p className="pe-field-error" role="alert">
          {loadError}{" "}
          <button
            type="button"
            className="admin-text-link"
            onClick={() => go("/admin/categories")}
          >
            Back to categories
          </button>
        </p>
      )}
      <header className="pe-page-header">
        <div className="pe-header-context">
          <button
            className="pe-breadcrumb"
            type="button"
            onClick={() => go("/admin/categories")}
          >
            <AdminIcon name="left" size={14} /> Categories
          </button>
          {!isCreate && <span className="pe-record-id">ID: {form.id}</span>}
        </div>
        <div className="pe-title-actions">
          <div className="pe-title-copy">
            <h1>{isCreate ? "Add category" : "Edit category"}</h1>
            <p>
              {isCreate
                ? "Create a new category to organize your catalog."
                : `Update details, imagery, and visibility for ${form.name || "this category"}.`}
            </p>
          </div>
          <div className="pe-actions">
            {isCreate ? (
              <>
                <button
                  className="admin-action-button pe-discard-button"
                  type="button"
                  data-status="Draft"
                  disabled={!isCategoryValid || saving || uploadingImage}
                  onClick={save}
                >
                  Save as Draft
                </button>
                <button
                  className="admin-action-button is-primary pe-save-button"
                  type="button"
                  data-status="Active"
                  disabled={!isCategoryValid || saving || uploadingImage}
                  onClick={save}
                >
                  Publish Category
                </button>
              </>
            ) : (
              <>
                <div className="pe-overflow-wrap">
                  <button
                    className="admin-action-button pe-overflow-button"
                    type="button"
                    aria-label="More category actions"
                    aria-expanded={menuOpen}
                    onClick={() => setMenuOpen((open) => !open)}
                  >
                    <AdminIcon name="more" size={17} />
                  </button>
                  {menuOpen && (
                    <div className="pe-overflow-menu">
                      <button
                        type="button"
                        onClick={() => {
                          setMenuOpen(false);
                          notify(
                            `Storefront collection preview opened for ${form.name}.`,
                          );
                        }}
                      >
                        Preview storefront
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setMenuOpen(false);
                          navigator.clipboard?.writeText(
                            `${window.location.origin}/collections/${form.slug}`,
                          );
                          notify("Storefront URL copied.");
                        }}
                      >
                        Copy storefront URL
                      </button>
                    </div>
                  )}
                </div>
                <button
                  className="admin-action-button pe-discard-button"
                  type="button"
                  disabled={!isDirty || saving || uploadingImage}
                  onClick={discard}
                >
                  Discard
                </button>
                <button
                  className="admin-action-button is-primary pe-save-button"
                  type="button"
                  disabled={!isDirty || saving || uploadingImage}
                  onClick={save}
                >
                  Save changes
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      <form className="pe-columns" onSubmit={save}>
        <div className="pe-main-column">
          <EditorCard
            title="Category information"
            tag="GENERAL"
            className="ce-information-card"
          >
            <label className="pe-field">
              <span>Category name</span>
              <input
                value={form.name}
                onChange={(event) =>
                  isCreate
                    ? handleNameChange(event.target.value)
                    : updateForm({ name: event.target.value })
                }
                placeholder={isCreate ? "e.g. Outerwear" : undefined}
              />
            </label>
            <label className="pe-field ce-handle-field">
              <span>URL handle</span>
              <div>
                <span>
                  yourstore.com/collections/
                  {isCreate && parentCategory ? `${parentCategory.slug}/` : ""}
                </span>
                <input
                  value={form.slug}
                  onChange={(event) => {
                    if (isCreate) slugManuallyEdited.current = true;
                    updateForm({ slug: event.target.value });
                  }}
                />
              </div>
            </label>
            <div className="pe-field ce-description-field">
              <span>Description</span>
              <div className="pe-rich-editor">
                <div className="pe-rich-toolbar">
                  <button
                    type="button"
                    aria-label="Bold"
                    title="Bold"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => document.execCommand("bold")}
                  >
                    <strong>B</strong>
                  </button>
                  <button
                    type="button"
                    aria-label="Italic"
                    title="Italic"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => document.execCommand("italic")}
                  >
                    <em>I</em>
                  </button>
                  <button
                    type="button"
                    aria-label="Bullet list"
                    title="Bullet list"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => document.execCommand("insertUnorderedList")}
                  >
                    •≡
                  </button>
                  <button
                    type="button"
                    aria-label="Insert link"
                    title="Insert link"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => {
                      const link = window.prompt("Enter storefront link");
                      if (link) document.execCommand("createLink", false, link);
                    }}
                  >
                    ↗
                  </button>
                  <span>MARKDOWN</span>
                </div>
                <div
                  className={`pe-rich-area${isCreate && !form.description ? " is-empty" : ""}`}
                  ref={descriptionRef}
                  contentEditable
                  suppressContentEditableWarning
                  role="textbox"
                  aria-label="Category description"
                  data-placeholder="Describe what belongs in this category."
                  onInput={(event) =>
                    updateForm({ description: event.currentTarget.innerText })
                  }
                >
                  {form.description}
                </div>
              </div>
            </div>
          </EditorCard>

          <EditorCard
            title="Category image"
            right={
              <span className="ce-card-helper">
                Used on collection pages and navigation menus.
              </span>
            }
            className="ce-image-card"
          >
            {isCreate && !form.image ? (
              <div
                className="ce-image-dropzone"
                onDragOver={(event) => event.preventDefault()}
                onDrop={dropImage}
              >
                <svg viewBox="0 0 36 36" aria-hidden="true">
                  <path d="M10 25h17a6 6 0 0 0 .4-12 9.5 9.5 0 0 0-18.2 2.2A5 5 0 0 0 10 25Z" />
                  <path d="M18.5 23V12m0 0-4 4m4-4 4 4" />
                </svg>
                <strong>
                  Drag an image here or{" "}
                  <button type="button" onClick={() => imageInput?.click()}>
                    browse
                  </button>
                </strong>
                <span>
                  JPG, PNG or WebP, up to 10 MB. Square or 4:3 aspect ratio
                  recommended.
                </span>
                <button
                  className="admin-action-button ce-browse-files"
                  type="button"
                  onClick={() => imageInput?.click()}
                >
                  BROWSE FILES
                </button>
                <input
                  className="ce-file-input"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={setImage}
                  ref={setImageInput}
                />
              </div>
            ) : (
              <div className="ce-image-layout">
                {form.image ? (
                  <img
                    src={form.image}
                    alt={`${form.name || "New"} category`}
                  />
                ) : (
                  <div className="ce-image-empty">
                    No category image selected.
                  </div>
                )}
                <div className="ce-image-actions">
                  <button
                    className="admin-action-button"
                    type="button"
                    onClick={() => imageInput?.click()}
                  >
                    {isCreate ? "Replace image" : "Replace image"}
                  </button>
                  <button
                    className="ce-remove-image"
                    type="button"
                    onClick={() => updateForm({ image: "" })}
                    disabled={!form.image}
                  >
                    Remove
                  </button>
                  <input
                    className="ce-file-input"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={setImage}
                    ref={setImageInput}
                  />
                </div>
              </div>
            )}
          </EditorCard>

          <EditorCard
            title="Hierarchy"
            tag="STRUCTURE"
            className="ce-hierarchy-card"
          >
            <label className="pe-field">
              <span>Parent category</span>
              <select
                value={form.parentId}
                onChange={(event) =>
                  updateForm({
                    parentId: event.target.value,
                    showInNavigation: isCreate
                      ? form.showInNavigation
                      : !event.target.value || form.showInNavigation,
                  })
                }
              >
                <option value="">None (top-level category)</option>
                {availableParents.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            {isCreate ? (
              <p className="ce-hierarchy-helper">
                Leave as top-level to show this category in the main navigation,
                or nest it under an existing category.
              </p>
            ) : (
              <div className="ce-subcategories">
                <span className="ce-subcategory-label">
                  SUBCATEGORIES ({subcategories.length})
                </span>
                {subcategories.length ? (
                  <div className="ce-subcategory-tags">
                    {subcategories.map((child) => (
                      <span className="ce-subcategory-tag" key={child.id}>
                        {child.name}
                        <button
                          type="button"
                          aria-label={`Remove ${child.name} subcategory`}
                          onClick={() => setUnassignPrompt(child)}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="ce-no-subcategories">
                    No subcategories assigned to this parent.
                  </p>
                )}
                {unassignPrompt && (
                  <div className="ce-unassign-warning" role="status">
                    <span>
                      Move {unassignPrompt.name} to top-level categories?
                    </span>
                    <button
                      type="button"
                      onClick={() => unassignSubcategory(unassignPrompt)}
                    >
                      Unassign
                    </button>
                    <button
                      type="button"
                      onClick={() => setUnassignPrompt(null)}
                    >
                      Cancel
                    </button>
                  </div>
                )}
                <button
                  className="ce-text-action"
                  type="button"
                  onClick={() => setChildModalOpen(true)}
                >
                  <AdminIcon name="plus" size={13} /> Add subcategory
                </button>
              </div>
            )}
          </EditorCard>

          {!isCreate && (
            <EditorCard
              title="Products in this category"
              right={
                <div className="ce-products-heading-actions">
                  <span className="ce-products-count">
                    {productCount} products
                  </span>
                  <button
                    className="admin-text-link"
                    type="button"
                    onClick={() => setProductPickerOpen(true)}
                  >
                    Manage products <span>→</span>
                  </button>
                </div>
              }
              className="ce-products-card"
            >
              <div className="ce-assigned-products">
                {categoryProducts.slice(0, 4).map((product) => (
                  <article className="ce-assigned-product" key={product.id}>
                    <img src={product.image} alt="" />
                    <div>
                      <strong>{product.name}</strong>
                      <span>{product.price}</span>
                    </div>
                    <span
                      className={`ce-product-status ${product.status.toLowerCase()}`}
                    >
                      <i />
                      {product.status}
                    </span>
                  </article>
                ))}
                {categoryProducts.length === 0 && (
                  <p className="ce-no-subcategories">
                    No products assigned to this category yet.
                  </p>
                )}
              </div>
              <button
                className="ce-text-action ce-add-products"
                type="button"
                onClick={() => setProductPickerOpen(true)}
              >
                <AdminIcon name="plus" size={13} /> Add products
              </button>
            </EditorCard>
          )}

          <EditorCard
            title="Search listing"
            right={
              <button
                className="ce-seo-preview-link"
                type="button"
                disabled={
                  isCreate && !form.name.trim() && !form.description.trim()
                }
                onClick={() => setSeoPreviewOpen(true)}
              >
                SEO PREVIEW
              </button>
            }
            className="pe-accordion-card ce-seo-card"
          >
            <button
              className="pe-accordion-trigger pe-seo-trigger"
              type="button"
              aria-expanded={seoOpen}
              onClick={() => setSeoOpen((open) => !open)}
            >
              <span>
                {isCreate
                  ? "How this category will appear in search results."
                  : "How this category appears in search results."}
              </span>
              <AdminIcon name="chevron" size={14} />
            </button>
            {seoOpen && (
              <div className="pe-seo-fields">
                <label className="pe-field">
                  <span>Meta title</span>
                  <input
                    value={form.metaTitle}
                    placeholder={
                      isCreate
                        ? form.name
                          ? `${form.name} | NovaShop`
                          : "Category name | NovaShop"
                        : undefined
                    }
                    onChange={(event) =>
                      updateForm({ metaTitle: event.target.value })
                    }
                  />
                </label>
                <label className="pe-field">
                  <span>Meta description</span>
                  <textarea
                    rows="3"
                    value={form.metaDescription}
                    placeholder={
                      isCreate
                        ? form.description ||
                          "A short description of this collection."
                        : undefined
                    }
                    onChange={(event) =>
                      updateForm({ metaDescription: event.target.value })
                    }
                  />
                </label>
              </div>
            )}
          </EditorCard>
        </div>

        <aside className="pe-side-column ce-side-column">
          <EditorCard title="Visibility" className="ce-visibility-card">
            <label
              className={`pe-status-select${form.status !== "Active" ? " is-draft" : ""}`}
            >
              <i />
              <select
                value={form.status}
                onChange={(event) => updateForm({ status: event.target.value })}
              >
                <option>Draft</option>
                <option>Active</option>
                <option>Hidden</option>
              </select>
              <AdminIcon name="chevron" size={12} />
            </label>
            <p>
              {form.status === "Active"
                ? "Active categories are visible in your storefront navigation and search."
                : form.status === "Draft"
                  ? "Draft categories are hidden from your storefront navigation and search."
                  : "Hidden categories are not shown in storefront navigation or search."}
            </p>
          </EditorCard>
          <EditorCard title="Display settings" className="ce-display-card">
            <label className="pe-field">
              <span>Sort products by</span>
              <select
                value={form.sortOrder}
                onChange={(event) =>
                  updateForm({ sortOrder: event.target.value })
                }
              >
                {[
                  "Best selling",
                  "Newest",
                  "Price: low to high",
                  "Manual order",
                ].map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </select>
            </label>
            <label className="pe-track-row">
              <span>
                <strong>Show in navigation menu</strong>
                <small>
                  Display this category in your storefront navigation
                </small>
              </span>
              <input
                type="checkbox"
                checked={form.showInNavigation}
                onChange={(event) =>
                  updateForm({ showInNavigation: event.target.checked })
                }
              />
              <i />
            </label>
          </EditorCard>
          {!isCreate && (
            <EditorCard
              title="Metadata"
              className="pe-accordion-card ce-metadata-card"
            >
              <button
                className="pe-accordion-trigger pe-details-trigger"
                type="button"
                aria-expanded={metadataOpen}
                onClick={() => setMetadataOpen((open) => !open)}
              >
                <span>Category record and internal notes.</span>
                <AdminIcon name="chevron" size={14} />
              </button>
              {metadataOpen && (
                <div className="pe-seo-fields">
                  <div className="pe-metadata-row">
                    <span>Created</span>
                    <strong>{form.created}</strong>
                  </div>
                  <div className="pe-metadata-row">
                    <span>Last updated</span>
                    <strong>{form.lastUpdated}</strong>
                  </div>
                  <label className="pe-field">
                    <span>Internal notes</span>
                    <textarea
                      rows="3"
                      value={form.internalNotes}
                      onChange={(event) =>
                        updateForm({ internalNotes: event.target.value })
                      }
                      placeholder="Staff-only category notes"
                    />
                  </label>
                </div>
              )}
            </EditorCard>
          )}
        </aside>
      </form>

      {!isCreate && childModalOpen && (
        <CategoryChildModal
          onClose={() => setChildModalOpen(false)}
          onCreate={addSubcategory}
        />
      )}
      {!isCreate && productPickerOpen && (
        <ProductPicker
          products={assignedProducts}
          selectedIds={form.productIds}
          onClose={() => setProductPickerOpen(false)}
          onSave={assignProducts}
        />
      )}
      {seoPreviewOpen && (
        <div
          className="admin-modal-backdrop"
          role="presentation"
          onMouseDown={(event) =>
            event.target === event.currentTarget && setSeoPreviewOpen(false)
          }
        >
          <section
            className="admin-order-modal ce-seo-preview-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ce-seo-preview-title"
          >
            <header className="admin-modal-heading">
              <div>
                <span className="admin-modal-eyebrow">Storefront search</span>
                <h2 id="ce-seo-preview-title">SEO preview</h2>
              </div>
              <button
                className="admin-icon-button"
                type="button"
                aria-label="Close SEO preview"
                onClick={() => setSeoPreviewOpen(false)}
              >
                <AdminIcon name="close" />
              </button>
            </header>
            <div className="ce-search-preview">
              <strong>
                {form.metaTitle ||
                  (form.name
                    ? `${form.name} | NovaShop`
                    : "Category name | NovaShop")}
              </strong>
              <span>
                yourstore.com/collections/{collectionPath || "category-handle"}
              </span>
              <p>
                {form.metaDescription ||
                  form.description ||
                  "Category description preview will appear here."}
              </p>
            </div>
          </section>
        </div>
      )}
      {notice && (
        <div className="admin-toast" role="status">
          {notice}
        </div>
      )}
    </div>
  );
}
