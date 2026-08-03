import Image from "next/image";
import Link from "next/link";
import styles from "./PublicShell.module.css";

const navItems = [
  ["Piyasa", "/tahvil"],
  ["Sözlük", "/sozluk"],
  ["SSS", "/sss"],
  ["Hakkımızda", "/hakkimizda"],
] as const;

export function PublicShell({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Link href="/landing" className={styles.brand} aria-label="Bondley ana sayfa">
            <span className={styles.logoTile}>
              <Image src="/logo-mark.svg" alt="" width={44} height={44} priority />
            </span>
            <span className={styles.brandText}>bondley</span>
            <span className={styles.aurict}>an Aurict product</span>
          </Link>

          <nav className={styles.nav} aria-label="Ana menü">
            {navItems.map(([label, href]) => (
              <Link key={href} href={href}>{label}</Link>
            ))}
          </nav>

          <div className={styles.actions}>
            <Link href="/login" className={styles.login}>Giriş</Link>
            <Link href="/signup" className={styles.cta}>Ücretsiz başla <span>↗</span></Link>
          </div>
        </div>
      </header>

      <div className={styles.content}>{children}</div>

      <footer className={styles.footer}>
        <div className={styles.footerMark} aria-hidden="true">B</div>
        <div className={styles.footerMain}>
          <div>
            <p className={styles.footerLabel}>BORÇLANMA ARAÇLARI / TÜRKİYE</p>
            <p className={styles.footerStatement}>Piyasanın ritmini<br /><em>okunabilir</em> hale getirir.</p>
          </div>
          <div className={styles.footerLinks}>
            <Link href="/tahvil">Tahvil evreni</Link>
            <Link href="/sozluk">Finans sözlüğü</Link>
            <Link href="/iletisim">İletişim</Link>
            <Link href="/gizlilik">Gizlilik</Link>
            <Link href="/kullanim-sartlari">Kullanım şartları</Link>
          </div>
        </div>
        <div className={styles.footerBottom}>
          <span>© {new Date().getFullYear()} BONDLEY</span>
          <span>DESIGNED &amp; ENGINEERED BY AURICT</span>
          <span>İSTANBUL · TR</span>
        </div>
      </footer>
    </div>
  );
}
