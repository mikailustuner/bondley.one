import { PublicShell } from "@/components/public/PublicShell";

export default function TermsLayout({ children }: { children: React.ReactNode }) {
  return <PublicShell><div className="bondley-editorial">{children}</div></PublicShell>;
}
