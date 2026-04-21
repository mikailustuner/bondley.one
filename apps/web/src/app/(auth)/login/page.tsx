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
import { tr } from "@/locales/tr";

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
      setError(err.message || tr.auth.login.error);
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
      setError(err.message || tr.auth.login.mfaError);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm animate-fade-up">
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
          <h1 className="text-display-md text-foreground">{tr.common.brand}</h1>
          <p className="text-[13px] font-medium text-muted-foreground mt-2">{tr.auth.login.subtitle}</p>
        </div>

        <Card>
          <CardHeader className="pb-4">
            <CardDescription>
              {mfaStep ? tr.auth.login.mfaSubtitle : tr.auth.login.subtitle}
            </CardDescription>
            <CardTitle className="mt-1">
              {mfaStep ? tr.auth.login.mfaTitle : tr.auth.login.title}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {mfaStep ? (
              <form onSubmit={handleMfaSubmit} className="space-y-4">
                <p className="text-[13px] text-muted-foreground">
                  {tr.auth.login.mfaDescription}
                </p>
                <div className="space-y-2">
                  <label className="text-[15px] font-medium text-foreground">{tr.auth.login.mfaTitle}</label>
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
                  <div className="p-3 rounded-xl border border-destructive/15 bg-destructive/5 text-destructive text-[13px]">
                    {error}
                  </div>
                )}
                <Button type="submit" className="w-full" disabled={loading || mfaCode.length < 6}>
                  {loading ? tr.common.verifying : tr.auth.login.mfaSubmit}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full"
                  onClick={() => setMfaStep(null)}
                  disabled={loading}
                >
                  {tr.common.back}
                </Button>
              </form>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[15px] font-medium text-foreground">{tr.auth.login.emailLabel}</label>
                  <Input
                    type="email"
                    placeholder={tr.auth.login.emailPlaceholder}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[15px] font-medium text-foreground">{tr.auth.login.passwordLabel}</label>
                  <Input
                    type="password"
                    placeholder={tr.auth.login.passwordPlaceholder}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                {error && (
                  <div className="p-3 rounded-xl border border-destructive/15 bg-destructive/5 text-destructive text-[13px]">
                    {error}
                  </div>
                )}
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? tr.common.verifying : tr.auth.login.submit}
                </Button>
              </form>
            )}

            <div className="mt-6 pt-5 border-t border-border/50 text-center">
              <p className="text-[15px] text-muted-foreground">
                {tr.auth.login.noAccount}{" "}
                <Link
                  href="/signup"
                  className="text-primary hover:text-primary/80 font-medium transition-colors"
                >
                  {tr.auth.login.signupLink}
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-[13px] text-muted-foreground/50 mt-8">&copy; 2026 Bondley</p>
      </div>
    </div>
  );
}
