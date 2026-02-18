"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api-client";
import { setAuth } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const data = await api.auth.login(email, password);
      setAuth(data.access_token, data.user);
      router.push(data.user.role === "admin" ? "/admin" : "/dashboard");
    } catch (err: any) {
      setError(err.message || "Giris basarisiz");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background grain px-4">
      <div className="data-strip fixed top-0 left-0 right-0" />

      <div className="w-full max-w-sm animate-fade-up">
        <div className="text-center mb-8">
          <div className="inline-flex h-10 w-10 rounded-sm bg-primary items-center justify-center mb-4">
            <span className="text-primary-foreground font-display font-bold text-sm">FC</span>
          </div>
          <h1 className="font-display text-display-md text-foreground">FinCalc</h1>
          <p className="text-label text-muted-foreground mt-2">TAHVIL ANALIZ TERMINALI</p>
        </div>

        <Card className="amber-glow-border">
          <CardHeader className="pb-4">
            <CardDescription>KIMLIK DOGRULAMA</CardDescription>
            <CardTitle className="mt-1">Giris Yap</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="text-label text-muted-foreground">E-POSTA</label>
                <Input
                  type="email"
                  placeholder="admin@fincalc.com"
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
                {loading ? "Dogrulanıyor..." : "Giris Yap"}
              </Button>
            </form>

            <div className="mt-6 pt-4 border-t border-border/50 text-center">
              <p className="text-data-sm text-muted-foreground">
                Hesabiniz yok mu?{" "}
                <Link
                  href="/signup"
                  className="text-primary hover:text-primary/80 font-medium transition-colors"
                >
                  Kayit Ol
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-label text-muted-foreground/50 mt-6">&copy; 2026 FINCALC TERMINAL</p>
      </div>
    </div>
  );
}
