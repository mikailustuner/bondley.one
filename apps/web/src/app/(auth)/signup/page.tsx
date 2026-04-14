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
    label: "Ad Soyad",
    type: "text",
    placeholder: "Ad Soyad",
    autoComplete: "name",
  },
  {
    key: "email",
    label: "Kurumsal E-posta",
    type: "email",
    placeholder: "ornek@sirket.com",
    autoComplete: "email",
  },
  {
    key: "company",
    label: "Şirket / Kurum Adı",
    type: "text",
    placeholder: "Şirket veya kurum adı",
    autoComplete: "organization",
  },
  {
    key: "location",
    label: "Konum",
    type: "text",
    placeholder: "İstanbul, Türkiye",
    autoComplete: "address-level1",
  },
  {
    key: "password",
    label: "Şifre",
    type: "password",
    placeholder: "En az 8 karakter",
    autoComplete: "new-password",
  },
  {
    key: "password_confirm",
    label: "Şifre Tekrar",
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
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
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

    if (!privacyAccepted) {
      setError("Devam etmek için Gizlilik Politikasını kabul etmelisiniz");
      return;
    }

    setLoading(true);

    try {
      const { password_confirm: _, ...payload } = form;
      const data = await api.auth.signup({
        ...payload,
        privacy_policy_accepted: true,
      } as {
        email: string;
        password: string;
        full_name: string;
        company: string;
        location: string;
        privacy_policy_accepted: boolean;
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
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md animate-fade-up">
        <div className="text-center mb-10">
          <div className="inline-flex h-12 w-12 items-center justify-center mb-5">
            <Image
              src="/logo.png"
              alt="Bondley Logo"
              width={48}
              height={48}
              className="h-12 w-12 object-contain"
              priority
            />
          </div>
          <h1 className="text-display-md text-foreground">
            Bondley
          </h1>
          <p className="text-[13px] font-medium text-muted-foreground mt-2">
            Kurumsal Hesap Oluştur
          </p>
        </div>

        <Card>
          <CardHeader className="pb-4">
            <CardDescription>B2B Kayıt</CardDescription>
            <CardTitle className="mt-1">Yeni Hesap</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {FIELDS.map((field) => (
                <div key={field.key} className="space-y-1.5">
                  <label className="text-[15px] font-medium text-foreground">
                    {field.label}
                  </label>
                  <Input
                    type={field.type}
                    placeholder={field.placeholder}
                    autoComplete={field.autoComplete}
                    value={form[field.key] ?? ""}
                    onChange={(e) => updateField(field.key, e.target.value)}
                    required
                  />
                </div>
              ))}

              {/* Privacy Policy Checkbox */}
              <div className="pt-2">
                <label className="flex items-start gap-3 cursor-pointer group">
                  <div className="relative mt-0.5">
                    <input
                      type="checkbox"
                      checked={privacyAccepted}
                      onChange={(e) => setPrivacyAccepted(e.target.checked)}
                      className="sr-only peer"
                      id="privacy-policy-checkbox"
                    />
                    <div className={`h-[18px] w-[18px] rounded-md border-2 transition-all flex items-center justify-center ${
                      privacyAccepted
                        ? "border-primary bg-primary"
                        : "border-muted-foreground/40 group-hover:border-muted-foreground/60"
                    }`}>
                      {privacyAccepted && (
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-primary-foreground">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </div>
                  </div>
                  <span className="text-[13px] leading-relaxed text-muted-foreground">
                    <Link
                      href="/privacy"
                      target="_blank"
                      className="text-primary hover:text-primary/80 underline underline-offset-2 font-medium transition-colors"
                      onClick={(e) => e.stopPropagation()}
                    >
                      Gizlilik ve Çerez Politikası
                    </Link>
                    &apos;nı okudum, anladım ve kabul ediyorum.
                  </span>
                </label>
              </div>

              {error && (
                <div className="p-3 rounded-xl border border-destructive/15 bg-destructive/5 text-destructive text-[13px]">
                  {error}
                </div>
              )}

              <Button type="submit" className="w-full" disabled={loading || !privacyAccepted}>
                {loading ? "Hesap oluşturuluyor..." : "Kayıt Ol"}
              </Button>
            </form>

            <div className="mt-6 pt-5 border-t border-border/50 text-center">
              <p className="text-[15px] text-muted-foreground">
                Zaten hesabınız var mı?{" "}
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

        <p className="text-center text-[13px] text-muted-foreground/50 mt-8">
          &copy; 2026 Bondley
        </p>
      </div>
    </div>
  );
}
