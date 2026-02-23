"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api-client";
import { getToken, getRefreshToken, getUser, setAuth } from "@/lib/auth";

export default function SettingsPage() {
  useEffect(() => {
    document.title = "Hesap Ayarları — Bondley";
    return () => {
      document.title = "Bondley";
    };
  }, []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [profileData, setProfileData] = useState({
    full_name: "",
    company: "",
    location: "",
  });
  const [passwordData, setPasswordData] = useState({
    current_password: "",
    new_password: "",
    confirm_password: "",
  });
  const [emailData, setEmailData] = useState({
    new_email: "",
  });
  const [mfaEnabled, setMfaEnabled] = useState<boolean | null>(null);
  const [mfaSetupStep, setMfaSetupStep] = useState<"idle" | "qr" | "confirm" | "backup">("idle");
  const [mfaSetupSecret, setMfaSetupSecret] = useState<string | null>(null);
  const [mfaConfirmCode, setMfaConfirmCode] = useState("");
  const [mfaBackupCodes, setMfaBackupCodes] = useState<string[] | null>(null);
  const [mfaDisablePassword, setMfaDisablePassword] = useState("");

  useEffect(() => {
    const user = getUser();
    if (user) {
      setProfileData({
        full_name: user.full_name || "",
        company: user.company || "",
        location: user.location || "",
      });
      setEmailData({
        new_email: user.email || "",
      });
      setMfaEnabled(!!user.mfa_enabled);
    }
  }, []);

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    api.auth.me(token).then((user) => setMfaEnabled(user.mfa_enabled)).catch(() => {});
  }, []);

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = getToken();
    if (!token) return;

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const updated = await api.auth.updateProfile(token, profileData);
      const refreshToken = getRefreshToken() || "";
      setAuth(token, refreshToken, updated);
      setSuccess("Profil başarıyla güncellendi");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Profil güncellenemedi");
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = getToken();
    if (!token) return;

    if (passwordData.new_password !== passwordData.confirm_password) {
      setError("Yeni şifreler eşleşmiyor");
      return;
    }

    if (passwordData.new_password.length < 8) {
      setError("Şifre en az 8 karakter olmalıdır");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      await api.auth.changePassword(token, {
        current_password: passwordData.current_password,
        new_password: passwordData.new_password,
      });
      setSuccess("Şifre başarıyla değiştirildi");
      setPasswordData({
        current_password: "",
        new_password: "",
        confirm_password: "",
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Şifre değiştirilemedi");
    } finally {
      setLoading(false);
    }
  };

  const handleEmailChange = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = getToken();
    if (!token) return;

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const updated = await api.auth.changeEmail(token, emailData);
      const refreshToken = getRefreshToken() || "";
      setAuth(token, refreshToken, updated);
      setSuccess("E-posta başarıyla değiştirildi");
    } catch (e) {
      setError(e instanceof Error ? e.message : "E-posta değiştirilemedi");
    } finally {
      setLoading(false);
    }
  };

  const handleMfaSetupStart = async () => {
    const token = getToken();
    if (!token) return;
    setLoading(true);
    setError(null);
    setMfaSetupStep("idle");
    try {
      const res = await api.auth.mfaSetup(token);
      setMfaSetupSecret(res.secret);
      setMfaSetupStep("qr");
    } catch (e) {
      setError(e instanceof Error ? e.message : "2FA kurulumu başlatılamadı");
    } finally {
      setLoading(false);
    }
  };

  const handleMfaConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = getToken();
    if (!token || mfaConfirmCode.length !== 6) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.auth.mfaConfirm(token, mfaConfirmCode);
      setMfaBackupCodes(res.backup_codes);
      setMfaSetupStep("backup");
      setMfaEnabled(true);
      setMfaConfirmCode("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kod geçersiz");
    } finally {
      setLoading(false);
    }
  };

  const handleMfaDisable = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = getToken();
    if (!token) return;
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      await api.auth.mfaDisable(token, mfaDisablePassword);
      setMfaEnabled(false);
      setMfaDisablePassword("");
      setSuccess("İki adımlı doğrulama kapatıldı");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Şifre yanlış veya işlem başarısız");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="animate-fade-up">
        <h1 className="font-display text-display-md text-foreground">Hesap Ayarları</h1>
        <p className="text-data-sm text-muted-foreground mt-1">Hesap bilgilerinizi yönetin</p>
      </div>

      {error && (
        <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-md text-sm text-destructive">
          {error}
        </div>
      )}

      {success && (
        <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-md text-sm text-green-600 dark:text-green-400">
          {success}
        </div>
      )}

      {/* Profile Update */}
      <Card className="animate-fade-up-delay-1">
        <CardHeader>
          <CardDescription>PROFİL</CardDescription>
          <CardTitle className="mt-1">Profil Bilgileri</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleProfileUpdate} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Ad Soyad</label>
              <Input
                value={profileData.full_name}
                onChange={(e) => setProfileData({ ...profileData, full_name: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Şirket</label>
              <Input
                value={profileData.company}
                onChange={(e) => setProfileData({ ...profileData, company: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Konum</label>
              <Input
                value={profileData.location}
                onChange={(e) => setProfileData({ ...profileData, location: e.target.value })}
              />
            </div>
            <Button type="submit" disabled={loading}>
              {loading ? "Kaydediliyor..." : "Güncelle"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Password Change */}
      <Card className="animate-fade-up-delay-2">
        <CardHeader>
          <CardDescription>GÜVENLİK</CardDescription>
          <CardTitle className="mt-1">Şifre Değiştir</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePasswordChange} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Mevcut Şifre</label>
              <Input
                type="password"
                value={passwordData.current_password}
                onChange={(e) => setPasswordData({ ...passwordData, current_password: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Yeni Şifre</label>
              <Input
                type="password"
                value={passwordData.new_password}
                onChange={(e) => setPasswordData({ ...passwordData, new_password: e.target.value })}
                required
                minLength={8}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Yeni Şifre (Tekrar)</label>
              <Input
                type="password"
                value={passwordData.confirm_password}
                onChange={(e) => setPasswordData({ ...passwordData, confirm_password: e.target.value })}
                required
                minLength={8}
              />
            </div>
            <Button type="submit" disabled={loading}>
              {loading ? "Değiştiriliyor..." : "Şifreyi Değiştir"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Email Change */}
      <Card className="animate-fade-up-delay-3">
        <CardHeader>
          <CardDescription>E-POSTA</CardDescription>
          <CardTitle className="mt-1">E-posta Değiştir</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleEmailChange} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Yeni E-posta</label>
              <Input
                type="email"
                value={emailData.new_email}
                onChange={(e) => setEmailData({ new_email: e.target.value })}
                required
              />
            </div>
            <Button type="submit" disabled={loading}>
              {loading ? "Değiştiriliyor..." : "E-postayı Değiştir"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Two-Factor Authentication */}
      <Card className="animate-fade-up-delay-4">
        <CardHeader>
          <CardDescription>GÜVENLİK</CardDescription>
          <CardTitle className="mt-1">İki Adımlı Doğrulama (2FA)</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Durum: {mfaEnabled === null ? "..." : mfaEnabled ? "Açık" : "Kapalı"}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {mfaSetupStep === "backup" && mfaBackupCodes && (
            <div className="p-4 rounded-md border border-amber-500/30 bg-amber-500/5 space-y-2">
              <p className="text-sm font-medium">Yedek kodlarınızı güvenli bir yere kaydedin. Bu kodlar tekrar gösterilmez.</p>
              <pre className="text-xs font-mono break-all bg-background/50 p-2 rounded">
                {mfaBackupCodes.join(" ")}
              </pre>
              <Button type="button" onClick={() => { setMfaSetupStep("idle"); setMfaBackupCodes(null); setMfaSetupSecret(null); }}>
                Tamam
              </Button>
            </div>
          )}
          {mfaSetupStep === "qr" && mfaSetupSecret && (
            <form onSubmit={handleMfaConfirm} className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Authenticator uygulamanıza (Google Authenticator, Authy vb.) bu secret ile hesap ekleyin veya QR kodu tarayın.
              </p>
              <p className="text-xs font-mono break-all bg-muted/50 p-2 rounded">{mfaSetupSecret}</p>
              <div>
                <label className="block text-sm font-medium mb-1">Doğrulama kodu (6 hane)</label>
                <Input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={mfaConfirmCode}
                  onChange={(e) => setMfaConfirmCode(e.target.value.replace(/\D/g, ""))}
                  placeholder="000000"
                  className="font-mono w-32"
                />
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={loading || mfaConfirmCode.length !== 6}>
                  {loading ? "Doğrulanıyor..." : "Etkinleştir"}
                </Button>
                <Button type="button" variant="outline" onClick={() => { setMfaSetupStep("idle"); setMfaSetupSecret(null); setMfaConfirmCode(""); }}>
                  İptal
                </Button>
              </div>
            </form>
          )}
          {mfaSetupStep === "idle" && !mfaBackupCodes && (
            <>
              {!mfaEnabled ? (
                <Button onClick={handleMfaSetupStart} disabled={loading}>
                  {loading ? "Hazırlanıyor..." : "İki Adımlı Doğrulamayı Etkinleştir"}
                </Button>
              ) : (
                <form onSubmit={handleMfaDisable} className="space-y-4">
                  <p className="text-sm text-muted-foreground">2FA'yı kapatmak için mevcut şifrenizi girin.</p>
                  <Input
                    type="password"
                    placeholder="Mevcut şifre"
                    value={mfaDisablePassword}
                    onChange={(e) => setMfaDisablePassword(e.target.value)}
                  />
                  <Button type="submit" disabled={loading || !mfaDisablePassword}>
                    {loading ? "Kapatılıyor..." : "İki Adımlı Doğrulamayı Kapat"}
                  </Button>
                </form>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
