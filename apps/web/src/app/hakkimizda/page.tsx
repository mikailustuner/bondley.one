import Link from "next/link";
import { tr } from "@/locales/tr";
import styles from "./AboutPage.module.css";

export default function HakkimizdaPage() {
  const content = tr.landing.hakkimizda;

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.index}>BND / 05<br />AURICT PRODUCT</div>
        <p className={styles.kicker}>HAKKIMIZDA · İSTANBUL</p>
        <h1>Borçlanma araçlarına<br /><em>başka bir açıdan.</em></h1>
        <div className={styles.orbit} aria-hidden="true"><span>100</span><i /></div>
        <p className={styles.coordinate}>41.0082° N<br />28.9784° E</p>
        <div className={styles.heroIntro}>
          <p className={styles.introLabel}>KİMLER İÇİN / 01</p>
          <p className={styles.lead}>{content.description}</p>
          <div className={styles.audiences} aria-label="Bondley kullanıcıları">
            <span>Hazine</span>
            <span>Fon &amp; portföy</span>
            <span>Operasyon</span>
            <span>Profesyonel yatırımcı</span>
          </div>
        </div>
      </section>

      <section className={styles.workflow}>
        <p className={styles.sectionNo}>01 / NEDEN</p>
        <div className={styles.workflowMain}>
          <h2>Kontrol süresi kısalır.<br /><em>Karar alanı genişler.</em></h2>
          <p>{content.content1}</p>
        </div>
        <div className={styles.workflowSteps}>
          <article><span>01 / TAKİP</span><h3>Güncel değeri görün.</h3><p>Kıymet detayları ve fiyatlama bileşenleri aynı çalışma alanında kalır.</p></article>
          <article><span>02 / KONTROL</span><h3>Hesabı doğrulayın.</h3><p>Manuel işlem yükünü azaltın, farklı kaynaklar arasındaki sapmaları hızla belirleyin.</p></article>
          <article><span>03 / MUTABAKAT</span><h3>Günü güvenle kapatın.</h3><p>Operasyon ekipleri kontrole daha az, istisnalara ve kararlara daha fazla zaman ayırır.</p></article>
        </div>
      </section>

      <section className={styles.principles}>
        <div className={styles.rule} aria-hidden="true" />
        <p className={styles.sectionNo}>02 / YAKLAŞIM</p>
        <div className={styles.principleGrid}>
          <article>
            <span>01</span>
            <h2>Doğru veri.</h2>
            <p>Her sayı kaynağı, zamanı ve bağlamıyla birlikte anlam kazanır.</p>
          </article>
          <article>
            <span>02</span>
            <h2>Şeffaf model.</h2>
            <p>Hesaplamanın nasıl oluştuğu, sonuç kadar görünür olmalı.</p>
          </article>
          <article>
            <span>03</span>
            <h2>Sessiz arayüz.</h2>
            <p>Dikkat dekorasyona değil, karar anındaki kritik veriye gider.</p>
          </article>
        </div>
      </section>

      <section className={styles.aurictBlock}>
        <p className={styles.sectionNo}>03 / KÖKEN</p>
        <div>
          <a href="https://aurict.com" target="_blank" rel="noreferrer" className={styles.aurictEyebrow}>BONDLEY × AURICT ↗</a>
          <h2>Finans için tasarlanmış.<br /><em><a href="https://aurict.com" target="_blank" rel="noreferrer">Aurict</a> tarafından üretilmiş.</em></h2>
        </div>
        <p className={styles.aurictCopy}>{content.content2}</p>
      </section>

      <section className={styles.cta}>
        <span>PIYASAYI OKUMAYA BAŞLA</span>
        <h2>Bir ISIN kodu.<br />Daha net bir karar.</h2>
        <Link href="/signup">Ücretsiz hesap oluştur <b>↗</b></Link>
      </section>
    </main>
  );
}
