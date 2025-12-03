"use client";
import axios from "axios";

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_BASE_URL,
  withCredentials: false,
});

api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("token");
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    const status = err?.response?.status;
    const url: string | undefined = err?.config?.url;
    const isAuthEndpoint = url?.includes("/auth/login") || url?.includes("/auth/register") || url?.includes("/auth/sync");

    if (typeof window !== "undefined" && status === 401 && !isAuthEndpoint) {
      // Chỉ redirect khi 401 xảy ra ở các endpoint cần auth, KHÔNG redirect ở trang đăng nhập/đăng ký
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      window.location.href = "/auth/login";
      return Promise.reject(err);
    }
    return Promise.reject(err);
  }
);

export default api;
