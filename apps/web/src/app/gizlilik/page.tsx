import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Gizlilik Politikası — Bondley",
  description: "Bondley gizlilik politikası ve kişisel verilerin korunması",
};

export default function GizlilikPage() {
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
            <CardTitle className="text-display-md">Gizlilik Politikası</CardTitle>
            <CardDescription>Son güncelleme: Şubat 2026</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Bu sayfa hazırlanmaktadır. Bondley olarak kişisel verilerinizi KVKK (6698 sayılı Kişisel
              Verilerin Korunması Kanunu) kapsamında işliyoruz.
            </p>
            <p className="text-sm text-muted-foreground">
              Detaylı gizlilik politikası yakında yayınlanacaktır.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
