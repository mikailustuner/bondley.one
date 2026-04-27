import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "İletişim",
  description:
    "Bondley ekibiyle iletişime geçin. Soru, öneri veya destek talepleriniz için e-posta yoluyla bize ulaşabilirsiniz.",
  alternates: { canonical: "https://bondley.one/iletisim" },
};

export default function IletisimPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-12 px-4 max-w-4xl">
        <div className="mb-8">
          <Link
            href="/landing"
            className="text-data-sm text-muted-foreground hover:text-primary transition-colors"
          >
            ← Ana Sayfaya Dön
          </Link>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="text-display-md">İletişim</CardTitle>
            <CardDescription>Bizimle iletişime geçin</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Sorularınız, önerileriniz veya destek talepleriniz için bizimle iletişime geçebilirsiniz.
            </p>
            <div className="space-y-2">
              <p className="text-sm text-foreground">
                <strong>E-posta:</strong>{" "}
                <a
                  href="mailto:noreply@bondley.one"
                  className="text-primary hover:text-primary/80 transition-colors"
                >
                  noreply@bondley.one
                </a>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
