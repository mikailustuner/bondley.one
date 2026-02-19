"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api-client";
import { getToken, getRefreshToken, getUser, setAuth } from "@/lib/auth";

export default function SettingsPage() {
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
    }
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
    </div>
  );
}
