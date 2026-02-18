"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api-client";
import { getToken } from "@/lib/auth";

type UserRow = {
  id: number;
  email: string;
  full_name: string | null;
  company: string | null;
  location: string | null;
  role: string;
  is_active: boolean;
  created_at: string;
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setLoading(false);
      return;
    }
    api.auth
      .usersList(token)
      .then(setUsers)
      .catch((e) => setError(e instanceof Error ? e.message : "Kullanicilar yuklenemedi"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between animate-fade-up">
        <div>
          <h1 className="font-display text-display-md text-foreground">Kullanici Yonetimi</h1>
          <p className="text-data-sm text-muted-foreground mt-1">Kullanici hesaplarini yonetin</p>
        </div>
        <Button disabled>Yeni Kullanici</Button>
      </div>

      <Card className="animate-fade-up-delay-1">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardDescription>HESAPLAR</CardDescription>
              <CardTitle className="mt-1">Kayitli Kullanicilar</CardTitle>
            </div>
            <span className="text-label text-muted-foreground">{users.length} KAYIT</span>
          </div>
        </CardHeader>
        <CardContent>
          {error && <p className="text-data-sm text-destructive mb-4">{error}</p>}
          {loading ? (
            <p className="text-data-sm text-muted-foreground">Yukleniyor…</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    {["ID", "E-POSTA", "AD SOYAD", "SIRKET", "ROL", "DURUM"].map((h, i) => (
                      <th
                        key={h}
                        className={`pb-3 text-label text-muted-foreground font-normal ${i === 5 ? "text-right" : "text-left"}`}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id} className="border-b border-border/30 last:border-0 hover:bg-secondary/30 transition-colors">
                      <td className="py-3 font-mono-data text-data-sm text-muted-foreground">{user.id}</td>
                      <td className="py-3 font-mono-data text-data-sm text-foreground">{user.email}</td>
                      <td className="py-3 text-data-sm text-foreground">{user.full_name ?? "—"}</td>
                      <td className="py-3 text-data-sm text-muted-foreground">{user.company ?? "—"}</td>
                      <td className="py-3">
                        <Badge variant={user.role === "admin" ? "default" : "secondary"}>
                          {user.role.toUpperCase()}
                        </Badge>
                      </td>
                      <td className="py-3">
                        <Badge variant={user.is_active ? "default" : "secondary"}>
                          {user.is_active ? "AKTIF" : "PASIF"}
                        </Badge>
                      </td>
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
