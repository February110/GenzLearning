// components/AuthGuard.tsx
"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useSession } from "next-auth/react";

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();                  // local
  const { status } = useSession();             // OAuth

  useEffect(() => {
    // Khi đang load session OAuth → chờ
    if (status === "loading") return;

    const isAuth = !!user || status === "authenticated";
    const isAuthPage = pathname === "/auth/login" || pathname === "/auth/register";

    if (!isAuth && !isAuthPage) {
      router.replace("/auth/login");
    }
  }, [user, status, pathname, router]);

  if (status === "loading") {
    return <div className="flex items-center justify-center min-h-[40vh] text-gray-500">Đang kiểm tra đăng nhập...</div>;
  }

  return <>{children}</>;
}
