import apiClient from "./client";

export const homeApi = {
  getHero: () => apiClient.get("/home/hero"),
  getHomepage: (params = {}) => apiClient.get("/homepage", { params }),
  getHeroSlides: (params = {}) => apiClient.get("/hero-slides", { params }),
  trackHero: (slideId, event) => apiClient.post("/track/hero", { slideId, event }),
  subscribe: (payload) =>
    apiClient.post(
      "/newsletter/subscribe",
      typeof payload === "string" ? { email: payload } : payload
    ),
  confirmNewsletter: (token) =>
    apiClient.get("/newsletter/confirm", { params: { token } }),
  unsubscribe: (token) =>
    apiClient.get("/newsletter/unsubscribe", { params: { token } }),
  unsubscribeNewsletter: (token) =>
    apiClient.get("/newsletter/unsubscribe", { params: { token } }),
};

export default homeApi;
