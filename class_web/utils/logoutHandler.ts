"use client";

import { signOut } from "next-auth/react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";

export function useLogoutHandler() {
  const { logout } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    try {
      // Xóa session OAuth (nếu đang dùng NextAuth)
      await signOut({ redirect: false });

      // Xóa token local
      logout();

      // Xóa cookie token backend nếu có
      if (typeof document !== "undefined") {
        document.cookie = "token=; path=/; max-age=0;";
      }

      // Điều hướng về trang đăng nhập
      router.replace("/auth/login");
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };

  return { handleLogout };
}
