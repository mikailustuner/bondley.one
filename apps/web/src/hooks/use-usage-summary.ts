"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { getToken } from "@/lib/auth";

export interface UsageSummary {
  this_month_bonds_viewed: number;
  most_viewed_bonds: Array<{ isin_code: string; issuer: string; view_count: number }>;
  total_views_this_month: number;
  start_date: string;
  end_date: string;
}

export function useUsageSummary() {
  const [summary, setSummary] = useState<UsageSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setLoading(false);
      return;
    }

    api.metrics
      .summary(token)
      .then(setSummary)
      .catch(() => setError("Özet yüklenemedi"))
      .finally(() => setLoading(false));
  }, []);

  return { summary, loading, error };
}
