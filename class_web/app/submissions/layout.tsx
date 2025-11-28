"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import ClassroomSidebar from "@/components/classrooms/Sidebar";
import AdminTopbar from "@/components/admin/Topbar";
import { useAuth } from "@/context/AuthContext";

export default function SubmissionsLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace("/auth/login");
  }, [user, loading, router]);

  if (loading || !user) {
    return <div className="min-h-screen flex items-center justify-center text-gray-500">Đang kiểm tra đăng nhập...</div>;
  }

  return (
    <div className="min-h-screen flex bg-gray-50 dark:bg-black">
      <ClassroomSidebar />
      <div className="flex-1 flex flex-col">
        <AdminTopbar />
        <main className="p-4 md:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
