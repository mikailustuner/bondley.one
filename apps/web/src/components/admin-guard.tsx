"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getToken, isAdmin } from "@/lib/auth";

export function AdminGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.replace("/login");
      return;
    }
    if (!isAdmin()) {
      router.replace("/dashboard");
    }
  }, [router]);

  if (typeof window === "undefined") return null;
  if (!getToken()) return null;
  if (!isAdmin()) return null;

  return <>{children}</>;
}
