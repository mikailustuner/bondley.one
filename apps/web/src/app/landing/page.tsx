"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { api, PublicSummary } from "@/lib/api-client";
import { formatDecimal, formatPercentFromDecimal, formatPercent, formatDate } from "@/lib/utils";

export default function LandingPage() {
  const [summary, setSummary] = useState<PublicSummary | null>(null);

  useEffect(() => {
    api.admin
      .publicSummary()
      .then(setSummary)
      .catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-background grain">
      <div className="data-strip" />

      <nav className="border-b border-border/50 backdrop-blur-md sticky top-0 z-50 bg-background/80">
        <div className="container mx-auto flex h-14 items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-7 w-7 rounded-sm bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-display font-bold text-[10px] tracking-tight">
                FC
              </span>
            </div>
            <span className="font-display font-semibold text-sm tracking-tight text-foreground">
              FinCalc
            </span>
            <span className="text-label text-muted-foreground hidden sm:inline ml-2">
              TERMINAL v1.0
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="text-data-sm text-muted-foreground hover:text-primary transition-colors"
            >
              Dashboard
            </Link>
            <ThemeToggle />
            <Link href="/signup">
              <Button variant="outline" size="sm">
                Kayit Ol
              </Button>
            </Link>
            <Link href="/login">
              <Button size="sm">Giris Yap</Button>
            </Link>
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
                BIST Borclanma Araclari
                <br />
                <span className="text-primary">Takip Terminali</span>
              </h1>
            </div>

            <p className="text-lg text-muted-foreground leading-relaxed max-w-xl animate-fade-up-delay-1 font-body">
              Borsa Istanbul BIST TLREF Endeks degerleri ve 2000+ borclanma aracini gercek zamanli
              takip edin. Tahvil listesi, tarihsel veriler, gunluk oranlar ve istatistiksel analiz
              tek bir terminalde.
            </p>

            <div className="flex items-center gap-4 pt-2 animate-fade-up-delay-2">
              <Link href="/signup">
                <Button size="lg">Ucretsiz Baslat</Button>
              </Link>
              <Link href="/login">
                <Button size="lg" variant="outline">
                  Giris Yap
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
              desc: "Devlet tahvili, hazine bonosu, ozel sektor tahvili, kira sertifikasi ve daha fazlasi BIST'ten otomatik cekilir.",
            },
            {
              number: "1.679+",
              label: "TLREF KAYIT",
              desc: "Haziran 2019'dan bu yana tum BIST TLREF Endeks degerleri otomatik olarak cekilir ve saklanir.",
            },
            {
              number: "18:30",
              label: "OTOMATIK GUNCELLEME",
              desc: "Her is gunu Borsa Istanbul'dan gunluk TLREF endeks degeri ve tahvil listesi otomatik cekilir.",
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
        <div className="container mx-auto flex items-center justify-between">
          <span className="text-label text-muted-foreground">&copy; 2026 FINCALC</span>
          <span className="text-label text-muted-foreground">ISTANBUL, TURKIYE</span>
        </div>
      </footer>
    </div>
  );
}
