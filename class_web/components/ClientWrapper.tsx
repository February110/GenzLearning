// components/ClientWrapper.tsx
"use client";

import ClientProviders from "@/components/ClientProviders";
import { Toaster } from "react-hot-toast";

/**
 * Quy ước:
 * - (site) group và các app shell (admin/classrooms) tự quản lý header/guard riêng
 * - Không còn dùng Navbar toàn cục do đã bỏ /submissions
 */
export default function ClientWrapper({ children }: { children: React.ReactNode }) {
  return (
    <ClientProviders>
      {children}
      <Toaster position="top-right" toastOptions={{ duration: 3000 }} />
    </ClientProviders>
  );
}

