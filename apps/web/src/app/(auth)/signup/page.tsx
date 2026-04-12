"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api-client";
import { setAuth } from "@/lib/auth";

interface FormField {
  key: string;
  label: string;
  type: string;
  placeholder: string;
  autoComplete?: string;
}

const FIELDS: FormField[] = [
  {
    key: "full_name",
    label: "AD SOYAD",
    type: "text",
    placeholder: "Ad Soyad",
    autoComplete: "name",
  },
  {
    key: "email",
    label: "KURUMSAL E-POSTA",
    type: "email",
    placeholder: "ornek@sirket.com",
    autoComplete: "email",
  },
  {
    key: "company",
    label: "SIRKET / KURUM ADI",
    type: "text",
    placeholder: "Şirket veya kurum adı",
    autoComplete: "organization",
  },
  {
    key: "location",
    label: "KONUM",
    type: "text",
    placeholder: "İstanbul, Türkiye",
    autoComplete: "address-level1",
  },
  {
    key: "password",
    label: "SIFRE",
    type: "password",
    placeholder: "En az 8 karakter",
    autoComplete: "new-password",
  },
  {
    key: "password_confirm",
    label: "SIFRE TEKRAR",
    type: "password",
    placeholder: "Şifrenizi tekrar girin",
    autoComplete: "new-password",
  },
];

type FormData = Record<string, string>;

export default function SignupPage() {
  const router = useRouter();
  const [form, setForm] = useState<FormData>({
    full_name: "",
    email: "",
    company: "",
    location: "",
    password: "",
    password_confirm: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const updateField = (key: string, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (form.password !== form.password_confirm) {
      setError("Şifreler eşleşmiyor");
      return;
    }

    if (form.password.length < 8) {
      setError("Şifre en az 8 karakter olmalı");
      return;
    }

    setLoading(true);

    try {
      const { password_confirm: _, ...payload } = form;
      const data = await api.auth.signup(payload as {
        email: string;
        password: string;
        full_name: string;
        company: string;
        location: string;
      });
      setAuth(data.access_token, data.refresh_token, data.user);
      router.push("/onboarding");
    } catch (err: any) {
      setError(err.message || "Kayıt başarısız");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background grain px-4 py-12">
      <div className="data-strip fixed top-0 left-0 right-0" />

      <div className="w-full max-w-md animate-fade-up">
        <div className="text-center mb-8">
          <div className="inline-flex h-10 w-10 items-center justify-center mb-4">
            <Image
              src="/logo.png"
              alt="Bondley Logo"
              width={40}
              height={40}
              className="h-10 w-10 object-contain"
              priority
            />
          </div>
          <h1 className="font-display text-display-md text-foreground">
            Bondley
          </h1>
          <p className="text-label text-muted-foreground mt-2">
            KURUMSAL HESAP OLUSTUR
          </p>
        </div>

        <Card className="amber-glow-border">
          <CardHeader className="pb-4">
            <CardDescription>B2B KAYIT</CardDescription>
            <CardTitle className="mt-1">Yeni Hesap</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {FIELDS.map((field) => (
                <div key={field.key} className="space-y-1.5">
                  <label className="text-label text-muted-foreground">
                    {field.label}
                  </label>
                  <Input
                    type={field.type}
                    placeholder={field.placeholder}
                    autoComplete={field.autoComplete}
                    value={form[field.key] ?? ""}
                    onChange={(e) => updateField(field.key, e.target.value)}
                    required
                    className={
                      field.type === "email" ? "font-mono-data" : undefined
                    }
                  />
                </div>
              ))}

              {error && (
                <div className="p-3 rounded-md border border-destructive/30 bg-destructive/5 text-destructive text-data-sm">
                  {error}
                </div>
              )}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Hesap oluşturuluyor..." : "Kayıt Ol"}
              </Button>
            </form>

            <div className="mt-6 pt-4 border-t border-border/50 text-center">
              <p className="text-data-sm text-muted-foreground">
                Zaten hesabiniz var mi?{" "}
                <Link
                  href="/login"
                  className="text-primary hover:text-primary/80 font-medium transition-colors"
                >
                  Giriş Yap
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-label text-muted-foreground/50 mt-6">
          &copy; 2026 Bondley
        </p>
      </div>
    </div>
  );
}
