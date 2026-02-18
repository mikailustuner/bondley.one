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
    const error = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(error.detail || `API Error: ${res.status}`);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

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
    /** Admin-only: tum kullanicilari listeler */
    usersList: (token: string) =>
      apiFetch<{ id: number; email: string; full_name: string | null; company: string | null; location: string | null; role: string; is_active: boolean; created_at: string }[]>(
        "/auth/users",
        { token },
      ),
  },

  admin: {
    /** Admin-only: tahvil, TLREF, kullanici sayilari */
    stats: (token: string) =>
      apiFetch<{ bonds_count: number; tlref_count: number; users_count: number }>("/admin/stats", { token }),
  },

  bonds: {
    list: (token: string, params?: { skip?: number; limit?: number; active_only?: boolean }) => {
      const query = new URLSearchParams();
      if (params?.skip) query.set("skip", String(params.skip));
      if (params?.limit) query.set("limit", String(params.limit));
      if (params?.active_only !== undefined) query.set("active_only", String(params.active_only));
      return apiFetch<{ items: any[]; total: number }>(`/bonds/?${query}`, { token });
    },
    get: (token: string, isin: string) => apiFetch<any>(`/bonds/${isin}`, { token }),
  },

  marketData: {
    get: (token: string, isin: string, params?: { start_date?: string; end_date?: string }) => {
      const query = new URLSearchParams();
      if (params?.start_date) query.set("start_date", params.start_date);
      if (params?.end_date) query.set("end_date", params.end_date);
      return apiFetch<any[]>(`/market-data/${isin}?${query}`, { token });
    },
  },

  calculations: {
    get: (token: string, isin: string) =>
      apiFetch<any[]>(`/calculations/${isin}`, { token }),
    run: (token: string, bondId: number) =>
      apiFetch<any>("/calculations/run", {
        method: "POST",
        body: JSON.stringify({ bond_id: bondId }),
        token,
      }),
    runAll: (token: string) =>
      apiFetch<any>("/calculations/run-all", { method: "POST", token }),
  },

  tlref: {
    latest: (token: string) => apiFetch<any>("/tlref/latest", { token }),
    history: (token: string, params?: { start_date?: string; limit?: number }) => {
      const query = new URLSearchParams();
      if (params?.start_date) query.set("start_date", params.start_date);
      if (params?.limit) query.set("limit", String(params.limit));
      return apiFetch<{ items: any[]; total: number }>(`/tlref/history?${query}`, { token });
    },
    fetchDaily: (token: string) =>
      apiFetch<any>("/tlref/fetch-daily", { method: "POST", token }),
    fetchHistorical: (token: string) =>
      apiFetch<any>("/tlref/fetch-historical", { method: "POST", token }),
    /** Admin-only: BIST tarihsel + günlük TLREF indirip DB'ye yazar */
    syncNow: (token: string) =>
      apiFetch<{ historical: any; daily: any }>("/tlref/sync-now", { method: "POST", token }),
  },
};
