import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { InitialLoader } from "@/components/initial-loader";
import { MaintenanceGuard } from "@/components/maintenance-guard";
import { CookieConsentBanner } from "@/components/ui/cookie-consent";
import "./globals.css";
import { tr } from "@/locales/tr";

const inter = Inter({
  subsets: ["latin", "latin-ext"],
  variable: "--font-inter",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono-data",
  display: "swap",
});

export const metadata: Metadata = {
  title: tr.meta.title,
  description: tr.meta.description,
  icons: {
    icon: "/logo.png",
    apple: "/logo.png",
  },
  openGraph: {
    title: tr.meta.title,
    description: tr.meta.description,
    type: "website",
    locale: "tr_TR",
  },
  twitter: {
    card: "summary_large_image",
    title: tr.meta.title,
    description: tr.meta.description,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="tr"
      className={`${inter.variable} ${jetbrainsMono.variable}`}
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
