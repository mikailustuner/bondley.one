import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Ana Sayfa — Bondley",
  description: "Tahvil değerleme ve analiz platformu. Piyasa verileri ve endeks takibi.",
};

export default function LandingLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
