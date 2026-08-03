import { PublicShell } from "@/components/public/PublicShell";

export default function PrivacyLayout({ children }: { children: React.ReactNode }) {
  return <PublicShell><div className="bondley-editorial">{children}</div></PublicShell>;
}
