import type { Metadata } from "next";
import { PublicShell } from "@/components/public/PublicShell";

export const metadata: Metadata = {
  title: "Hakkımızda",
  description: "Bondley hakkında daha fazla bilgi edinin. Kimiz ve ne yapıyoruz?",
  alternates: { canonical: "https://bondley.one/hakkimizda" },
};

export default function HakkimizdaLayout({ children }: { children: React.ReactNode }) {
  return <PublicShell>{children}</PublicShell>;
}
