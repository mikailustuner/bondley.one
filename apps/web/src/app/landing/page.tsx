"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserMenu } from "@/components/user-menu";
import {
  UserPlus,
  Search,
  BarChart3,
  List,
  LineChart,
  Star,
  Bell,
  Calculator,
  TrendingUp,
  Shield,
  RefreshCw,
  Lock,
  ArrowRight,
  ChevronRight,
  Zap,
} from "lucide-react";
import { getUser } from "@/lib/auth";
import { api, PublicSummary } from "@/lib/api-client";
import {
  formatDecimal,
  formatPercentFromDecimal,
  formatPercent,
  formatDate,
} from "@/lib/utils";

export default function LandingPage() {
  const [summary, setSummary] = useState<PublicSummary | null>(null);
  const [mounted, setMounted] = useState(false);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    setMounted(true);
    setUser(getUser());
  }, []);

  useEffect(() => {
    api.admin
      .publicSummary()
      .then(setSummary)
      .catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      {/* ═══════ Navbar ═══════ */}
      <nav className="apple-navbar sticky top-0 z-50">
        <div className="container mx-auto flex h-14 items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <Image
              src="/logo.png"
              alt="Bondley Logo"
              width={28}
              height={28}
              className="h-7 w-7 object-contain"
              priority
            />
            <span className="font-semibold text-[16px] tracking-tight text-foreground">
              Bondley
            </span>
          </Link>
          <div className="flex items-center gap-3">
            {mounted && user ? (
              <>
                <Link
                  href="/dashboard"
                  className="text-[14px] text-muted-foreground hover:text-primary transition-colors font-medium"
                >
                  Dashboard
                </Link>
                <ThemeToggle />
                <UserMenu position="bottom" />
              </>
            ) : (
              <>
                <ThemeToggle />
                <Link href="/login">
                  <Button variant="ghost" size="sm" className="text-[14px]">
                    Giriş Yap
                  </Button>
                </Link>
                <Link href="/signup">
                  <Button size="sm" className="text-[14px]">
                    Ücretsiz Başlat
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* ═══════ Hero — full-width, Apple keynote style ═══════ */}
      <section className="relative pt-32 pb-28 overflow-hidden">
        {/* Subtle background gradient */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] rounded-full bg-primary/[0.04] blur-[120px]" />
        </div>

        <div className="container mx-auto text-center relative z-10">
          <div className="animate-fade-up">
            <div className="inline-flex items-center gap-2.5 rounded-full border border-primary/15 bg-primary/5 px-5 py-2 mb-10">
              <span className="h-1.5 w-1.5 rounded-full bg-positive live-indicator" />
              <span className="text-[13px] font-medium text-primary">
                Canlı Veri Akışı
              </span>
              <ChevronRight className="h-3.5 w-3.5 text-primary/50" />
            </div>
          </div>

          <h1 className="text-display-xl md:text-[4.5rem] md:leading-[1.04] lg:text-[5.5rem] lg:leading-[1.02] text-foreground tracking-tight max-w-4xl mx-auto animate-fade-up">
            Tahvil değerleme.
            <br />
            <span className="text-primary">Yeniden tanımlandı.</span>
          </h1>

          <p className="text-body-lg md:text-[1.25rem] md:leading-[1.6] text-muted-foreground max-w-2xl mx-auto mt-8 animate-fade-up-delay-1">
            Borsa İstanbul borçlanma araçlarını gerçek zamanlı takip edin.
            TLREF endeks, getiri analizi ve risk hesaplamalarını
            tek bir platformda birleştirdik.
          </p>

          <div className="flex items-center justify-center gap-4 mt-10 animate-fade-up-delay-2">
            <Link href="/signup">
              <Button size="lg" className="px-8 text-[17px] h-14 rounded-2xl shadow-md hover:shadow-lg">
                Ücretsiz Başlat
                <ArrowRight className="h-5 w-5 ml-1" />
              </Button>
            </Link>
            <Link href="/login">
              <Button
                size="lg"
                variant="outline"
                className="px-8 text-[17px] h-14 rounded-2xl"
              >
                Giriş Yap
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ═══════ Live Data Ticker — Apple product spec style ═══════ */}
      <section className="container mx-auto pb-24">
        <div className="animate-fade-up-delay-3">
          <div className="rounded-3xl border border-border bg-card shadow-[0_4px_24px_rgba(0,0,0,0.06)] overflow-hidden">
            <div className="px-8 py-5 border-b border-border/50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="h-2 w-2 rounded-full bg-positive live-indicator" />
                <span className="text-[15px] font-semibold text-foreground">
                  Canlı Piyasa Verisi
                </span>
              </div>
              <span className="text-[13px] text-muted-foreground">
                {summary?.tlref_date ? formatDate(summary.tlref_date) : "—"}
              </span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7">
              {[
                {
                  label: "TLREF Endeks",
                  value: formatDecimal(summary?.tlref_index, 2),
                  highlight: true,
                  large: true,
                },
                ...(summary?.tlref_index_change_pct != null
                  ? [
                      {
                        label: "Düne Göre",
                        value: `${summary!.tlref_index_change_pct >= 0 ? "+" : ""}${summary!.tlref_index_change_pct}%`,
                        positive: summary!.tlref_index_change_pct >= 0,
                      },
                    ]
                  : [{ label: "Düne Göre", value: "—" }]),
                {
                  label: "Günlük Oran",
                  value: formatPercentFromDecimal(summary?.tlref_daily_rate, 4),
                  positive: true,
                },
                {
                  label: "Yıllık Oran",
                  value:
                    summary?.tlref_annualized_rate != null
                      ? formatPercent(summary.tlref_annualized_rate)
                      : "—",
                },
                {
                  label: "Aktif Araç",
                  value: formatDecimal(summary?.total_bonds, 0),
                },
                {
                  label: "TLREF Kayıt",
                  value: formatDecimal(summary?.total_tlref_records, 0),
                },
                { label: "Son Tarih", value: formatDate(summary?.tlref_date) },
              ].map((item, i) => (
                <div
                  key={i}
                  className="flex flex-col justify-center px-6 py-6 border-b md:border-b-0 md:border-r border-border/30 last:border-0"
                >
                  <span className="text-[11px] font-medium text-muted-foreground/70 uppercase tracking-wider mb-1.5">
                    {item.label}
                  </span>
                  <span
                    className={`font-mono-data ${
                      (item as any).large
                        ? "text-[1.75rem] font-bold leading-none"
                        : "text-[1.125rem] font-semibold leading-tight"
                    } ${
                      (item as any).highlight
                        ? "text-primary"
                        : (item as any).positive
                          ? "text-positive"
                          : "text-foreground"
                    }`}
                  >
                    {item.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ═══════ How it Works — 3 steps, expansive ═══════ */}
      <section className="py-28 bg-secondary/30">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <span className="text-[13px] font-medium text-primary uppercase tracking-wider">
              Nasıl Çalışır
            </span>
            <h2 className="text-display-lg md:text-[2.75rem] text-foreground mt-3 tracking-tight">
              Üç adımda başlayın.
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-8 lg:gap-14">
            {[
              {
                icon: UserPlus,
                step: "01",
                title: "Kayıt olun",
                desc: "Ücretsiz hesap oluşturun. E-posta doğrulamasından sonra tüm verilere erişebilirsiniz.",
              },
              {
                icon: Search,
                step: "02",
                title: "Araç keşfedin",
                desc: "ISIN kodu veya ihraççıya göre arama yapın. 2.100+ borçlanma aracını filtreleyin, karşılaştırın.",
              },
              {
                icon: BarChart3,
                step: "03",
                title: "Analiz edin",
                desc: "Vadeye getiri, kirli fiyat, modifiye durasyon ve senaryo analizi ile riskinizi ölçün.",
              },
            ].map((item) => (
              <div
                key={item.step}
                className="group relative bg-card rounded-3xl border border-border p-8 shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)] transition-all duration-300"
              >
                <span className="text-[4rem] font-bold text-border/70 leading-none absolute top-6 right-8 select-none pointer-events-none">
                  {item.step}
                </span>
                <div className="relative z-10">
                  <div className="rounded-2xl bg-primary/8 w-14 h-14 flex items-center justify-center mb-6">
                    <item.icon className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="font-semibold text-[20px] text-foreground mb-3 tracking-tight">
                    {item.title}
                  </h3>
                  <p className="text-[15px] text-muted-foreground leading-relaxed">
                    {item.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════ Stats Callout — Apple number band ═══════ */}
      <section className="py-28">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <span className="text-[13px] font-medium text-primary uppercase tracking-wider">
              Rakamlarla Bondley
            </span>
            <h2 className="text-display-lg md:text-[2.75rem] text-foreground mt-3 tracking-tight">
              Piyasayı yakından takip edin.
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                number: "2.100+",
                label: "Borçlanma Aracı",
                desc: "Devlet tahvili, hazine bonosu, özel sektör tahvili, kira sertifikası ve VDMK.",
                icon: List,
              },
              {
                number: "1.679+",
                label: "TLREF Kayıt",
                desc: "Haziran 2019'dan bugüne, tüm BIST TLREF Endeks verilerinin tarihsel arşivi.",
                icon: LineChart,
              },
              {
                number: "18:30",
                label: "Otomatik Güncelleme",
                desc: "Her iş günü Borsa İstanbul'dan otomatik veri çekimi ve dağıtım.",
                icon: RefreshCw,
              },
            ].map((item) => (
              <div
                key={item.label}
                className="bg-card rounded-3xl border border-border p-10 shadow-[0_1px_3px_rgba(0,0,0,0.04)] text-center hover:shadow-[0_4px_16px_rgba(0,0,0,0.06)] transition-shadow"
              >
                <div className="rounded-2xl bg-primary/8 w-14 h-14 flex items-center justify-center mx-auto mb-6">
                  <item.icon className="h-6 w-6 text-primary" />
                </div>
                <div className="font-mono-data text-[2.5rem] font-bold text-primary leading-none mb-3 tracking-tight">
                  {item.number}
                </div>
                <div className="text-[15px] font-semibold text-foreground mb-3">
                  {item.label}
                </div>
                <p className="text-[15px] text-muted-foreground leading-relaxed max-w-xs mx-auto">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════ Features Grid — Apple icon grid ═══════ */}
      <section className="py-28 bg-secondary/30">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <span className="text-[13px] font-medium text-primary uppercase tracking-wider">
              Özellikler
            </span>
            <h2 className="text-display-lg md:text-[2.75rem] text-foreground mt-3 tracking-tight">
              Her ihtiyacınız için.
            </h2>
            <p className="text-[17px] text-muted-foreground mt-4 max-w-xl mx-auto">
              Profesyonel yatırımcılar için tasarlanmış kapsamlı araç seti.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: List,
                title: "Borçlanma Araçları",
                desc: "Para birimi, vade, getiri türü ve ihraççıya göre gelişmiş filtreleme. 2.100+ aktif araç.",
              },
              {
                icon: LineChart,
                title: "TLREF Grafikleri",
                desc: "Tarihsel endeks değeri ve günlük oran grafikleri. İnteraktif ve dışa aktarılabilir.",
              },
              {
                icon: Star,
                title: "Favoriler & Watchlist",
                desc: "Sık takip ettiğiniz araçları favorilere ekleyin. Dashboard'dan tek tıkla erişin.",
              },
              {
                icon: Bell,
                title: "Akıllı Uyarılar",
                desc: "YTM eşiği, TLREF oran değişimi veya vadeye kalan gün koşuluna göre e-posta bildirimleri.",
              },
              {
                icon: Calculator,
                title: "Getiri & Risk",
                desc: "Vadeye getiri (YTM), kirli fiyat, modifiye durasyon, konveksite ve senaryo analizi.",
              },
              {
                icon: TrendingUp,
                title: "Piyasa Verisi",
                desc: "Temiz fiyat, kirli fiyat, kupon ödeme planı ve KAP bildirim verileri tek ekranda.",
              },
            ].map((item) => (
              <div
                key={item.title}
                className="group rounded-3xl border border-border bg-card p-8 shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)] transition-all duration-300"
              >
                <div className="rounded-2xl bg-primary/8 w-12 h-12 flex items-center justify-center mb-5 group-hover:bg-primary/12 transition-colors">
                  <item.icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="font-semibold text-[17px] text-foreground mb-2 tracking-tight">
                  {item.title}
                </h3>
                <p className="text-[15px] text-muted-foreground leading-relaxed">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════ CTA Banner ═══════ */}
      <section className="py-28">
        <div className="container mx-auto">
          <div className="rounded-3xl bg-primary/[0.04] border border-primary/10 p-16 text-center relative overflow-hidden">
            {/* Subtle glow */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] rounded-full bg-primary/[0.06] blur-[100px] pointer-events-none" />
            <div className="relative z-10">
              <Zap className="h-10 w-10 text-primary mx-auto mb-6" />
              <h2 className="text-display-lg md:text-[2.75rem] text-foreground tracking-tight mb-4">
                Hemen başlayın.
              </h2>
              <p className="text-[17px] text-muted-foreground max-w-lg mx-auto mb-10">
                Ücretsiz hesap oluşturun ve Türkiye borçlanma araçları
                piyasasını profesyonel araçlarla analiz etmeye başlayın.
              </p>
              <div className="flex items-center justify-center gap-4">
                <Link href="/signup">
                  <Button size="lg" className="px-8 text-[17px] h-14 rounded-2xl shadow-md">
                    Ücretsiz Hesap Oluştur
                    <ArrowRight className="h-5 w-5 ml-1" />
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════ Trust Bar ═══════ */}
      <section className="container mx-auto pb-20">
        <div className="flex flex-wrap justify-center gap-x-16 gap-y-6">
          {[
            { icon: Shield, text: "BIST resmî veri kaynağı" },
            { icon: RefreshCw, text: "Her iş günü otomatik güncelleme" },
            { icon: Lock, text: "Güvenli hesap & 2FA desteği" },
          ].map((item) => (
            <div key={item.text} className="flex items-center gap-3">
              <item.icon className="h-5 w-5 text-primary/70 shrink-0" />
              <span className="text-[15px] text-muted-foreground">
                {item.text}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* ═══════ Footer ═══════ */}
      <footer className="border-t border-border/50">
        <div className="container mx-auto py-10">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2.5">
              <Image
                src="/logo.png"
                alt="Bondley"
                width={20}
                height={20}
                className="h-5 w-5 object-contain opacity-60"
              />
              <span className="text-[13px] text-muted-foreground">
                &copy; 2026 Bondley
              </span>
            </div>
            <div className="flex items-center gap-8 text-[13px] text-muted-foreground">
              <Link
                href="/gizlilik"
                className="hover:text-primary transition-colors"
              >
                Gizlilik
              </Link>
              <Link
                href="/kullanim-sartlari"
                className="hover:text-primary transition-colors"
              >
                Kullanım Şartları
              </Link>
              <Link
                href="/iletisim"
                className="hover:text-primary transition-colors"
              >
                İletişim
              </Link>
            </div>
            <span className="text-[13px] text-muted-foreground/50">
              İstanbul, Türkiye
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
