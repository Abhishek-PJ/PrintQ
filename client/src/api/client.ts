import axios from "axios";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api";

export const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("printq_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let refreshPromise: Promise<string | null> | null = null;

const refreshAccessToken = async (): Promise<string | null> => {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const { data } = await axios.post<{ token: string }>(`${API_BASE}/auth/refresh`, {}, { withCredentials: true });
        const token = data?.token;
        if (token) {
          localStorage.setItem("printq_token", token);
          return token;
        }
        return null;
      } catch {
        return null;
      } finally {
        refreshPromise = null;
      }
    })();
  }
  return refreshPromise;
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error?.config as any;
    const status = error?.response?.status as number | undefined;

    // Avoid infinite loops
    if (!originalRequest || originalRequest.__isRetry) {
      return Promise.reject(error);
    }

    // Don't try to refresh for auth endpoints
    const url: string = originalRequest?.url || "";
    if (url.includes("/auth/login") || url.includes("/auth/register") || url.includes("/auth/refresh")) {
      return Promise.reject(error);
    }

    if (status === 401) {
      const newToken = await refreshAccessToken();
      if (!newToken) {
        localStorage.removeItem("printq_token");
        return Promise.reject(error);
      }

      originalRequest.__isRetry = true;
      originalRequest.headers = originalRequest.headers || {};
      originalRequest.headers.Authorization = `Bearer ${newToken}`;
      return api(originalRequest);
    }

    return Promise.reject(error);
  }
);
