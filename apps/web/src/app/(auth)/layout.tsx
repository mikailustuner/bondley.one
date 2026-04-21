import { tr } from "@/locales/tr";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: `${tr.auth.login.title} — ${tr.common.brand}`,
  description: `${tr.common.brand} ${tr.auth.login.subtitle.toLowerCase()}`,
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
