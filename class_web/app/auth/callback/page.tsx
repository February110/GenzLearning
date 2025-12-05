"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Simple callback page to finalize OAuth then send user to home (or classrooms overview).
export default function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    // Redirect immediately after session is established by NextAuth
    router.replace("/classrooms/overview");
  }, [router]);

  return null;
}
