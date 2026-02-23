"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, type LoginResponse, type UserMe } from "@/lib/api-client";
import { setAuth } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [mfaStep, setMfaStep] = useState<{ mfa_token: string; user: UserMe } | null>(null);
  const [mfaCode, setMfaCode] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const data = await api.auth.login(email, password);
      if ("mfa_required" in data && data.mfa_required) {
        setMfaStep({ mfa_token: data.mfa_token, user: data.user });
        setMfaCode("");
        setLoading(false);
        return;
      }
      const tokenData = data as { access_token: string; refresh_token: string; user: any };
      setAuth(tokenData.access_token, tokenData.refresh_token, tokenData.user);
      router.push(tokenData.user.role === "admin" ? "/admin" : "/dashboard");
    } catch (err: any) {
      setError(err.message || "Giriş başarısız");
    } finally {
      setLoading(false);
    }
  };

  const handleMfaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mfaStep) return;
    setError("");
    setLoading(true);
    try {
      const data = await api.auth.mfaVerify(mfaStep.mfa_token, mfaCode);
      setAuth(data.access_token, data.refresh_token, data.user);
      router.push(data.user.role === "admin" ? "/admin" : "/dashboard");
    } catch (err: any) {
      setError(err.message || "Doğrulama kodu geçersiz");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background grain px-4">
      <div className="data-strip fixed top-0 left-0 right-0" />

      <div className="w-full max-w-sm animate-fade-up">
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
          <h1 className="font-display text-display-md text-foreground">Bondley</h1>
          <p className="text-label text-muted-foreground mt-2">BOR�LANMA ARA�LARI ANAL�Z PLATFORMU</p>
        </div>

        <Card className="amber-glow-border">
          <CardHeader className="pb-4">
            <CardDescription>
              {mfaStep ? "İKİ ADIMLI DOĞRULAMA" : "KIMLIK DOGRULAMA"}
            </CardDescription>
            <CardTitle className="mt-1">
              {mfaStep ? "Doğrulama Kodu" : "Giriş Yap"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {mfaStep ? (
              <form onSubmit={handleMfaSubmit} className="space-y-4">
                <p className="text-data-sm text-muted-foreground">
                  Authenticator uygulamanızdan 6 haneli kodu girin (veya yedek kodu).
                </p>
                <div className="space-y-2">
                  <label className="text-label text-muted-foreground">KOD</label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder="000000"
                    value={mfaCode}
                    onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, "").slice(0, 8))}
                    maxLength={8}
                    className="font-mono text-center text-lg tracking-widest"
                  />
                </div>
                {error && (
                  <div className="p-3 rounded-md border border-destructive/30 bg-destructive/5 text-destructive text-data-sm">
                    {error}
                  </div>
                )}
                <Button type="submit" className="w-full" disabled={loading || mfaCode.length < 6}>
                  {loading ? "Doğrulanıyor..." : "Doğrula"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full"
                  onClick={() => setMfaStep(null)}
                  disabled={loading}
                >
                  Geri
                </Button>
              </form>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-label text-muted-foreground">E-POSTA</label>
                  <Input
                    type="email"
                    placeholder="ornek@sirket.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="font-mono-data"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-label text-muted-foreground">SIFRE</label>
                  <Input
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                {error && (
                  <div className="p-3 rounded-md border border-destructive/30 bg-destructive/5 text-destructive text-data-sm">
                    {error}
                  </div>
                )}
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Doğrulanıyor..." : "Giriş Yap"}
                </Button>
              </form>
            )}

            <div className="mt-6 pt-4 border-t border-border/50 text-center">
              <p className="text-data-sm text-muted-foreground">
                Hesabiniz yok mu?{" "}
                <Link
                  href="/signup"
                  className="text-primary hover:text-primary/80 font-medium transition-colors"
                >
                  Kayıt Ol
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-label text-muted-foreground/50 mt-6">&copy; 2026 Bondley</p>
      </div>
    </div>
  );
}
