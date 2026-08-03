import { PublicShell } from "@/components/public/PublicShell";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return <PublicShell><div className="bondley-public-content">{children}</div></PublicShell>;
}
