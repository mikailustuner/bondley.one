const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

type FetchOptions = RequestInit & { token?: string; skipRefresh?: boolean };

// Track refresh attempts to prevent infinite loops
let isRefreshing = false;
let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  // If already refreshing, wait for the existing promise
  if (isRefreshing && refreshPromise) {
    return refreshPromise;
  }

  isRefreshing = true;
  refreshPromise = (async () => {
    try {
      const { getRefreshToken, setAuth, clearAuth } = await import("./auth");
      const refreshToken = getRefreshToken();

      if (!refreshToken) {
        clearAuth();
        return null;
      }

      const response = await fetch(`${API_BASE}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });

      if (!response.ok) {
        clearAuth();
        return null;
      }

      const data = await response.json();
      setAuth(data.access_token, data.refresh_token, data.user);
      return data.access_token;
    } catch (error) {
      const { clearAuth } = await import("./auth");
      clearAuth();
      return null;
    } finally {
      isRefreshing = false;
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

async function apiFetch<T>(endpoint: string, options: FetchOptions = {}): Promise<T> {
  const { token, headers: customHeaders, skipRefresh = false, ...rest } = options;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((customHeaders as Record<string, string>) || {}),
  };

  let currentToken = token;

  if (currentToken) {
    headers["Authorization"] = `Bearer ${currentToken}`;
  }

  let res = await fetch(`${API_BASE}${endpoint}`, { headers, ...rest });

  // Handle 401 Unauthorized - try to refresh token
  if (res.status === 401 && !skipRefresh && endpoint !== "/auth/refresh" && endpoint !== "/auth/login" && endpoint !== "/auth/signup" && endpoint !== "/auth/mfa/verify") {
    const newToken = await refreshAccessToken();

    if (newToken) {
      // Retry the original request with new token
      headers["Authorization"] = `Bearer ${newToken}`;
      res = await fetch(`${API_BASE}${endpoint}`, { headers, ...rest });
    } else {
      // Refresh failed, redirect to login
      if (typeof window !== "undefined") {
        window.location.href = "/login";
      }
      const body = await res.json().catch(() => ({ detail: "Unauthorized" }));
      throw new Error(body.detail || "Unauthorized");
    }
  }

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
  tlref_index_change_pct: number | null;
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
  return_to_date_pct: number | null;
  return_to_date_used_fallback_price?: boolean;
  used_fallback_market_data?: boolean;
  market_data_date?: string | null;
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
  is_favorite?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  kap_data?: Record<string, any> | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  kap_disclosures?: Record<string, any>[] | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data_conflicts?: Record<string, any>[] | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data_sources?: Record<string, any>[] | null;
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
  by_maturity_bucket?: { short: number; medium: number; long: number };
}

// --- Auth / User types (including MFA) ---

export interface UserMe {
  id: number;
  email: string;
  full_name: string | null;
  company: string | null;
  location: string | null;
  department: string | null;
  job_title: string | null;
  usage_purpose: string | null;
  estimated_daily_views: number | null;
  profile_completed: boolean;
  role: string;
  is_active: boolean;
  is_email_verified: boolean;
  mfa_enabled: boolean;
  created_at: string;
}

export type LoginResponse =
  | { access_token: string; refresh_token: string; user: UserMe }
  | { mfa_required: true; mfa_token: string; user: UserMe };

// --- API ---

export const api = {
  auth: {
    login: (email: string, password: string) =>
      apiFetch<LoginResponse>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
        skipRefresh: true,
      }),
    signup: (data: {
      email: string;
      password: string;
      full_name: string;
      company: string;
      location: string;
    }) =>
      apiFetch<{ access_token: string; refresh_token: string; user: any }>("/auth/signup", {
        method: "POST",
        body: JSON.stringify(data),
        skipRefresh: true,
      }),
    refresh: (refreshToken: string) =>
      apiFetch<{ access_token: string; refresh_token: string; user: any }>("/auth/refresh", {
        method: "POST",
        body: JSON.stringify({ refresh_token: refreshToken }),
        skipRefresh: true,
      }),
    logout: (token: string, refreshToken: string) =>
      apiFetch<{ message: string }>("/auth/logout", {
        method: "POST",
        token,
        body: JSON.stringify({ refresh_token: refreshToken }),
      }),
    logoutAll: (token: string) =>
      apiFetch<{ message: string }>("/auth/logout-all", {
        method: "POST",
        token,
      }),
    me: (token: string) => apiFetch<UserMe>("/auth/me", { token }),
    mfaSetup: (token: string) =>
      apiFetch<{ secret: string; qr_uri: string }>("/auth/mfa/setup", {
        method: "POST",
        token,
      }),
    mfaConfirm: (token: string, code: string) =>
      apiFetch<{ backup_codes: string[]; message: string }>("/auth/mfa/confirm", {
        method: "POST",
        token,
        body: JSON.stringify({ code }),
      }),
    mfaVerify: (mfaToken: string, code: string) =>
      apiFetch<{ access_token: string; refresh_token: string; user: UserMe }>("/auth/mfa/verify", {
        method: "POST",
        body: JSON.stringify({ mfa_token: mfaToken, code }),
        skipRefresh: true,
      }),
    mfaDisable: (token: string, password: string) =>
      apiFetch<{ message: string }>("/auth/mfa/disable", {
        method: "POST",
        token,
        body: JSON.stringify({ password }),
      }),
    updateProfile: (token: string, data: { full_name?: string; company?: string; location?: string }) =>
      apiFetch<any>("/auth/me", {
        method: "PUT",
        token,
        body: JSON.stringify(data),
      }),
    onboarding: (token: string, data: {
      department: string;
      job_title: string;
      usage_purpose: string;
      estimated_daily_views: number;
    }) =>
      apiFetch<UserMe>("/auth/onboarding", {
        method: "POST",
        token,
        body: JSON.stringify(data),
      }),
    changePassword: (token: string, data: { current_password: string; new_password: string }) =>
      apiFetch<{ message: string }>("/auth/change-password", {
        method: "POST",
        token,
        body: JSON.stringify(data),
      }),
    changeEmail: (token: string, data: { new_email: string }) =>
      apiFetch<any>("/auth/change-email", {
        method: "POST",
        token,
        body: JSON.stringify(data),
      }),
    verifyEmail: (token: string) =>
      apiFetch<{ message: string }>("/auth/verify-email", {
        method: "POST",
        body: JSON.stringify({ token }),
        skipRefresh: true,
      }),
    resendVerification: (email: string) =>
      apiFetch<{ message: string }>("/auth/resend-verification", {
        method: "POST",
        body: JSON.stringify({ email }),
        skipRefresh: true,
      }),
    getPermissions: (token: string) =>
      apiFetch<{
        role: string;
        is_admin: boolean;
        is_pro_user: boolean;
        is_premium_user: boolean;
        role_level: number;
      }>("/auth/permissions", { token }),
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
    getDataHealth: (token: string) =>
      apiFetch<{
        total_active_bonds: number;
        total_issues: number;
        bonds_with_issues: Array<{
          isin_code: string;
          issuer: string | null;
          maturity_date: string | null;
          issue_date: string | null;
          tbliste_updated_at: string | null;
          issues: string[];
        }>;
      }>("/admin/data-health", { token }),
    publicSummary: () => apiFetch<PublicSummary>("/admin/public-summary"),
    syncAll: (token: string) =>
      apiFetch<{ tlref_historical: any; tlref_daily: any; bonds: any }>("/admin/sync-all", {
        method: "POST",
        token,
      }),
    updateUser: (token: string, userId: number, data: { full_name?: string; company?: string; location?: string }) =>
      apiFetch<any>(`/admin/users/${userId}`, {
        method: "PUT",
        token,
        body: JSON.stringify(data),
      }),
    updateUserRole: (token: string, userId: number, role: string) =>
      apiFetch<any>(`/admin/users/${userId}/role?role=${role}`, {
        method: "PUT",
        token,
      }),
    updateUserStatus: (token: string, userId: number, is_active: boolean) =>
      apiFetch<any>(`/admin/users/${userId}/status?is_active=${is_active}`, {
        method: "PUT",
        token,
      }),
    toggleMaintenance: (token: string, is_active: boolean) =>
      apiFetch<{ message: string; maintenance_mode: boolean }>(`/admin/maintenance?is_active=${is_active}`, {
        method: "POST",
        token,
      }),
    deleteUser: (token: string, userId: number) =>
      apiFetch<void>(`/admin/users/${userId}`, {
        method: "DELETE",
        token,
      }),
    getLogs: (
      token: string,
      params?: {
        skip?: number;
        limit?: number;
        user_id?: number;
        action?: string;
        resource_type?: string;
        resource_id?: string;
        start_date?: string;
        end_date?: string;
      },
    ) => {
      const query = new URLSearchParams();
      if (params?.skip !== undefined) query.set("skip", String(params.skip));
      if (params?.limit !== undefined) query.set("limit", String(params.limit));
      if (params?.user_id !== undefined) query.set("user_id", String(params.user_id));
      if (params?.action) query.set("action", params.action);
      if (params?.resource_type) query.set("resource_type", params.resource_type);
      if (params?.resource_id) query.set("resource_id", params.resource_id);
      if (params?.start_date) query.set("start_date", params.start_date);
      if (params?.end_date) query.set("end_date", params.end_date);
      return apiFetch<{
        logs: Array<{
          id: number;
          user_id: number | null;
          action: string;
          resource_type: string | null;
          resource_id: string | null;
          ip_address: string | null;
          request_method: string | null;
          request_path: string | null;
          status_code: number | null;
          details: any;
          created_at: string;
        }>;
        total: number;
        skip: number;
        limit: number;
      }>(`/admin/logs?${query}`, { token });
    },
    getLogDetail: (token: string, logId: number) =>
      apiFetch<any>(`/admin/logs/${logId}`, { token }),
    getLogStats: (token: string, params?: { start_date?: string; end_date?: string }) => {
      const query = new URLSearchParams();
      if (params?.start_date) query.set("start_date", params.start_date);
      if (params?.end_date) query.set("end_date", params.end_date);
      return apiFetch<{ stats: Record<string, number>; start_date: string | null; end_date: string | null }>(
        `/admin/logs/stats?${query}`,
        { token },
      );
    },
    getBondMetrics: (token: string, params?: { limit?: number; start_date?: string; end_date?: string }) => {
      const query = new URLSearchParams();
      if (params?.limit !== undefined) query.set("limit", String(params.limit));
      if (params?.start_date) query.set("start_date", params.start_date);
      if (params?.end_date) query.set("end_date", params.end_date);
      return apiFetch<{
        bonds: Array<{
          bond_id: number;
          isin_code: string;
          issuer: string | null;
          view_count: number;
          unique_users: number;
        }>;
      }>(`/admin/metrics/bonds?${query}`, { token });
    },
    getUserMetrics: (token: string, params?: { limit?: number; start_date?: string; end_date?: string }) => {
      const query = new URLSearchParams();
      if (params?.limit !== undefined) query.set("limit", String(params.limit));
      if (params?.start_date) query.set("start_date", params.start_date);
      if (params?.end_date) query.set("end_date", params.end_date);
      return apiFetch<{
        users: Array<{
          user_id: number;
          total_bonds_viewed: number;
          total_api_calls: number;
          total_calculations: number;
        }>;
      }>(`/admin/metrics/users?${query}`, { token });
    },
    getMetricsOverview: (token: string, days?: number) => {
      const query = new URLSearchParams();
      if (days !== undefined) query.set("days", String(days));
      return apiFetch<{
        period_days: number;
        start_date: string;
        end_date: string;
        total_bond_views: number;
        unique_users: number;
        total_api_calls: number;
        total_calculations: number;
      }>(`/admin/metrics/overview?${query}`, { token });
    },
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
        order_by?: "maturity_date_asc" | "days_to_maturity_asc" | "last_issue_yield_desc" | "updated_at_desc";
        max_days_to_maturity?: number;
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
      if (params?.order_by) query.set("order_by", params.order_by);
      if (params?.max_days_to_maturity != null)
        query.set("max_days_to_maturity", String(params.max_days_to_maturity));
      return apiFetch<BondListResponse>(`/bonds/?${query}`, { token });
    },
    get: (token: string, isin: string, params?: { settlement_date?: string }) => {
      const query = new URLSearchParams();
      if (params?.settlement_date) query.set("settlement_date", params.settlement_date);
      const qs = query.toString();
      return apiFetch<BondDetail>(`/bonds/${isin}${qs ? `?${qs}` : ""}`, { token });
    },
    scenario: (
      token: string,
      isin: string,
      params: { settlement_date?: string; tlref_shock_bp: number }
    ) => {
      const query = new URLSearchParams();
      if (params.settlement_date) query.set("settlement_date", params.settlement_date);
      query.set("tlref_shock_bp", String(params.tlref_shock_bp));
      return apiFetch<{
        current_ytm: number;
        current_dirty_price: number;
        shock_bp: number;
        new_ytm_approx: number;
        new_dirty_price_approx: number;
        price_change_pct: number;
        modified_duration: number | null;
      }>(`/bonds/${encodeURIComponent(isin)}/scenario?${query}`, { token });
    },
    stats: (token: string) => apiFetch<BondStats>("/bonds/stats", { token }),
    favoritesList: (token: string) =>
      apiFetch<{ items: BondListItem[] }>("/bonds/favorites", { token }),
    addFavorite: (token: string, isinCode: string) =>
      apiFetch<{ status: string }>("/bonds/favorites", {
        method: "POST",
        token,
        body: JSON.stringify({ isin_code: isinCode }),
      }),
    removeFavorite: (token: string, isinCode: string) =>
      apiFetch<void>(`/bonds/favorites/${encodeURIComponent(isinCode)}`, {
        method: "DELETE",
        token,
      }),
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

  metrics: {
    getMyStats: (token: string, params?: { start_date?: string; end_date?: string }) => {
      const query = new URLSearchParams();
      if (params?.start_date) query.set("start_date", params.start_date);
      if (params?.end_date) query.set("end_date", params.end_date);
      return apiFetch<{
        user_id: number;
        metrics: Array<{
          date: string;
          bonds_viewed: number;
          api_calls: number;
          calculations_run: number;
        }>;
      }>(`/metrics/my-stats?${query}`, { token });
    },
    summary: (token: string, params?: { start_date?: string; end_date?: string }) => {
      const query = new URLSearchParams();
      if (params?.start_date) query.set("start_date", params.start_date);
      if (params?.end_date) query.set("end_date", params.end_date);
      return apiFetch<{
        this_month_bonds_viewed: number;
        most_viewed_bonds: Array<{ isin_code: string; issuer: string; view_count: number }>;
        total_views_this_month: number;
        start_date: string;
        end_date: string;
      }>(`/metrics/summary${query.toString() ? `?${query}` : ""}`, { token });
    },
  },

  alerts: {
    list: (token: string) => apiFetch<AlertRecord[]>("/alerts/", { token }),
    triggered: (token: string) => apiFetch<AlertRecord[]>("/alerts/triggered", { token }),
    create: (token: string, body: { type: string; parameters: Record<string, unknown> }) =>
      apiFetch<AlertRecord>("/alerts/", { method: "POST", token, body: JSON.stringify(body) }),
    update: (
      token: string,
      id: number,
      body: { type?: string; parameters?: Record<string, unknown>; is_active?: boolean }
    ) =>
      apiFetch<AlertRecord>(`/alerts/${id}`, {
        method: "PATCH",
        token,
        body: JSON.stringify(body),
      }),
    delete: (token: string, id: number) =>
      apiFetch<void>(`/alerts/${id}`, { method: "DELETE", token }),
  },

  system: {
    getMaintenanceStatus: () => apiFetch<{ is_maintenance: boolean }>("/system/maintenance"),
  },
};

export interface AlertRecord {
  id: number;
  user_id: number;
  type: string;
  parameters: Record<string, unknown>;
  is_active: boolean;
  last_triggered_at: string | null;
  triggered_value_snapshot: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}
