"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

export default function RedirectByRole() {
  const router = useRouter();
  const { data: session, status } = useSession();

  useEffect(() => {
    if (status === "loading") return;

    try {
      const roleFromSession = (session?.user as any)?.systemRole as string | undefined;
      const raw = typeof window !== "undefined" ? localStorage.getItem("user") : null;
      const user = raw ? JSON.parse(raw) : null;
      const role = (roleFromSession || user?.systemRole || "").toLowerCase();

      if (role === "admin") {
        router.replace("/admin");
      } else {
        router.replace("/classrooms");
      }
    } catch {
      router.replace("/classrooms");
    }
  }, [router, session, status]);

  return null;
}
