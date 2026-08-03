import type { Metadata } from "next";
import Link from "next/link";
import { PublicShell } from "@/components/public/PublicShell";
import styles from "./ContactPage.module.css";

export const metadata: Metadata = {
  title: "İletişim",
  description: "Bondley ekibiyle iletişime geçin.",
  alternates: { canonical: "https://bondley.one/iletisim" },
};

export default function IletisimPage() {
  return (
    <PublicShell>
      <main className={styles.page}>
        <section className={styles.hero}>
          <p className={styles.code}>BND / CONTACT<br />CHANNEL 01</p>
          <p className={styles.kicker}>BİZE ULAŞIN</p>
          <h1>Bir soru,<br /><em>doğrudan bize.</em></h1>
          <p className={styles.lead}>Ürün, veri, iş birliği veya destek. Mesajınızı doğru kişiye yönlendirelim.</p>
          <span className={styles.line} aria-hidden="true" />
        </section>

        <section className={styles.channels}>
          <p className={styles.side}>01 / E-POSTA</p>
          <a href="mailto:noreply@bondley.one" className={styles.mail}>
            <span>noreply</span><br />@bondley.one <b>↗</b>
          </a>
          <div className={styles.meta}>
            <span>YANIT SÜRESİ</span>
            <strong>1–2 iş günü</strong>
            <span>KONULAR</span>
            <strong>Destek · Veri · İş birliği</strong>
          </div>
        </section>

        <section className={styles.note}>
          <span>NOT</span>
          <p>Bir kıymetle ilgili yazıyorsanız ISIN kodunu, teknik bir sorun bildiriyorsanız kullandığınız tarayıcıyı eklemeniz süreci hızlandırır.</p>
          <Link href="/sss">Önce sık sorulanlara bak <b>→</b></Link>
        </section>
      </main>
    </PublicShell>
  );
}
