"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api-client";
import { getToken } from "@/lib/auth";
import { tr } from "@/locales/tr";

type LogEntry = {
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
};

export default function AdminLogsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [skip, setSkip] = useState(0);
  const [limit] = useState(50);
  const [filters, setFilters] = useState({
    action: "",
    user_id: "",
    resource_type: "",
    start_date: "",
    end_date: "",
  });

  const loadLogs = async () => {
    const token = getToken();
    if (!token) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const params: any = {
        skip,
        limit,
      };
      if (filters.action) params.action = filters.action;
      if (filters.user_id) params.user_id = parseInt(filters.user_id);
      if (filters.resource_type) params.resource_type = filters.resource_type;
      if (filters.start_date) params.start_date = filters.start_date;
      if (filters.end_date) params.end_date = filters.end_date;

      const data = await api.admin.getLogs(token, params);
      setLogs(data.logs);
      setTotal(data.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : tr.admin.logs.error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, [skip, filters]);

  return (
    <div className="space-y-6">
      <div className="animate-fade-up">
        <h1 className="font-display text-display-md text-foreground">{tr.admin.logs.title}</h1>
        <p className="text-data-sm text-muted-foreground mt-1">{tr.admin.logs.description}</p>
      </div>

      {/* Filters */}
      <Card className="animate-fade-up-delay-1">
        <CardHeader>
          <CardDescription>{tr.admin.logs.filters.label}</CardDescription>
          <CardTitle className="mt-1">{tr.admin.logs.filters.title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">{tr.admin.logs.filters.action}</label>
              <Input
                value={filters.action}
                onChange={(e) => setFilters({ ...filters, action: e.target.value })}
                placeholder={tr.admin.logs.filters.actionPlaceholder}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{tr.admin.logs.filters.userId}</label>
              <Input
                type="number"
                value={filters.user_id}
                onChange={(e) => setFilters({ ...filters, user_id: e.target.value })}
                placeholder={tr.admin.logs.filters.userId}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{tr.admin.logs.filters.resourceType}</label>
              <Input
                value={filters.resource_type}
                onChange={(e) => setFilters({ ...filters, resource_type: e.target.value })}
                placeholder={tr.admin.logs.filters.resourcePlaceholder}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{tr.admin.logs.filters.startDate}</label>
              <Input
                type="date"
                value={filters.start_date}
                onChange={(e) => setFilters({ ...filters, start_date: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{tr.admin.logs.filters.endDate}</label>
              <Input
                type="date"
                value={filters.end_date}
                onChange={(e) => setFilters({ ...filters, end_date: e.target.value })}
              />
            </div>
            <div className="flex items-end">
              <Button onClick={() => setFilters({ action: "", user_id: "", resource_type: "", start_date: "", end_date: "" })}>
                {tr.admin.logs.filters.clear}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Logs Table */}
      <Card className="animate-fade-up-delay-2">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardDescription>{tr.admin.logs.card.label}</CardDescription>
              <CardTitle className="mt-1">{tr.admin.logs.card.title}</CardTitle>
            </div>
            <span className="text-label text-muted-foreground">{total} {tr.admin.bonds.card.records}</span>
          </div>
        </CardHeader>
        <CardContent>
          {error && <p className="text-data-sm text-destructive mb-4">{error}</p>}
          {loading ? (
            <p className="text-data-sm text-muted-foreground">{tr.common.loading}…</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      {[
                        tr.admin.logs.table.id,
                        tr.admin.logs.table.date,
                        tr.admin.logs.table.action,
                        tr.admin.logs.table.user,
                        tr.admin.logs.table.resource,
                        tr.admin.logs.table.method,
                        tr.admin.logs.table.path,
                        tr.admin.logs.table.status
                      ].map((h) => (
                        <th key={h} scope="col" className="pb-3 text-label text-muted-foreground font-normal text-left">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log) => (
                      <tr key={log.id} className="border-b border-border/30 last:border-0 hover:bg-secondary/30 transition-colors">
                        <td className="py-3 font-mono-data text-data-sm text-muted-foreground">{log.id}</td>
                        <td className="py-3 text-data-sm text-muted-foreground">
                          {new Date(log.created_at).toLocaleString("tr-TR")}
                        </td>
                        <td className="py-3 text-data-sm text-foreground">{log.action}</td>
                        <td className="py-3 text-data-sm text-muted-foreground">{log.user_id || "—"}</td>
                        <td className="py-3 text-data-sm text-muted-foreground">
                          {log.resource_type ? `${log.resource_type}:${log.resource_id || ""}` : "—"}
                        </td>
                        <td className="py-3 text-data-sm text-muted-foreground">{log.request_method || "—"}</td>
                        <td className="py-3 text-data-sm text-muted-foreground font-mono-data truncate max-w-xs">
                          {log.request_path || "—"}
                        </td>
                        <td className="py-3 text-data-sm text-muted-foreground">{log.status_code || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between mt-4">
                <Button
                  variant="outline"
                  onClick={() => setSkip(Math.max(0, skip - limit))}
                  disabled={skip === 0}
                >
                  {tr.admin.logs.pagination.previous}
                </Button>
                <span className="text-sm text-muted-foreground">
                  {skip + 1}-{Math.min(skip + limit, total)} / {total}
                </span>
                <Button
                  variant="outline"
                  onClick={() => setSkip(skip + limit)}
                  disabled={skip + limit >= total}
                >
                  {tr.admin.logs.pagination.next}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
