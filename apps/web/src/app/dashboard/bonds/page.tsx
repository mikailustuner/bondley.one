"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api-client";
import { getToken } from "@/lib/auth";

type BondItem = {
  id: number;
  isin_code: string;
  bond_type: string;
  issue_date: string;
  maturity_date: string;
  coupon_rate: number | string;
  face_value: number | string;
  is_active: boolean;
};

type CalcData = {
  yield_to_maturity?: number | string;
  spread?: number | string;
  dirty_price?: number | string;
  macaulay_duration?: number | string;
};

function BondRowWithCalc({ bond }: { bond: BondItem }) {
  const [calc, setCalc] = useState<CalcData | null>(null);
  const [price, setPrice] = useState<string>("-");

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    (async () => {
      try {
        const calcs = await api.calculations.get(token, bond.isin_code);
        if (calcs?.length) {
          setCalc(calcs[calcs.length - 1]);
        }
        const md = await api.marketData.get(token, bond.isin_code);
        if (md?.length) {
          const cp = md[md.length - 1].clean_price;
          if (cp != null) setPrice(parseFloat(String(cp)).toFixed(2));
        }
      } catch {
        /* skip */
      }
    })();
  }, [bond.isin_code]);

  const ytm = calc?.yield_to_maturity ? parseFloat(String(calc.yield_to_maturity)) : null;
  const spread = calc?.spread != null ? parseFloat(String(calc.spread)) : null;
  const duration = calc?.macaulay_duration ? parseFloat(String(calc.macaulay_duration)).toFixed(3) : "-";
  const coupon = parseFloat(String(bond.coupon_rate));

  return (
    <tr className="border-b border-border/30 last:border-0 hover:bg-secondary/30 transition-colors group">
      <td className="py-3">
        <Link
          href={`/dashboard/bonds/${bond.isin_code}`}
          className="font-mono-data text-data-sm text-foreground group-hover:text-primary transition-colors"
        >
          {bond.isin_code}
        </Link>
      </td>
      <td className="py-3">
        <Badge variant={bond.bond_type === "TRT" ? "default" : "secondary"}>{bond.bond_type}</Badge>
      </td>
      <td className="py-3 font-mono-data text-data-sm text-muted-foreground">
        {new Date(bond.maturity_date).toLocaleDateString("tr-TR")}
      </td>
      <td className="py-3 font-mono-data text-data-sm text-foreground">
        %{(coupon * 100).toFixed(2)}
      </td>
      <td className="py-3 text-right font-mono-data text-data-sm text-foreground">{price}</td>
      <td className="py-3 text-right font-mono-data text-data-sm text-positive">
        {ytm != null ? `%${(ytm * 100).toFixed(2)}` : "-"}
      </td>
      <td className="py-3 text-right font-mono-data text-data-sm text-muted-foreground">{duration}</td>
    </tr>
  );
}

export default function BondsListPage() {
  const [bonds, setBonds] = useState<BondItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setError("Giris yapmaniz gerekiyor");
      setLoading(false);
      return;
    }
    api.bonds
      .list(token, { active_only: true, limit: 3000 })
      .then((res) => {
        setBonds(res.items || []);
        setTotal(res.total ?? 0);
      })
      .catch((e) => setError(e?.message || "Veri yuklenemedi"))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return bonds;
    const q = search.toUpperCase();
    return bonds.filter((b) => b.isin_code.toUpperCase().includes(q));
  }, [bonds, search]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between animate-fade-up">
        <div>
          <h1 className="font-display text-display-md text-foreground">Tahviller</h1>
          <p className="text-data-sm text-muted-foreground mt-1">Tum aktif Turk Devlet Tahvilleri</p>
        </div>
        <div className="w-64">
          <Input
            placeholder="ISIN ile ara..."
            className="font-mono-data"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <Card className="animate-fade-up-delay-1">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardDescription>PORTFOY</CardDescription>
              <CardTitle className="mt-1">Tahvil Listesi</CardTitle>
            </div>
            <span className="text-label text-muted-foreground">
              {search ? `${filtered.length} / ` : ""}{total} KAYIT
            </span>
          </div>
        </CardHeader>
        <CardContent>
          {loading && <p className="text-data-sm text-muted-foreground py-4">Yukleniyor...</p>}
          {error && <p className="text-data-sm text-destructive py-4">{error}</p>}
          {!loading && !error && (
            <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
              <table className="w-full">
                <thead className="sticky top-0 bg-card z-10">
                  <tr className="border-b border-border">
                    {["ISIN KODU", "TIP", "VADE", "KUPON", "TEMIZ FIYAT", "YTM", "DURASYON"].map((h, i) => (
                      <th
                        key={h}
                        className={`pb-3 text-label text-muted-foreground font-normal ${i >= 4 ? "text-right" : "text-left"}`}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((bond) => (
                    <BondRowWithCalc key={bond.isin_code} bond={bond} />
                  ))}
                </tbody>
              </table>
              {filtered.length === 0 && (
                <p className="text-data-sm text-muted-foreground py-6 text-center">
                  {search ? "Aramayla esklesen tahvil bulunamadi" : "Henuz tahvil eklenmemis"}
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
