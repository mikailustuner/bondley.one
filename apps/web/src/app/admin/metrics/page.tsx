"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api-client";
import { getToken } from "@/lib/auth";

export default function AdminMetricsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [overview, setOverview] = useState<any>(null);
  const [bondMetrics, setBondMetrics] = useState<any[]>([]);
  const [userMetrics, setUserMetrics] = useState<any[]>([]);
  const [days, setDays] = useState(30);

  const loadMetrics = async () => {
    const token = getToken();
    if (!token) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [overviewData, bondsData, usersData] = await Promise.all([
        api.admin.getMetricsOverview(token, days),
        api.admin.getBondMetrics(token, { limit: 10 }),
        api.admin.getUserMetrics(token, { limit: 10 }),
      ]);

      setOverview(overviewData);
      setBondMetrics(bondsData.bonds);
      setUserMetrics(usersData.users);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Metrikler yuklenemedi");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMetrics();
  }, [days]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between animate-fade-up">
        <div>
          <h1 className="font-display text-display-md text-foreground">Metrikler</h1>
          <p className="text-data-sm text-muted-foreground mt-1">Sistem metriklerini görüntüleyin</p>
        </div>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            value={days}
            onChange={(e) => setDays(parseInt(e.target.value) || 30)}
            className="w-24"
            min={1}
            max={365}
          />
          <span className="text-sm text-muted-foreground">gün</span>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-md text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Overview */}
      {overview && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 animate-fade-up-delay-1">
          <Card>
            <CardHeader>
              <CardDescription>TAHVİL GÖRÜNTÜLEME</CardDescription>
              <CardTitle className="mt-1 text-2xl">{overview.total_bond_views}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardDescription>BENZERSİZ KULLANICILAR</CardDescription>
              <CardTitle className="mt-1 text-2xl">{overview.unique_users}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardDescription>API ÇAĞRILARI</CardDescription>
              <CardTitle className="mt-1 text-2xl">{overview.total_api_calls}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardDescription>HESAPLAMALAR</CardDescription>
              <CardTitle className="mt-1 text-2xl">{overview.total_calculations}</CardTitle>
            </CardHeader>
          </Card>
        </div>
      )}

      {/* Top Bonds */}
      <Card className="animate-fade-up-delay-2">
        <CardHeader>
          <CardDescription>TAHVİLLER</CardDescription>
          <CardTitle className="mt-1">En Çok Görüntülenen Tahviller</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-data-sm text-muted-foreground">Yukleniyor…</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    {["ISIN", "İhraççı", "Görüntülenme", "Benzersiz Kullanıcı"].map((h) => (
                      <th key={h} className="pb-3 text-label text-muted-foreground font-normal text-left">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {bondMetrics.map((bond) => (
                    <tr key={bond.bond_id} className="border-b border-border/30 last:border-0 hover:bg-secondary/30 transition-colors">
                      <td className="py-3 font-mono-data text-data-sm text-foreground">{bond.isin_code}</td>
                      <td className="py-3 text-data-sm text-foreground">{bond.issuer || "—"}</td>
                      <td className="py-3 text-data-sm text-muted-foreground">{bond.view_count}</td>
                      <td className="py-3 text-data-sm text-muted-foreground">{bond.unique_users}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Top Users */}
      <Card className="animate-fade-up-delay-3">
        <CardHeader>
          <CardDescription>KULLANICILAR</CardDescription>
          <CardTitle className="mt-1">En Aktif Kullanıcılar</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-data-sm text-muted-foreground">Yukleniyor…</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    {["User ID", "Tahvil Görüntüleme", "API Çağrıları", "Hesaplamalar"].map((h) => (
                      <th key={h} className="pb-3 text-label text-muted-foreground font-normal text-left">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {userMetrics.map((user) => (
                    <tr key={user.user_id} className="border-b border-border/30 last:border-0 hover:bg-secondary/30 transition-colors">
                      <td className="py-3 font-mono-data text-data-sm text-foreground">{user.user_id}</td>
                      <td className="py-3 text-data-sm text-muted-foreground">{user.total_bonds_viewed}</td>
                      <td className="py-3 text-data-sm text-muted-foreground">{user.total_api_calls}</td>
                      <td className="py-3 text-data-sm text-muted-foreground">{user.total_calculations}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
