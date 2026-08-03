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
      <div className="bondley-auth-brand">
        <Link href="/landing">BONDLEY</Link>
        <a href="https://aurict.com" target="_blank" rel="noreferrer">× AURICT ↗</a>
      </div>
      <span className="bondley-auth-index">SECURE ACCESS / 01</span>
      {children}
    </div>
  );
}
