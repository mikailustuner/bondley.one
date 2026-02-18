"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const USERS = [
  { id: 1, email: "admin@fincalc.com", name: "System Admin", role: "admin" as const, active: true },
  { id: 2, email: "analyst@fincalc.com", name: "Tahvil Analist", role: "user" as const, active: true },
  { id: 3, email: "trader@fincalc.com", name: "Bond Trader", role: "user" as const, active: true },
];

export default function AdminUsersPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between animate-fade-up">
        <div>
          <h1 className="font-display text-display-md text-foreground">Kullanici Yonetimi</h1>
          <p className="text-data-sm text-muted-foreground mt-1">Kullanici hesaplarini yonetin</p>
        </div>
        <Button>Yeni Kullanici</Button>
      </div>

      <Card className="animate-fade-up-delay-1">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardDescription>HESAPLAR</CardDescription>
              <CardTitle className="mt-1">Kayitli Kullanicilar</CardTitle>
            </div>
            <span className="text-label text-muted-foreground">{USERS.length} KAYIT</span>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  {["ID", "E-POSTA", "AD SOYAD", "ROL", "DURUM", "ISLEMLER"].map((h, i) => (
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
                {USERS.map((user) => (
                  <tr key={user.id} className="border-b border-border/30 last:border-0 hover:bg-secondary/30 transition-colors">
                    <td className="py-3 font-mono-data text-data-sm text-muted-foreground">{user.id}</td>
                    <td className="py-3 font-mono-data text-data-sm text-foreground">{user.email}</td>
                    <td className="py-3 text-data-sm text-foreground">{user.name}</td>
                    <td className="py-3">
                      <Badge variant={user.role === "admin" ? "default" : "secondary"}>
                        {user.role.toUpperCase()}
                      </Badge>
                    </td>
                    <td className="py-3">
                      <Badge variant={user.active ? "positive" : "destructive"}>
                        {user.active ? "AKTIF" : "PASIF"}
                      </Badge>
                    </td>
                    <td className="py-3 text-right space-x-1">
                      <Button variant="ghost" size="sm">Duzenle</Button>
                      <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">Devre Disi</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
