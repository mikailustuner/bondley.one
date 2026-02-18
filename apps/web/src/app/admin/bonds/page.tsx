"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api-client";
import { getToken } from "@/lib/auth";

type BondItem = {
  id: number;
  isin_code: string;
  bond_type: string;
  issue_date: string;
  maturity_date: string;
  coupon_rate: number | string;
  is_active: boolean;
};

export default function AdminBondsPage() {
  const [bonds, setBonds] = useState<BondItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setLoading(false);
      setError("Oturum gerekli");
      return;
    }
    api.bonds
      .list(token, { active_only: false, limit: 2500 })
      .then((res) => {
        setBonds(res.items || []);
        setTotal(res.total ?? 0);
      })
      .catch((err) => setError(err?.message || "Veri yuklenemedi"))
      .finally(() => setLoading(false));
  }, []);

  const formatDate = (d: string) => (d ? new Date(d).toISOString().slice(0, 10) : "-");
  const couponPercent = (c: number | string) =>
    typeof c === "number" ? (c * 100).toFixed(2) : (parseFloat(String(c)) * 100).toFixed(2);

  return (
    <div className="space-y-6">
      <div className="animate-fade-up">
        <h1 className="font-display text-display-md text-foreground">Tahvil Yonetimi</h1>
        <p className="text-data-sm text-muted-foreground mt-1">
          BIST otomatik surecinden gelen tahviller; sadece listeleme
        </p>
      </div>

      <Card className="animate-fade-up-delay-1">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardDescription>VERITABANI</CardDescription>
              <CardTitle className="mt-1">Kayitli Tahviller</CardTitle>
            </div>
            {!loading && <span className="text-label text-muted-foreground">{total} KAYIT</span>}
          </div>
        </CardHeader>
        <CardContent>
          {loading && (
            <p className="text-data-sm text-muted-foreground py-4">Yukleniyor...</p>
          )}
          {error && (
            <p className="text-data-sm text-destructive py-4">{error}</p>
          )}
          {!loading && !error && (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    {["ISIN", "TIP", "IHRAC", "VADE", "KUPON", "DURUM"].map((h) => (
                      <th
                        key={h}
                        className="pb-3 text-label text-muted-foreground font-normal text-left"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {bonds.map((bond) => (
                    <tr
                      key={bond.id}
                      className="border-b border-border/30 last:border-0 hover:bg-secondary/30 transition-colors"
                    >
                      <td className="py-3 font-mono-data text-data-sm text-foreground">
                        {bond.isin_code}
                      </td>
                      <td className="py-3">
                        <Badge variant={bond.bond_type === "TRT" ? "default" : "secondary"}>
                          {bond.bond_type}
                        </Badge>
                      </td>
                      <td className="py-3 font-mono-data text-data-sm text-muted-foreground">
                        {formatDate(bond.issue_date)}
                      </td>
                      <td className="py-3 font-mono-data text-data-sm text-muted-foreground">
                        {formatDate(bond.maturity_date)}
                      </td>
                      <td className="py-3 font-mono-data text-data-sm text-foreground">
                        %{couponPercent(bond.coupon_rate)}
                      </td>
                      <td className="py-3">
                        <Badge variant={bond.is_active ? "positive" : "destructive"}>
                          {bond.is_active ? "AKTIF" : "PASIF"}
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
