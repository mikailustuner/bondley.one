"use client";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { tr } from "@/locales/tr";
import { Shield, Users, Rocket, Target } from "lucide-react";

export default function HakkimizdaPage() {
  const content = tr.landing.hakkimizda;

  return (
    <div className="min-h-screen bg-background selection:bg-primary/10">
      <div className="container mx-auto py-16 px-4 max-w-4xl animate-fade-in">
        <div className="mb-10">
          <Link
            href="/landing"
            className="group flex items-center gap-2 text-[14px] text-muted-foreground hover:text-primary transition-all duration-300"
          >
            <span className="group-hover:-translate-x-1 transition-transform">←</span>
            {tr.common.backToHome}
          </Link>
        </div>

        <div className="space-y-12">
          {/* Hero Section */}
          <header className="text-center space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-[12px] font-semibold tracking-wider uppercase">
              <Shield className="w-3.5 h-3.5" />
              Bondley
            </div>
            <h1 className="text-[3.5rem] font-bold tracking-tight text-foreground leading-[1.1]">
              {content.title}
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              {content.description}
            </p>
          </header>

          {/* Main Content */}
          <div className="grid gap-8">
            <Card className="border-none bg-secondary/30 shadow-none overflow-hidden">
              <CardContent className="p-8 md:p-10 space-y-8">
                <div className="space-y-6">
                  <div className="flex items-start gap-5">
                    <div className="w-12 h-12 rounded-2xl bg-background flex items-center justify-center shrink-0 shadow-sm border border-border/50">
                      <Target className="w-6 h-6 text-primary" />
                    </div>
                    <p className="text-[17px] leading-relaxed text-foreground/90">
                      {content.content1}
                    </p>
                  </div>

                  <div className="h-px bg-border/50 w-full" />

                  <div className="flex items-start gap-5 p-6 rounded-2xl bg-primary/[0.03] border border-primary/10">
                    <div className="w-12 h-12 rounded-2xl bg-background flex items-center justify-center shrink-0 shadow-sm border border-border/50">
                      <Users className="w-6 h-6 text-primary" />
                    </div>
                    <p className="text-[17px] leading-relaxed text-foreground/90 font-medium">
                      {content.content2}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Vision Footer */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-8 p-8 rounded-3xl border border-border bg-card shadow-sm">
              <div className="space-y-2 text-center md:text-left">
                <h3 className="font-semibold text-lg flex items-center gap-2 justify-center md:justify-start">
                  <Rocket className="w-5 h-5 text-primary" />
                  Gelecek Vizyonumuz
                </h3>
                <p className="text-sm text-muted-foreground">
                  Faz 2 ve Faz 3 ile platformumuzu daha da güçlendirmeye devam ediyoruz.
                </p>
              </div>
              <Link href="/signup">
                <button className="px-8 py-3 rounded-2xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-all shadow-md hover:shadow-lg active:scale-[0.98]">
                  Hemen Katılın
                </button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fade-in 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>
    </div>
  );
}
