import type { MetadataRoute } from "next";

const SITE_URL = "https://bondley.one";
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

async function fetchPublicBonds(): Promise<Array<{ isin_code: string; updated_at: string | null }>> {
  try {
    const res = await fetch(`${API_BASE}/system/public-bonds?limit=2000`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const bonds = await fetchPublicBonds();

  const staticPages: MetadataRoute.Sitemap = [
    { url: SITE_URL, lastModified: new Date("2025-01-01"), changeFrequency: "weekly", priority: 1.0 },
    { url: `${SITE_URL}/landing`, lastModified: new Date("2025-01-01"), changeFrequency: "weekly", priority: 1.0 },
    { url: `${SITE_URL}/tahvil`, lastModified: new Date(), changeFrequency: "daily", priority: 0.9 },
    { url: `${SITE_URL}/sss`, lastModified: new Date("2025-01-01"), changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE_URL}/sozluk`, lastModified: new Date("2025-01-01"), changeFrequency: "monthly", priority: 0.7 },
    { url: `${SITE_URL}/signup`, lastModified: new Date("2025-01-01"), changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE_URL}/login`, lastModified: new Date("2025-01-01"), changeFrequency: "monthly", priority: 0.6 },
    { url: `${SITE_URL}/gizlilik`, lastModified: new Date("2025-01-01"), changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE_URL}/kullanim-sartlari`, lastModified: new Date("2025-01-01"), changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE_URL}/iletisim`, lastModified: new Date("2025-01-01"), changeFrequency: "yearly", priority: 0.4 },
  ];

  const bondPages: MetadataRoute.Sitemap = bonds.map((b) => ({
    url: `${SITE_URL}/tahvil/${b.isin_code}`,
    lastModified: b.updated_at ? new Date(b.updated_at) : new Date(),
    changeFrequency: "daily" as const,
    priority: 0.7,
  }));

  return [...staticPages, ...bondPages];
}
