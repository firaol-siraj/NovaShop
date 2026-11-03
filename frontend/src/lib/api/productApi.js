import apiClient from "./client";

export const productApi = {
  getProducts: (params, config = {}) =>
    apiClient.get("/products", { params, ...config }),
  getProductFilters: (params, config = {}) =>
    apiClient.get("/products/filters", { params, ...config }),
  getProductsByIds: (ids) =>
    apiClient.post("/products/by-ids", { ids }),
  getAdminProducts: (params) =>
    apiClient.get("/products/admin/all", { params }),
  getProduct: (id) => apiClient.get(`/products/${id}`),
  createProduct: (data) => apiClient.post("/products", data),
  updateProduct: (id, data) => apiClient.put(`/products/${id}`, data),
  deleteProduct: (id) => apiClient.delete(`/products/${id}`),
  uploadImage: (file) => {
    const formData = new FormData();
    formData.append("image", file);
    return apiClient.post("/upload", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
  deleteImage: (publicId) =>
    apiClient.delete("/upload", { data: { publicId } }),
  createReview: (id, data) => apiClient.post(`/products/${id}/reviews`, data),
};
