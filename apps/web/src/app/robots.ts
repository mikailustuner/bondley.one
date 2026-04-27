import type { MetadataRoute } from "next";

const SITE_URL = "https://bondley.one";

const publicPaths = [
  "/",
  "/landing",
  "/tahvil",
  "/tahvil/",
  "/sss",
  "/sozluk",
  "/login",
  "/signup",
  "/gizlilik",
  "/kullanim-sartlari",
  "/iletisim",
];

const privatePaths = [
  "/dashboard/",
  "/admin/",
  "/api/",
  "/_next/",
  "/onboarding",
  "/maintenance",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      // Arama motoru botları — kısıtlama yok
      {
        userAgent: ["Googlebot", "Bingbot", "Applebot", "DuckDuckBot", "YandexBot"],
        allow: publicPaths,
        disallow: privatePaths,
      },
      // Kötü/scraper botlar — tamamen engel
      {
        userAgent: [
          "AhrefsBot",
          "MJ12bot",
          "DotBot",
          "BLEXBot",
          "SeznamBot",
          "PetalBot",
          "DataForSeoBot",
          "Bytespider",
        ],
        disallow: ["/"],
      },
      // Diğer tüm botlar — crawl delay ile izin
      {
        userAgent: "*",
        allow: publicPaths,
        disallow: privatePaths,
        crawlDelay: 10,
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
