"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserMenu } from "@/components/user-menu";
import { getUser } from "@/lib/auth";
import { api, PublicSummary } from "@/lib/api-client";
import { formatDecimal, formatPercentFromDecimal, formatPercent, formatDate } from "@/lib/utils";

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
    <div className="min-h-screen bg-background grain">
      <div className="data-strip" />

      <nav className="border-b border-border/50 glass-surface sticky top-0 z-50">
        <div className="container mx-auto flex h-14 items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2.5">
              <Image
                src="/logo.png"
                alt="Bondley Logo"
                width={28}
                height={28}
                className="h-7 w-7 object-contain"
                priority
              />
              <span className="font-display font-semibold text-sm tracking-tight text-foreground">
                Bondley
              </span>
            </Link>
          </div>
          <div className="flex items-center gap-3">
            {mounted && user ? (
              <>
                <Link
                  href="/dashboard"
                  className="text-data-sm text-muted-foreground hover:text-primary transition-colors"
                >
                  Dashboard
                </Link>
                <ThemeToggle />
                <UserMenu />
              </>
            ) : (
              <>
                <Link
                  href="/dashboard"
                  className="text-data-sm text-muted-foreground hover:text-primary transition-colors"
                >
                  Dashboard
                </Link>
                <ThemeToggle />
                <Link href="/signup">
                  <Button variant="outline" size="sm">
                    Kayıt Ol
                  </Button>
                </Link>
                <Link href="/login">
                  <Button size="sm">Giriş Yap</Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      <section className="container mx-auto pt-24 pb-20">
        <div className="grid lg:grid-cols-12 gap-12 items-start">
          <div className="lg:col-span-7 space-y-8">
            <div className="animate-fade-up">
              <div className="inline-flex items-center gap-2 rounded-sm border border-primary/20 bg-primary/5 px-3 py-1.5 mb-6">
                <span className="h-1.5 w-1.5 rounded-full bg-positive live-indicator" />
                <span className="text-label text-primary">CANLI VERI AKISI</span>
              </div>

              <h1 className="font-display text-display-xl text-foreground">
                Tahvil Değerleme ve Analiz
                <br />
                <span className="text-primary">Platformu</span>
              </h1>
            </div>

            <p className="text-lg text-muted-foreground leading-relaxed max-w-xl animate-fade-up-delay-1 font-body">
              Borsa İstanbul BIST TLREF Endeks değerleri ve 2000+ borçlanma aracını gerçek zamanlı
              takip edin. Tahvil listesi, tarihsel veriler, günlük oranlar ve istatistiksel analiz
              tek bir terminalde.
            </p>

            <div className="flex items-center gap-4 pt-2 animate-fade-up-delay-2">
              <Link href="/signup">
                <Button size="lg">Ücretsiz Başlat</Button>
              </Link>
              <Link href="/login">
                <Button size="lg" variant="outline">
                  Giriş Yap
                </Button>
              </Link>
            </div>
          </div>

          <div className="lg:col-span-5 animate-fade-up-delay-3">
            <div className="rounded-lg border border-border bg-card p-5 grain">
              <div className="flex items-center justify-between mb-4">
                <span className="text-label text-muted-foreground">CANLI PIYASA VERISI</span>
                <span className="h-1.5 w-1.5 rounded-full bg-positive live-indicator" />
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-baseline border-b border-border/50 pb-3">
                  <span className="text-label text-muted-foreground">TLREF ENDEKS</span>
                  <span className="font-mono-data text-stat text-primary">
                    {formatDecimal(summary?.tlref_index, 2)}
                  </span>
                </div>

                <div className="flex justify-between items-baseline border-b border-border/50 pb-3">
                  <span className="text-label text-muted-foreground">GUNLUK ORAN</span>
                  <span className="font-mono-data text-data-sm text-positive">
                    {formatPercentFromDecimal(summary?.tlref_daily_rate, 4)}
                  </span>
                </div>

                <div className="flex justify-between items-baseline border-b border-border/50 pb-3">
                  <span className="text-label text-muted-foreground">YILLIK ORAN</span>
                  <span className="font-mono-data text-data-sm text-foreground">
                    {summary?.tlref_annualized_rate != null
                      ? formatPercent(summary.tlref_annualized_rate)
                      : "—"}
                  </span>
                </div>

                <div className="flex justify-between items-baseline border-b border-border/50 pb-3">
                  <span className="text-label text-muted-foreground">AKTIF TAHVIL</span>
                  <span className="font-mono-data text-data-sm text-primary">
                    {formatDecimal(summary?.total_bonds, 0)}
                  </span>
                </div>

                <div className="flex justify-between items-baseline border-b border-border/50 pb-3">
                  <span className="text-label text-muted-foreground">SON TARIH</span>
                  <span className="font-mono-data text-data-sm text-muted-foreground">
                    {formatDate(summary?.tlref_date)}
                  </span>
                </div>

                <div className="flex justify-between items-baseline">
                  <span className="text-label text-muted-foreground">TLREF KAYIT</span>
                  <span className="font-mono-data text-data-sm text-muted-foreground">
                    {formatDecimal(summary?.total_tlref_records, 0)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="data-strip" />

      <section className="container mx-auto py-20">
        <div className="grid md:grid-cols-3 gap-px bg-border/50 rounded-lg overflow-hidden">
          {[
            {
              number: "2.100+",
              label: "BORCLANMA ARACI",
              desc: "Devlet tahvili, hazine bonosu, özel sektör tahvili, kira sertifikası ve daha fazlası BIST'ten otomatik çekilir.",
            },
            {
              number: "1.679+",
              label: "TLREF KAYIT",
              desc: "Haziran 2019'dan bu yana tüm BIST TLREF Endeks değerleri otomatik olarak çekilir ve saklanır.",
            },
            {
              number: "18:30",
              label: "OTOMATIK GUNCELLEME",
              desc: "Her iş günü Borsa İstanbul'dan günlük TLREF endeks değeri ve tahvil listesi otomatik çekilir.",
            },
          ].map((item) => (
            <div key={item.label} className="bg-card p-8 grain">
              <div className="font-mono-data text-stat text-primary mb-3">{item.number}</div>
              <div className="text-label text-muted-foreground mb-3">{item.label}</div>
              <p className="text-sm text-muted-foreground/80 font-body leading-relaxed">
                {item.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-border/50 py-6">
        <div className="container mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <span className="text-label text-muted-foreground">&copy; 2026 Bondley</span>
            <div className="flex items-center gap-4 text-label text-muted-foreground">
              <Link href="/gizlilik" className="hover:text-primary transition-colors">
                Gizlilik Politikası
              </Link>
              <Link href="/kullanim-sartlari" className="hover:text-primary transition-colors">
                Kullanım Şartları
              </Link>
              <Link href="/iletisim" className="hover:text-primary transition-colors">
                İletişim
              </Link>
            </div>
            <span className="text-label text-muted-foreground">İstanbul, Türkiye</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
