import type { Metadata, Viewport } from "next";
import { ThemeProvider } from "@/components/theme-provider";
import { MaintenanceGuard } from "@/components/maintenance-guard";
import { CookieConsentBanner } from "@/components/ui/cookie-consent";
import "./globals.css";
import { tr } from "@/locales/tr";

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
    icon: "/logo-mark.svg",
    apple: "/logo-mark.svg",
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
      suppressHydrationWarning
    >
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font -- Runtime loading keeps production builds independent from Google Fonts. */}
        <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600;700&family=Source+Serif+4:ital,wght@0,400;0,500;0,600;0,700;1,500;1,600&display=swap" rel="stylesheet" />
      </head>
      <body className="antialiased">
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} disableTransitionOnChange>
          <MaintenanceGuard>
            {children}
          </MaintenanceGuard>
          <CookieConsentBanner />
        </ThemeProvider>
      </body>
    </html>
  );
}
