import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { categoryApi } from "../lib/api/categoryApi";

const CategoryContext = createContext(null);
const CATEGORY_CHANGE_EVENT = "novashop:categories-changed";
const CATEGORY_CHANNEL = "novashop-categories";

export function CategoryProvider({ children }) {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refreshCategories = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    setError("");
    try {
      const response = await categoryApi.getCategories();
      const nextCategories = Array.isArray(response?.data) ? response.data : [];
      setCategories(nextCategories);
      return nextCategories;
    } catch (requestError) {
      setError(requestError.message || "Unable to load categories.");
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const handleRefresh = () => {
      void refreshCategories({ silent: true });
    };
    const handleVisibility = () => {
      if (document.visibilityState === "visible") handleRefresh();
    };
    const channel =
      typeof BroadcastChannel === "undefined"
        ? null
        : new BroadcastChannel(CATEGORY_CHANNEL);

    void refreshCategories();
    window.addEventListener(CATEGORY_CHANGE_EVENT, handleRefresh);
    window.addEventListener("focus", handleRefresh);
    document.addEventListener("visibilitychange", handleVisibility);
    if (channel) channel.onmessage = handleRefresh;

    return () => {
      window.removeEventListener(CATEGORY_CHANGE_EVENT, handleRefresh);
      window.removeEventListener("focus", handleRefresh);
      document.removeEventListener("visibilitychange", handleVisibility);
      channel?.close();
    };
  }, [refreshCategories]);

  const value = useMemo(
    () => ({ categories, loading, error, refreshCategories }),
    [categories, loading, error, refreshCategories],
  );
  return (
    <CategoryContext.Provider value={value}>
      {children}
    </CategoryContext.Provider>
  );
}

export function useCategories() {
  const context = useContext(CategoryContext);
  if (!context)
    throw new Error("useCategories must be used within CategoryProvider");
  return context;
}
