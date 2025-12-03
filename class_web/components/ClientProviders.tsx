// components/ClientProviders.tsx
"use client";

import { ThemeProvider } from "next-themes";
import { SessionProvider, useSession } from "next-auth/react";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { useEffect } from "react";
import { resolveAvatar } from "@/utils/resolveAvatar";

/**
 * Đồng bộ accessToken (JWT backend) vào localStorage khi đăng nhập OAuth.
 * Dùng một component con để lắng nghe thay đổi session.
 */
function SessionSyncer() {
  const { data: session } = useSession();
  const { setUser } = useAuth();

  useEffect(() => {
    // Khi có session từ NextAuth
    const tokenFromSession = (session as any)?.accessToken;
    const basicUser = session?.user;

    if (tokenFromSession && basicUser) {
      // Lưu token backend & user tối thiểu để FE dùng (axios, guard, navbar)
      localStorage.setItem("token", tokenFromSession);
      const normalized = {
        id: (basicUser as any)?.id ?? (session as any)?.user?.id ?? "",
        fullName: basicUser.name ?? "",
        email: basicUser.email ?? "",
        avatar: (basicUser as any).image
          ? resolveAvatar((basicUser as any).image) || (basicUser as any).image
          : undefined,
        systemRole: (session as any)?.user?.systemRole || "User",
      };
      localStorage.setItem("user", JSON.stringify(normalized));
      setUser(normalized);
    }
  }, [session, setUser]);

  return null;
}

export default function ClientProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem storageKey="theme" disableTransitionOnChange>
      <SessionProvider>
        <AuthProvider>
          <SessionSyncer />
          {children}
        </AuthProvider>
      </SessionProvider>
    </ThemeProvider>
  );
}
