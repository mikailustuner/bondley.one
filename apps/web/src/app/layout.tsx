import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { InitialLoader } from "@/components/initial-loader";
import { MaintenanceGuard } from "@/components/maintenance-guard";
import { CookieConsentBanner } from "@/components/ui/cookie-consent";
import "./globals.css";

const inter = Inter({
  subsets: ["latin", "latin-ext"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Bondley – Borçlanma Araçları Değerleme ve Analiz Platformu",
  description: "Borçlanma araçları değerleme, fiyat takibi ve analiz platformu. Tahvil, bono, kira sertifikası, VDMK. Piyasa verileri, endeks takibi ve kurumsal raporlama.",
  icons: {
    icon: "/logo.png",
    apple: "/logo.png",
  },
  openGraph: {
    title: "Bondley – Borçlanma Araçları Değerleme ve Analiz Platformu",
    description: "Borçlanma araçları değerleme, fiyat takibi ve analiz platformu. Tahvil, bono, kira sertifikası, VDMK. Piyasa verileri, endeks takibi ve kurumsal raporlama.",
    type: "website",
    locale: "tr_TR",
  },
  twitter: {
    card: "summary_large_image",
    title: "Bondley – Borçlanma Araçları Değerleme ve Analiz Platformu",
    description: "Borçlanma araçları değerleme, fiyat takibi ve analiz platformu. Tahvil, bono, kira sertifikası, VDMK. Piyasa verileri, endeks takibi ve kurumsal raporlama.",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="tr"
      className={inter.variable}
      suppressHydrationWarning
    >
      <body className="font-sans antialiased">
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} disableTransitionOnChange>
          <InitialLoader />
          <MaintenanceGuard>
            {children}
          </MaintenanceGuard>
          <CookieConsentBanner />
        </ThemeProvider>
      </body>
    </html>
  );
}
