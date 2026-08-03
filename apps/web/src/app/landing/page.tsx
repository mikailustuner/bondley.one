"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { api, type PublicSummary } from "@/lib/api-client";
import { getUser } from "@/lib/auth";
import { APP_VERSION } from "@/lib/constants";
import { formatDate, formatDecimal, formatPercent } from "@/lib/utils";
import styles from "./LandingPage.module.css";

const productLayers = [
  {
    code: "01",
    label: "Piyasa evreni",
    title: "Aradığınız aracı saniyeler içinde daraltın.",
    detail: "Tahvil, bono, kira sertifikası ve VDMK'ları ISIN, ihraççı, vade, para birimi ve getiri türüne göre tarayın.",
    metric: "2.100+",
    metricLabel: "izlenebilir araç",
  },
  {
    code: "02",
    label: "Değerleme motoru",
    title: "Sonucu değil, hesabın tamamını görün.",
    detail: "Temiz ve kirli fiyat, YTM, birikmiş faiz, spread, durasyon ve konveksiteyi açık girdilerle yeniden üretin.",
    metric: "8",
    metricLabel: "temel risk ölçüsü",
  },
  {
    code: "03",
    label: "Operasyon takibi",
    title: "Yarının işini bugünden hazırlayın.",
    detail: "Kupon açıklamalarını, yaklaşan vadeleri ve oran hareketlerini favoriler ve koşullu uyarılarla takip edin.",
    metric: "T+1",
    metricLabel: "ileri görüş",
  },
] as const;

const methods = [
  ["Kaynak", "Borsa İstanbul", "Piyasa ve TLREF verileri resmî yayın akışından alınır."],
  ["Zaman", "Günlük güncelleme", "Veri tarihi sonuçla birlikte gösterilir; eski veri sessizce kullanılmaz."],
  ["Hesap", "Açık varsayımlar", "Girdi, gün sayımı ve formül bağlamı sonuçtan ayrılmaz."],
  ["Erişim", "Güvenli çalışma", "Hesap, oturum ve yetkiler çok katmanlı kontrollerle korunur."],
] as const;

export default function LandingPage() {
  const [summary, setSummary] = useState<PublicSummary | null>(null);
  const [user, setUser] = useState<ReturnType<typeof getUser>>(null);
  const [mounted, setMounted] = useState(false);
  const [filterDays, setFilterDays] = useState(1);

  useEffect(() => {
    setMounted(true);
    setUser(getUser());
  }, []);

  useEffect(() => {
    api.admin.publicSummary().then(setSummary).catch(() => undefined);
  }, []);

  const filteredBonds = useMemo(
    () => summary?.upcoming_bonds?.filter((bond) => bond.days_to_coupon === filterDays) ?? [],
    [filterDays, summary],
  );

  const primaryHref = mounted && user ? "/dashboard" : "/signup";
  const primaryLabel = mounted && user ? "Çalışma alanını aç" : "Ücretsiz başlayın";
  const change = summary?.tlref_index_change_pct;
  const agendaTitle = filterDays === 0
    ? "Bugün veri açıklayacaklar"
    : filterDays === 1
      ? "Yarın veri açıklayacaklar"
      : "2 gün sonra açıklayacaklar";

  return (
    <div className={styles.site}>
      <div className={styles.ambient} aria-hidden="true" />

      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Link className={styles.logoLockup} href="/landing" aria-label="Bondley ana sayfa">
            <span className={styles.logoFrame}><Image src="/logo-mark.svg" alt="" width={38} height={38} priority /></span>
            <span className={styles.wordmark}>bondley</span>
            <span className={styles.maker}>crafted by <b>Aurict</b></span>
          </Link>

          <nav className={styles.nav} aria-label="Ana menü">
            <a href="#platform">Platform</a>
            <a href="#calendar">Piyasa takvimi</a>
            <a href="#method">Metodoloji</a>
            <Link href="/hakkimizda">Hakkımızda</Link>
          </nav>

          <div className={styles.headerActions}>
            {!user && <Link className={styles.signIn} href="/login">Giriş yap</Link>}
            <Link className={styles.headerCta} href={primaryHref}>{mounted && user ? "Panele git" : "Ücretsiz başla"}<span>↗</span></Link>
          </div>
        </div>
      </header>

      <main>
        <section className={styles.hero}>
          <svg className={styles.heroCurve} viewBox="0 0 1380 1120" preserveAspectRatio="none" aria-hidden="true">
            <path d="M-80 870 C180 830 225 520 475 610 S760 940 930 555 S1190 180 1460 250" />
          </svg>
          <div className={styles.heroCoordinate}>41.0082° N · 28.9784° E</div>

          <div className={styles.heroCopy}>
            <div className={styles.eyebrow}><i /> Türkiye sabit getirili menkul kıymetler platformu</div>
            <h1>
              <span>Piyasanın</span>
              <span className={styles.heroIndent}>gürültüsünü değil,</span>
              <span className={styles.heroEditorial}>tahvilin gerçeğini</span>
              <span className={styles.heroOutline}>görün.</span>
            </h1>
            <p className={styles.heroLead}>Veriyi bulun, değerlemeyi kontrol edin ve bir sonraki piyasa hareketine hazırlanırken hiçbir varsayımı karanlıkta bırakmayın.</p>
            <div className={styles.heroActions}>
              <Link className={styles.primaryButton} href={primaryHref}>{primaryLabel}<span>→</span></Link>
              <a className={styles.textButton} href="#platform">Platformu keşfedin <span>↓</span></a>
            </div>
            <div className={styles.heroProof}>
              <div><strong>BIST</strong><span>doğrulanmış kaynak</span></div>
              <div><strong>2019—26</strong><span>TLREF tarihçesi</span></div>
              <div><strong>7/24</strong><span>erişilebilir analiz</span></div>
            </div>
          </div>

          <aside className={styles.heroAgenda} id="calendar">
            <span className={styles.agendaIndex}>01</span>
            <div className={styles.heroAgendaHead}>
              <div><span>YAKLAŞAN VERİ AKIŞI</span><i /></div>
              <small>{filteredBonds.length} araç</small>
            </div>
            <h2>{agendaTitle}</h2>
            <p>Kupon oranı ve ödeme verisi yaklaşan araçları piyasa açılmadan önce görün.</p>

            <div className={styles.filterGroup} role="group" aria-label="Gün filtresi">
              {[[0, "Bugün"], [1, "Yarın"], [2, "2 gün sonra"]].map(([day, label]) => (
                <button key={day} type="button" aria-pressed={filterDays === day} onClick={() => setFilterDays(Number(day))}>
                  <span>0{Number(day) + 1}</span>{label}
                </button>
              ))}
            </div>

            <div className={styles.calendarRows}>
              {filteredBonds.length > 0 ? filteredBonds.slice(0, 3).map((bond, index) => (
                <Link href={user ? `/dashboard/bonds/${bond.isin_code}` : "/signup"} key={bond.isin_code}>
                  <span className={styles.rowIndex}>{String(index + 1).padStart(2, "0")}</span>
                  <div><strong>{bond.isin_code}</strong><small>{bond.issuer || "İhraççı bilgisi bekleniyor"}</small></div>
                  <time><small>KUPON TARİHİ</small>{formatDate(bond.next_coupon_date)}</time>
                  <i>↗</i>
                </Link>
              )) : (
                <div className={styles.emptyCalendar}><i /><strong>Bu aralık sakin görünüyor.</strong><span>Açıklanacak araç bulunamadı.</span></div>
              )}
            </div>
            <div className={styles.calendarFoot}><span>BIST kaynaklı</span><span>{formatDate(summary?.tlref_date)}</span></div>
          </aside>

          <div className={styles.marketConsole} aria-label="Bondley piyasa görünümü">
            <span className={styles.consoleIndex}>02 / LIVE MARKET</span>
            <div className={styles.consoleTopbar}>
              <div><i /><span>BONDLEY MARKET PULSE</span></div>
              <time>{formatDate(summary?.tlref_date)}</time>
            </div>

            <div className={styles.consoleHeroMetric}>
              <div>
                <span>TLREF ENDEKS</span>
                <strong>{formatDecimal(summary?.tlref_index, 2)}</strong>
                <small data-negative={change != null && change < 0}>
                  {change == null ? "veri bekleniyor" : `${change >= 0 ? "▲" : "▼"} ${formatDecimal(Math.abs(change), 4, 4)}% günlük`}
                </small>
              </div>
              <div className={styles.rateMetric}>
                <span>YILLIK ORAN</span>
                <strong>{formatPercent(summary?.tlref_published_annual_rate_pct)}</strong>
              </div>
            </div>

            <div className={styles.curveChart}>
              <div className={styles.chartHeader}><span>PİYASA VADE EĞRİSİ</span><small>ürün görünümü</small></div>
              <svg viewBox="0 0 680 210" role="img" aria-label="Temsilî piyasa vade eğrisi">
                <defs>
                  <linearGradient id="bondleyArea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#28e0c3" stopOpacity=".32" />
                    <stop offset="1" stopColor="#28e0c3" stopOpacity="0" />
                  </linearGradient>
                  <linearGradient id="bondleyLine" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0" stopColor="#22c7d9" />
                    <stop offset="1" stopColor="#3af0bd" />
                  </linearGradient>
                </defs>
                <g className={styles.chartGrid}>
                  <path d="M20 35H660M20 85H660M20 135H660M20 185H660" />
                  <path d="M95 20V190M230 20V190M365 20V190M500 20V190M635 20V190" />
                </g>
                <path className={styles.chartArea} d="M20 159 C80 151,112 115,170 122 S260 158,320 125 S400 65,470 79 S565 111,660 45 L660 190 L20 190 Z" />
                <path className={styles.chartLine} d="M20 159 C80 151,112 115,170 122 S260 158,320 125 S400 65,470 79 S565 111,660 45" />
                <g className={styles.chartDots}><circle cx="170" cy="122" r="5" /><circle cx="320" cy="125" r="5" /><circle cx="470" cy="79" r="5" /><circle cx="660" cy="45" r="5" /></g>
              </svg>
              <div className={styles.chartLabels}><span>1A</span><span>3A</span><span>1Y</span><span>3Y</span><span>5Y+</span></div>
            </div>

            <div className={styles.consoleFooter}>
              <div><span>AKTİF ARAÇ</span><strong>{formatDecimal(summary?.total_bonds, 0)}</strong></div>
              <div><span>TLREF KAYIT</span><strong>{formatDecimal(summary?.total_tlref_records, 0)}</strong></div>
              <div><span>VERİ DURUMU</span><strong className={styles.online}><i /> GÜNCEL</strong></div>
            </div>
          </div>
        </section>

        <div className={styles.ticker} aria-label="Piyasa kapsamı">
          <div className={styles.tickerInner}>
            <span className={styles.tickerLabel}>BONDLEY EVRENİ</span>
            {["DİBS", "Özel sektör tahvilleri", "Finansman bonoları", "Kira sertifikaları", "VDMK", "TLREF"].map((item) => <span key={item}>{item}<i /></span>)}
          </div>
        </div>

        <section className={styles.platform} id="platform">
          <div className={styles.platformCurve} aria-hidden="true" />
          <div className={styles.sectionHeading}>
            <div><span>01 / PLATFORM</span><i /></div>
            <div><h2>Finansal kararın üç katmanı.<br /><em>Tek bir çalışma alanı.</em></h2><p>Bondley, piyasa verisini bir dashboard süsü olarak değil; keşif, hesap ve operasyon arasında çalışan bir karar altyapısı olarak ele alır.</p></div>
          </div>

          <div className={styles.layerGrid}>
            {productLayers.map((layer, index) => (
              <article key={layer.code} className={styles.layerCard} data-layer={index}>
                <div className={styles.layerTop}><span>{layer.code}</span><small>{layer.label}</small></div>
                <h3>{layer.title}</h3>
                <p>{layer.detail}</p>
                <div className={styles.layerMetric}><strong>{layer.metric}</strong><span>{layer.metricLabel}</span></div>
              </article>
            ))}
          </div>

          <div className={styles.analysisStrip}>
            <div className={styles.analysisLead}><span>ANALİZ SETİ</span><h3>Bir tahvil ekranından beklediğiniz her şey, aynı hesap bağlamında.</h3></div>
            <div className={styles.analysisItems}>
              {["YTM", "Kirli fiyat", "Birikmiş faiz", "Spread", "Macaulay", "Mod. durasyon", "Konveksite", "Senaryo"].map((item, index) => (
                <div key={item}><span>{String(index + 1).padStart(2, "0")}</span><strong>{item}</strong></div>
              ))}
            </div>
          </div>
        </section>

        <section className={styles.methodSection} id="method">
          <div className={styles.sectionHeading}>
            <div><span>02 / GÜVEN</span><i /></div>
            <div><h2>Güven bir rozet değil.<br /><em>Ürünün çalışma biçimi.</em></h2><p>Bondley’de her veri noktası ve her hesap, karar verirken ihtiyaç duyduğunuz izlenebilir bağlamla birlikte yaşar.</p></div>
          </div>

          <div className={styles.methodGrid}>
            {methods.map(([label, title, detail], index) => (
              <article key={label}>
                <div><span>{String(index + 1).padStart(2, "0")}</span><small>{label}</small></div>
                <h3>{title}</h3><p>{detail}</p>
              </article>
            ))}
          </div>

          <div className={styles.methodSignature}>
            <div><span className={styles.logoFrame}><Image src="/logo-mark.svg" alt="" width={48} height={48} /></span><span><b>Bondley standardı</b>Kaynağı görünür, hesabı tekrar üretilebilir.</span></div>
            <code>source → normalize → calculate → verify → monitor</code>
          </div>
        </section>

        <section className={styles.ctaSection}>
          <div className={styles.ctaGlow} />
          <span>BONDLEY İLE BAŞLAYIN</span>
          <h2>Piyasa hareket etmeden<br /><em>siz hazır olun.</em></h2>
          <p>Türkiye borçlanma araçları piyasasını tek, doğrulanabilir çalışma alanından takip edin.</p>
          <div><Link href={primaryHref}>{primaryLabel}<span>→</span></Link><Link href="/hakkimizda">Bondley'i tanıyın</Link></div>
        </section>
      </main>

      <footer className={styles.footer}>
        <div className={styles.footerMain}>
          <div className={styles.footerBrand}>
            <div><span className={styles.logoFrame}><Image src="/logo-mark.svg" alt="" width={36} height={36} /></span><strong>bondley</strong></div>
            <p>Türkiye sabit getirili menkul kıymetler piyasası için veri, değerleme ve takip platformu.</p>
            <span>an Aurict product</span>
          </div>
          <div className={styles.footerLinks}>
            <div><h3>Platform</h3><Link href="/dashboard/bonds">Araçlar</Link><Link href="/dashboard/analytics">Analiz</Link><Link href="/dashboard/alerts">Uyarılar</Link></div>
            <div><h3>Bilgi</h3><Link href="/tahvil">Tahvil rehberi</Link><Link href="/sozluk">Sözlük</Link><Link href="/sss">SSS</Link></div>
            <div><h3>Bondley</h3><Link href="/hakkimizda">Hakkımızda</Link><Link href="/iletisim">İletişim</Link></div>
            <div><h3>Yasal</h3><Link href="/gizlilik">Gizlilik</Link><Link href="/kullanim-sartlari">Kullanım şartları</Link></div>
          </div>
        </div>
        <div className={styles.footerBottom}><span>© 2026 Bondley · v{APP_VERSION}</span><span>İstanbul, Türkiye</span></div>
      </footer>
    </div>
  );
}
