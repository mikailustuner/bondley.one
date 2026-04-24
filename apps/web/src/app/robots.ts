import type { MetadataRoute } from "next";

const SITE_URL = "https://bondley.one";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/landing", "/login", "/signup", "/gizlilik", "/kullanim-sartlari", "/iletisim"],
        disallow: ["/dashboard/", "/admin/", "/api/", "/_next/"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
