import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Ücretsiz Kayıt Ol",
  description:
    "Bondley'e ücretsiz kayıt olun. Türkiye'nin tahvil analiz platformunda YTM, kirly fiyat, birikmiş faiz ve spread hesaplaması yapın.",
  alternates: { canonical: "https://bondley.one/signup" },
};

export default function SignupLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
