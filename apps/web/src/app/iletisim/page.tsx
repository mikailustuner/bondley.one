import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "İletişim — Bondley",
  description: "Bondley iletişim bilgileri",
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
                  href="mailto:support@bondley.io"
                  className="text-primary hover:text-primary/80 transition-colors"
                >
                  support@bondley.io
                </a>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
