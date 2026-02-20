"use client";

import { useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen bg-background grain flex items-center justify-center px-4">
      <div className="data-strip fixed top-0 left-0 right-0" />
      <Card className="max-w-md w-full text-center animate-fade-up">
        <CardContent className="pt-12 pb-8">
          <div className="inline-flex h-16 w-16 items-center justify-center mb-6">
            <Image
              src="/logo.png"
              alt="Bondley Logo"
              width={64}
              height={64}
              className="h-16 w-16 object-contain"
              priority
            />
          </div>
          <h1 className="font-display text-display-md text-foreground mb-3">
            Beklenmeyen bir hata oluştu
          </h1>
          <p className="text-data-sm text-muted-foreground mb-8">
            Üzgünüz, bir şeyler ters gitti. Lütfen tekrar deneyin.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button onClick={reset} variant="default" className="w-full sm:w-auto">
              Yeniden Dene
            </Button>
            <Link href="/landing">
              <Button variant="outline" className="w-full sm:w-auto">
                Ana Sayfaya Dön
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
