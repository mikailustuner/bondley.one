"use client";

import { useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

import { tr } from "@/locales/tr";

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
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <Card className="max-w-md w-full text-center animate-fade-up">
        <CardContent className="pt-12 pb-8">
          <div className="inline-flex h-16 w-16 items-center justify-center mb-6">
            <Image
              src="/logo-mark.svg"
              alt={`${tr.common.brand} Logo`}
              width={64}
              height={64}
              className="h-16 w-16 object-contain"
              priority
            />
          </div>
          <h1 className="text-display-md text-foreground mb-3">
            {tr.common.errorPage.title}
          </h1>
          <p className="text-[15px] text-muted-foreground mb-8">
            {tr.common.errorPage.description}
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button onClick={reset} variant="default" className="w-full sm:w-auto">
              {tr.common.errorPage.retry}
            </Button>
            <Link href="/landing">
              <Button variant="outline" className="w-full sm:w-auto">
                {tr.common.errorPage.backToHome}
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
