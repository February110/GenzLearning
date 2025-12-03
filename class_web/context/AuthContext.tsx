"use client";

import { createContext, useContext, useEffect, useState } from "react";
import api from "@/api/client";
import { resolveAvatar } from "@/utils/resolveAvatar";

type UserLite = {
  id?: string;
  fullName: string;
  email: string;
  avatar?: string;
  systemRole?: string;
};

type Ctx = {
  user: UserLite | null;
  setUser: (u: UserLite | null) => void;
  logout: () => void;
  loading: boolean;
};

const AuthContext = createContext<Ctx>({
  user: null,
  setUser: () => {},
  logout: () => {},
  loading: true,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserLite | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("user");
      if (saved) setUser(JSON.parse(saved));
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    const syncProfile = async () => {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
      if (!token) return;
      try {
        const { data } = await api.get("/auth/me");
        if (!data) return;
        const normalized: UserLite = {
          id: data.id ?? data.Id ?? user?.id,
          fullName: data.fullName ?? data.FullName ?? user?.fullName ?? "",
          email: data.email ?? user?.email ?? "",
          systemRole: data.systemRole ?? user?.systemRole,
          avatar: data.avatar ? resolveAvatar(data.avatar) || data.avatar : user?.avatar,
        };
        setUser(normalized);
        localStorage.setItem("user", JSON.stringify(normalized));
      } catch {
      }
    };
    syncProfile();
  }, []);

  const logout = () => {
    localStorage.removeItem("user");
    localStorage.removeItem("token");
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, setUser, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
