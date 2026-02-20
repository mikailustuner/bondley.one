"use client";

import { useEffect, useState } from "react";
import { api, TLREFRecord, TLREFStats, BondStats } from "@/lib/api-client";
import { getToken } from "@/lib/auth";

const TLREF_HISTORY_LIMIT = 2000;
const DATE_OPTIONS: Intl.DateTimeFormatOptions = {
  day: "2-digit",
  month: "2-digit",
  year: "2-digit",
};

export function useTlrefHistory(opts?: { withStats?: boolean; withBondStats?: boolean }) {
  const withStats = opts?.withStats ?? true;
  const withBondStats = opts?.withBondStats ?? true;

  const [history, setHistory] = useState<TLREFRecord[]>([]);
  const [stats, setStats] = useState<TLREFStats | null>(null);
  const [bondStats, setBondStats] = useState<BondStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setError("Giriş yapmanız gerekiyor");
      setLoading(false);
      return;
    }

    (async () => {
      try {
        const tasks: [Promise<{ items: TLREFRecord[] }>, Promise<TLREFStats> | null, Promise<BondStats | null> | null] = [
          api.tlref.history(token, { limit: TLREF_HISTORY_LIMIT }),
          withStats ? api.tlref.stats(token) : null,
          withBondStats ? api.bonds.stats(token).catch(() => null) : null,
        ];
        const [historyRes, statsRes, bondStatsRes] = await Promise.all([
          tasks[0],
          tasks[1] ?? Promise.resolve(null),
          tasks[2] ?? Promise.resolve(null),
        ]);
        setHistory(historyRes.items?.reverse() ?? []);
        setStats(statsRes);
        setBondStats(bondStatsRes ?? null);
        setError(null);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Veri yuklenemedi");
      } finally {
        setLoading(false);
      }
    })();
  }, [withStats, withBondStats]);

  const indexData = history.map((r) => ({
    date: new Date(r.rate_date).toLocaleDateString("tr-TR", DATE_OPTIONS),
    value: r.index_value,
  }));

  const rateData = history
    .filter((r) => r.daily_rate != null)
    .map((r) => ({
      date: new Date(r.rate_date).toLocaleDateString("tr-TR", DATE_OPTIONS),
      rate: +(r.daily_rate! * 100).toFixed(6),
    }));

  return { history, indexData, rateData, stats, bondStats, loading, error };
}
