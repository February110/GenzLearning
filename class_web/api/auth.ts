"use client";

export type AuthUser = {
  id: string;
  email: string;
  fullName: string;
  avatar?: string;
  systemRole: "Admin" | "User";
};

export const getCurrentUser = (): AuthUser | null => {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem("user");
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

export const setAuth = (token: string, user: AuthUser) => {
  localStorage.setItem("token", token);
  localStorage.setItem("user", JSON.stringify(user));
};

export const clearAuth = () => {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
};
