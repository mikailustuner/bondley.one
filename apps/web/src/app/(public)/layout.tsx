import Link from "next/link";
import Image from "next/image";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b border-border/50 bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto flex h-14 items-center justify-between px-4 max-w-6xl">
          <Link href="/landing" className="flex items-center gap-2.5">
            <Image src="/logo.png" alt="Bondley" width={22} height={22} className="rounded" />
            <span className="font-semibold text-foreground text-sm">Bondley</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors hidden sm:inline"
            >
              Giriş Yap
            </Link>
            <Link
              href="/signup"
              className="text-sm bg-primary text-primary-foreground px-3 py-1.5 rounded-md hover:bg-primary/90 transition-colors font-medium"
            >
              Ücretsiz Başla
            </Link>
          </div>
        </div>
      </nav>
      {children}
      <footer className="border-t border-border/50 mt-16 py-8 text-center text-xs text-muted-foreground">
        <div className="container mx-auto flex flex-wrap justify-center gap-4">
          <Link href="/landing" className="hover:text-foreground transition-colors">Ana Sayfa</Link>
          <Link href="/tahvil" className="hover:text-foreground transition-colors">Tahvil Listesi</Link>
          <Link href="/sss" className="hover:text-foreground transition-colors">SSS</Link>
          <Link href="/sozluk" className="hover:text-foreground transition-colors">Sözlük</Link>
          <Link href="/iletisim" className="hover:text-foreground transition-colors">İletişim</Link>
          <Link href="/hakkimizda" className="hover:text-foreground transition-colors">Hakkımızda</Link>
          <Link href="/gizlilik" className="hover:text-foreground transition-colors">Gizlilik</Link>
        </div>
        <p className="mt-3">© {new Date().getFullYear()} Bondley. Tüm hakları saklıdır.</p>
      </footer>
    </div>
  );
}
