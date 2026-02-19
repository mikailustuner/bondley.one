"use client";

import { useRouter } from "next/navigation";
import { clearAuth } from "@/lib/auth";

export function LogoutButton({
  className = "",
  children = "Cikis",
}: { className?: string; children?: React.ReactNode }) {
  const router = useRouter();
  return (
    <button
      type="button"
      className={className}
      onClick={() => {
        clearAuth();
        router.push("/login");
      }}
    >
      {children}
    </button>
  );
}
