"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/empty-state";
import { AlertCircle, Bell, Plus, Pencil, Trash2 } from "lucide-react";
import { api, AlertRecord, BondListItem } from "@/lib/api-client";
import { getToken } from "@/lib/auth";
import { formatDate } from "@/lib/utils";

const ALERT_TYPES: { value: string; label: string }[] = [
  { value: "ytm_above", label: "YTM şu değerin üzerinde" },
  { value: "ytm_below", label: "YTM şu değerin altında" },
  { value: "tlref_daily_above", label: "TLREF günlük oran şu değerin üzerinde (%)" },
  { value: "tlref_daily_below", label: "TLREF günlük oran şu değerin altında (%)" },
  { value: "days_to_maturity", label: "Vadeye X gün kala" },
];

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<AlertRecord[]>([]);
  const [triggered, setTriggered] = useState<AlertRecord[]>([]);
  const [bonds, setBonds] = useState<BondListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formType, setFormType] = useState("ytm_above");
  const [formIsin, setFormIsin] = useState("");
  const [formThreshold, setFormThreshold] = useState("");
  const [formDays, setFormDays] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function load() {
    const token = getToken();
    if (!token) {
      setError("Giriş yapmanız gerekiyor");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    Promise.all([
      api.alerts.list(token),
      api.alerts.triggered(token),
      api.bonds.list(token, { active_only: true, limit: 3000 }),
    ])
      .then(([list, trig, bondList]) => {
        setAlerts(list);
        setTriggered(trig);
        setBonds(bondList.items || []);
      })
      .catch(() => setError("Uyarılar yüklenemedi"))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    document.title = "Uyarılarım — Bondley";
    return () => {
      document.title = "Bondley";
    };
  }, []);

  function openAdd() {
    setEditingId(null);
    setFormType("ytm_above");
    setFormIsin("");
    setFormThreshold("");
    setFormDays("");
    setFormOpen(true);
  }

  function openEdit(a: AlertRecord) {
    setEditingId(a.id);
    setFormType(a.type);
    const p = a.parameters as Record<string, unknown>;
    setFormIsin((p?.isin as string) || "");
    setFormThreshold(p?.threshold != null ? String(p.threshold) : "");
    setFormDays(p?.days != null ? String(p.days) : "");
    setFormOpen(true);
  }

  function submitForm() {
    const token = getToken();
    if (!token) return;
    setSubmitting(true);
    const parameters: Record<string, unknown> = {};
    if (formType === "days_to_maturity") {
      parameters.isin = formIsin;
      parameters.days = formDays ? parseInt(formDays, 10) : 30;
    } else if (formType === "ytm_above" || formType === "ytm_below") {
      parameters.isin = formIsin;
      parameters.threshold = formThreshold ? parseFloat(formThreshold) / 100 : 0;
    } else {
      parameters.threshold = formThreshold ? parseFloat(formThreshold) : 0;
    }
    const body = { type: formType, parameters };
    const promise = editingId
      ? api.alerts.update(token, editingId, body)
      : api.alerts.create(token, body);
    promise
      .then(() => {
        setFormOpen(false);
        load();
      })
      .catch(() => setError("Kaydetme başarısız"))
      .finally(() => setSubmitting(false));
  }

  function deleteAlert(id: number) {
    const token = getToken();
    if (!token) return;
    if (!confirm("Bu uyarıyı silmek istediğinize emin misiniz?")) return;
    api.alerts
      .delete(token, id)
      .then(() => load())
      .catch(() => setError("Silme başarısız"));
  }

  const typeLabel = (t: string) => ALERT_TYPES.find((x) => x.value === t)?.label ?? t;
  const needIsin = ["ytm_above", "ytm_below", "days_to_maturity"].includes(formType);
  const needDays = formType === "days_to_maturity";
  const needThreshold = formType !== "days_to_maturity";

  if (!getToken())
    return (
      <EmptyState
        variant="error"
        title="Giriş gerekli"
        description="Uyarıları görüntülemek için giriş yapın."
        action={{ label: "Giriş yap", href: "/login" }}
        icon={<AlertCircle className="h-7 w-7" />}
      />
    );

  if (loading)
    return (
      <div className="py-12 text-center text-muted-foreground text-[15px]">Yükleniyor...</div>
    );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-display-md text-foreground">Uyarılarım</h1>
        <p className="text-[15px] text-muted-foreground mt-1.5">
          YTM, TLREF veya vadeye kalan güne göre özel uyarılar tanımlayın.
        </p>
      </div>

      {error && (
        <Card className="border-destructive/20 bg-destructive/5">
          <CardContent className="pt-6">
            <p className="text-destructive text-[15px]">{error}</p>
          </CardContent>
        </Card>
      )}

      {triggered.length > 0 && (
        <Card>
          <CardHeader>
            <CardDescription>Tetiklenen Uyarılar</CardDescription>
            <CardTitle className="mt-1 flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Son tetiklenen uyarılar
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {triggered.map((a) => (
                <li
                  key={a.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-secondary/30 p-4"
                >
                  <div>
                    <span className="font-medium text-foreground text-[15px]">{typeLabel(a.type)}</span>
                    {a.parameters && typeof a.parameters === "object" && (
                      <span className="text-[13px] text-muted-foreground ml-2">
                        {JSON.stringify(a.parameters)}
                      </span>
                    )}
                    {a.last_triggered_at && (
                      <p className="text-[12px] text-muted-foreground mt-1">
                        Tetiklenme: {formatDate(a.last_triggered_at)}
                        {a.triggered_value_snapshot &&
                          ` — ${JSON.stringify(a.triggered_value_snapshot)}`}
                      </p>
                    )}
                  </div>
                  <Link href={`/dashboard/bonds/${(a.parameters as Record<string, string>)?.isin || ""}`}>
                    <Button variant="outline" size="sm">Tahvil</Button>
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardDescription>Uyarılarım</CardDescription>
              <CardTitle className="mt-1">Tüm uyarılar</CardTitle>
            </div>
            <Button onClick={openAdd} className="gap-2">
              <Plus className="h-4 w-4" />
              Uyarı ekle
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {formOpen && (
            <div className="mb-6 rounded-xl border border-border bg-secondary/20 p-5 space-y-4">
              <h3 className="font-semibold text-[17px] text-foreground">
                {editingId ? "Uyarıyı düzenle" : "Yeni uyarı"}
              </h3>
              <div>
                <label className="block text-[15px] font-medium text-foreground mb-1.5">Tür</label>
                <select
                  value={formType}
                  onChange={(e) => setFormType(e.target.value)}
                  className="w-full h-11 rounded-[10px] border border-border bg-card px-4 py-2.5 text-[15px] text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                >
                  {ALERT_TYPES.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              {needIsin && (
                <div>
                  <label className="block text-[15px] font-medium text-foreground mb-1.5">Tahvil (ISIN)</label>
                  <select
                    value={formIsin}
                    onChange={(e) => setFormIsin(e.target.value)}
                    className="w-full h-11 rounded-[10px] border border-border bg-card px-4 py-2.5 text-[15px] text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                  >
                    <option value="">Seçin</option>
                    {bonds.map((b) => (
                      <option key={b.id} value={b.isin_code}>
                        {b.isin_code} — {b.issuer || ""}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {needThreshold && (
                <div>
                  <label className="block text-[15px] font-medium text-foreground mb-1.5">
                    Eşik {formType.includes("ytm") ? "(%)" : formType.includes("tlref") ? "(%, örn. 1)" : ""}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formThreshold}
                    onChange={(e) => setFormThreshold(e.target.value)}
                    className="w-full h-11 rounded-[10px] border border-border bg-card px-4 py-2.5 font-mono text-[15px] text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                    placeholder={formType.includes("tlref") ? "1" : "15"}
                  />
                </div>
              )}
              {needDays && (
                <div>
                  <label className="block text-[15px] font-medium text-foreground mb-1.5">Vadeye kalan gün</label>
                  <input
                    type="number"
                    min="1"
                    value={formDays}
                    onChange={(e) => setFormDays(e.target.value)}
                    className="w-full h-11 rounded-[10px] border border-border bg-card px-4 py-2.5 font-mono text-[15px] text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                    placeholder="30"
                  />
                </div>
              )}
              <div className="flex gap-3 pt-1">
                <Button onClick={() => submitForm()} disabled={submitting}>
                  {submitting ? "Kaydediliyor..." : "Kaydet"}
                </Button>
                <Button variant="outline" onClick={() => setFormOpen(false)}>
                  İptal
                </Button>
              </div>
            </div>
          )}

          {alerts.length === 0 ? (
            <p className="text-[15px] text-muted-foreground py-4">
              Henüz uyarı tanımlanmamış. &quot;Uyarı ekle&quot; ile ekleyin.
            </p>
          ) : (
            <ul className="space-y-2">
              {alerts.map((a) => (
                <li
                  key={a.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border p-4"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-[15px]">{typeLabel(a.type)}</span>
                    {!a.is_active && <Badge variant="secondary">Pasif</Badge>}
                    {Boolean((a.parameters as Record<string, unknown>)?.isin) && (
                      <Link
                        href={`/dashboard/bonds/${(a.parameters as Record<string, string>).isin}`}
                        className="text-[13px] text-primary hover:underline"
                      >
                        {(a.parameters as Record<string, string>).isin}
                      </Link>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(a)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteAlert(a.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
