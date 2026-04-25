import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { InitialLoader } from "@/components/initial-loader";
import { MaintenanceGuard } from "@/components/maintenance-guard";
import { CookieConsentBanner } from "@/components/ui/cookie-consent";
import { ServiceWorkerRegistrar } from "@/components/service-worker-registrar";
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

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
};

export const metadata: Metadata = {
  metadataBase: new URL("https://bondley.one"),
  title: {
    default: tr.meta.title,
    template: "%s | Bondley",
  },
  description: tr.meta.description,
  manifest: "/manifest.json",
  icons: {
    icon: "/logo.png",
    apple: "/logo.png",
  },
  openGraph: {
    title: tr.meta.title,
    description: tr.meta.description,
    type: "website",
    locale: "tr_TR",
    siteName: "Bondley",
    url: "https://bondley.one",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "Bondley – Borçlanma Araçları Platformu" }],
  },
  twitter: {
    card: "summary_large_image",
    title: tr.meta.title,
    description: tr.meta.description,
    images: ["/og-image.png"],
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
          <ServiceWorkerRegistrar />
        </ThemeProvider>
      </body>
    </html>
  );
}
