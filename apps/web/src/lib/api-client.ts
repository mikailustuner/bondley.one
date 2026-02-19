const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

type FetchOptions = RequestInit & { token?: string };

async function apiFetch<T>(endpoint: string, options: FetchOptions = {}): Promise<T> {
  const { token, headers: customHeaders, ...rest } = options;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((customHeaders as Record<string, string>) || {}),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${endpoint}`, { headers, ...rest });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }));
    const detail = body.detail;
    const message =
      typeof detail === "string"
        ? detail
        : Array.isArray(detail) && detail.length > 0
          ? detail.map((e: { msg?: string }) => e.msg ?? "").filter(Boolean).join("; ") || `API Error: ${res.status}`
          : (body as { message?: string }).message ?? `API Error: ${res.status}`;
    throw new Error(message);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

// --- TLREF Types ---

export interface TLREFRecord {
  id: number;
  rate_date: string;
  index_value: number;
  daily_rate: number | null;
  source: string;
  created_at: string;
}

export interface TLREFStats {
  total_records: number;
  latest_date: string;
  latest_index: number;
  latest_daily_rate: number | null;
  first_date: string;
  first_index: number;
  cumulative_return_pct: number | null;
  annualized_rate_pct: number | null;
}

export interface PublicSummary {
  tlref_index: number | null;
  tlref_date: string | null;
  tlref_daily_rate: number | null;
  tlref_annualized_rate: number | null;
  total_tlref_records: number;
  total_bonds: number;
}

// --- Bond Types ---
// API units: last_issue_yield, first_issue_yield = percent (e.g. 44.5 = 44.5%). Display with formatPercent().
// next_coupon_rate = decimal (e.g. 0.05 = 5%). Display with formatPercentFromDecimal().
// BondCalculatedMetrics rates (yield_to_maturity, spread, annual_*, periodic_coupon_rate) = decimal. Use formatPercentFromDecimal().
// rate_change_today_pct = already in percent. Use formatPercent().

export interface BondListItem {
  id: number;
  isin_code: string;
  issuer: string | null;
  yield_type: string | null;
  security_type: string | null;
  currency: string;
  maturity_date: string | null;
  days_to_maturity: number | null;
  last_issue_price: number | null;
  last_issue_yield: number | null;
  next_coupon_rate: number | null;
  day_count_convention: string | null;
  is_active: boolean;
}

export interface BondCalculatedMetrics {
  annual_reference_rate: number | null;
  annual_coupon_rate: number | null;
  periodic_coupon_rate: number | null;
  accrued_interest: number;
  dirty_price: number;
  clean_price_used: number;
  rate_change_today_pct: number | null;
  yield_to_maturity: number | null;
  spread: number | null;
  modified_duration: number | null;
  macaulay_duration: number | null;
  convexity: number | null;
  coupon_payment_amount: number | null;
  period_days: number | null;
  next_coupon_date: string | null;
}

export interface BondDetail {
  id: number;
  isin_code: string;
  issuer: string | null;
  issuance_type: string | null;
  yield_type: string | null;
  security_type: string | null;
  coupon_frequency: string | null;
  currency: string;
  group_code: number | null;
  first_issue_date: string | null;
  maturity_date: string | null;
  days_to_maturity: number | null;
  total_issue_amount: number | null;
  last_issue_date_text: string | null;
  last_issue_price: number | null;
  last_issue_yield: number | null;
  first_issue_yield: number | null;
  next_coupon_date: string | null;
  next_coupon_rate: number | null;
  spread: number | null;
  first_issue_price: number | null;
  quotation_method: string | null;
  accrued_interest_text: string | null;
  clean_price_text: string | null;
  dirty_price_formula: string | null;
  settlement_price_formula: string | null;
  yield_formula: string | null;
  compound_yield_formula: string | null;
  day_count_convention: string | null;
  remarks: string | null;
  brokerage: string | null;
  security_type_detail: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  calculated_metrics?: BondCalculatedMetrics | null;
}

export interface BondListResponse {
  items: BondListItem[];
  total: number;
}

export interface BondStats {
  total_bonds: number;
  by_security_type: Record<string, number>;
  by_currency: Record<string, number>;
  by_yield_type: Record<string, number>;
  avg_days_to_maturity: number | null;
}

// --- API ---

export const api = {
  auth: {
    login: (email: string, password: string) =>
      apiFetch<{ access_token: string; user: any }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      }),
    signup: (data: {
      email: string;
      password: string;
      full_name: string;
      company: string;
      location: string;
    }) =>
      apiFetch<{ access_token: string; user: any }>("/auth/signup", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    me: (token: string) => apiFetch<any>("/auth/me", { token }),
    usersList: (token: string) =>
      apiFetch<
        {
          id: number;
          email: string;
          full_name: string | null;
          company: string | null;
          location: string | null;
          role: string;
          is_active: boolean;
          created_at: string;
        }[]
      >("/auth/users", { token }),
  },

  admin: {
    stats: (token: string) =>
      apiFetch<{ bonds_count: number; tlref_count: number; users_count: number }>(
        "/admin/stats",
        { token },
      ),
    publicSummary: () => apiFetch<PublicSummary>("/admin/public-summary"),
    syncAll: (token: string) =>
      apiFetch<{ tlref_historical: any; tlref_daily: any; bonds: any }>("/admin/sync-all", {
        method: "POST",
        token,
      }),
  },

  bonds: {
    list: (
      token: string,
      params?: {
        skip?: number;
        limit?: number;
        active_only?: boolean;
        search?: string;
        currency?: string;
        security_type?: string;
        yield_type?: string;
      },
    ) => {
      const query = new URLSearchParams();
      if (params?.skip) query.set("skip", String(params.skip));
      if (params?.limit) query.set("limit", String(params.limit));
      if (params?.active_only !== undefined) query.set("active_only", String(params.active_only));
      if (params?.search) query.set("search", params.search);
      if (params?.currency) query.set("currency", params.currency);
      if (params?.security_type) query.set("security_type", params.security_type);
      if (params?.yield_type) query.set("yield_type", params.yield_type);
      return apiFetch<BondListResponse>(`/bonds/?${query}`, { token });
    },
    get: (token: string, isin: string, params?: { settlement_date?: string }) => {
      const query = new URLSearchParams();
      if (params?.settlement_date) query.set("settlement_date", params.settlement_date);
      const qs = query.toString();
      return apiFetch<BondDetail>(`/bonds/${isin}${qs ? `?${qs}` : ""}`, { token });
    },
    stats: (token: string) => apiFetch<BondStats>("/bonds/stats", { token }),
    sync: (token: string) =>
      apiFetch<{ status: string; bonds_upserted?: number; bonds_deactivated?: number }>(
        "/bonds/sync",
        { method: "POST", token },
      ),
  },

  tlref: {
    latest: (token: string) => apiFetch<TLREFRecord | null>("/tlref/latest", { token }),
    history: (token: string, params?: { start_date?: string; limit?: number }) => {
      const query = new URLSearchParams();
      if (params?.start_date) query.set("start_date", params.start_date);
      if (params?.limit) query.set("limit", String(params.limit));
      return apiFetch<{ items: TLREFRecord[]; total: number }>(`/tlref/history?${query}`, {
        token,
      });
    },
    stats: (token: string) => apiFetch<TLREFStats>("/tlref/stats", { token }),
    syncNow: (token: string) =>
      apiFetch<{ historical: any; daily: any }>("/tlref/sync-now", { method: "POST", token }),
  },
};
