import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Giriş — Bondley",
  description: "Bondley hesabınıza giriş yapın",
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
