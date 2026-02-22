import type { Metadata } from "next";
import { Space_Grotesk, JetBrains_Mono, DM_Sans, IBM_Plex_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { InitialLoader } from "@/components/initial-loader";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-bond-nums",
  weight: ["400", "500", "600"],
  display: "swap",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Bondley – Tahvil Değerleme ve Analiz Platformu",
  description: "Tahvil değerleme, fiyat takibi ve analiz platformu. Piyasa verileri, endeks takibi ve kurumsal raporlama.",
  icons: {
    icon: "/logo.png",
    apple: "/logo.png",
  },
  openGraph: {
    title: "Bondley – Tahvil Değerleme ve Analiz Platformu",
    description: "Tahvil değerleme, fiyat takibi ve analiz platformu. Piyasa verileri, endeks takibi ve kurumsal raporlama.",
    type: "website",
    locale: "tr_TR",
  },
  twitter: {
    card: "summary_large_image",
    title: "Bondley – Tahvil Değerleme ve Analiz Platformu",
    description: "Tahvil değerleme, fiyat takibi ve analiz platformu. Piyasa verileri, endeks takibi ve kurumsal raporlama.",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="tr"
      className={`${spaceGrotesk.variable} ${jetbrainsMono.variable} ${ibmPlexMono.variable} ${dmSans.variable}`}
      suppressHydrationWarning
    >
      <body className="font-body antialiased">
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} disableTransitionOnChange>
          <InitialLoader />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
