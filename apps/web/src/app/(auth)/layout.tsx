import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Giriş Yap",
  description:
    "Bondley hesabınıza giriş yapın. Türkiye tahvil ve bono piyasasında YTM, kirly fiyat ve spread analizi yapın.",
  alternates: { canonical: "https://bondley.one/login" },
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
