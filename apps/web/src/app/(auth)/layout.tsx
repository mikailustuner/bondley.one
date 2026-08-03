import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Giriş Yap",
  description:
    "Bondley hesabınıza giriş yapın. Türkiye tahvil ve bono piyasasında YTM, kirly fiyat ve spread analizi yapın.",
  alternates: { canonical: "https://bondley.one/login" },
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bondley-auth-shell">
      <Link href="/landing" className="bondley-auth-brand">BONDLEY <span>× AURICT</span></Link>
      <span className="bondley-auth-index">SECURE ACCESS / 01</span>
      {children}
    </div>
  );
}
