// Maps backend category documents ({ _id, name, slug, parent, ... }) to the
// view-model used by the admin category screens.

const formatDate = (value) => {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

export const toAdminCategory = (category) => ({
  id: String(category._id),
  name: category.name,
  slug: category.slug,
  description: category.description || '',
  image: category.image || '',
  parentId: category.parent ? String(category.parent._id || category.parent) : undefined,
  // The backend has no product count or visibility status for categories yet.
  products: 0,
  status: 'Active',
  updated: formatDate(category.updatedAt),
  date: formatDate(category.createdAt),
});

// Accepts the envelope returned by the shared Axios client: { success, count, data }.
export const parseCategoryList = (response) =>
  (Array.isArray(response?.data) ? response.data : []).map(toAdminCategory);

export const parseCategory = (response) => (response?.data ? toAdminCategory(response.data) : null);

// Only persistent http(s) URLs may be saved; blob: previews are local-only.
export const persistableImage = (image) => (/^https?:\/\//i.test(image || '') ? image : '');

export const toCategoryPayload = ({ name, slug, description, image, parentId }) => {
  const payload = { name: name.trim(), description: description || '', parent: parentId || null };
  if (slug && slug.trim()) payload.slug = slug.trim();
  const persistedImage = persistableImage(image);
  if (persistedImage) payload.image = persistedImage;
  return payload;
};