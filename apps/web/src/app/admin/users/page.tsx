"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Eye, User, Briefcase, Info, Calendar, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api-client";
import { getToken } from "@/lib/auth";
import { tr } from "@/locales/tr";

type UserRow = {
  id: number;
  email: string;
  full_name: string | null;
  company: string | null;
  location: string | null;
  role: string;
  is_active: boolean;
  department: string | null;
  job_title: string | null;
  usage_purpose: string | null;
  estimated_daily_views: number | null;
  profile_completed: boolean;
  created_at: string;
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRow | null>(null);
  const [viewingUser, setViewingUser] = useState<UserRow | null>(null);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    full_name: "",
    company: "",
    location: "",
    role: "free_user",
  });

  const loadUsers = async () => {
    const token = getToken();
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const data = await api.auth.usersList(token);
      setUsers(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : tr.admin.users.errors.load);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between animate-fade-up">
        <div>
          <h1 className="font-display text-display-md text-foreground">{tr.admin.users.title}</h1>
          <p className="text-data-sm text-muted-foreground mt-1">{tr.admin.users.description}</p>
        </div>
        <Button onClick={() => setShowCreateModal(true)}>{tr.admin.users.form.new}</Button>
      </div>

      <Card className="animate-fade-up-delay-1">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardDescription>{tr.dashboard.sidebar.liveData.toUpperCase()}</CardDescription>
              <CardTitle className="mt-1">{tr.admin.users.listTitle}</CardTitle>
            </div>
            <span className="text-label text-muted-foreground">{users.length} {tr.dashboard.overview.table.count.split(" ")[1].toUpperCase()}</span>
          </div>
        </CardHeader>
        <CardContent>
          {error && <p className="text-data-sm text-destructive mb-4">{error}</p>}
          {loading ? (
            <p className="text-data-sm text-muted-foreground">{tr.common.loading}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    {[
                      tr.admin.users.table.cols.id,
                      tr.admin.users.table.cols.email,
                      tr.admin.users.table.cols.name,
                      tr.admin.users.table.cols.company,
                      tr.admin.users.table.cols.role,
                      tr.admin.users.table.cols.status,
                      tr.admin.users.table.cols.actions
                    ].map((h, i) => (
                      <th
                        key={h}
                        scope="col"
                        className={`pb-3 text-label text-muted-foreground font-normal ${i === 6 ? "text-right" : "text-left"}`}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id} className="border-b border-border/30 last:border-0 hover:bg-secondary/30 transition-colors">
                      <td className="py-3 font-mono-data text-data-sm text-muted-foreground">{user.id}</td>
                      <td className="py-3 font-mono-data text-data-sm text-foreground">{user.email}</td>
                      <td className="py-3 text-data-sm text-foreground">{user.full_name ?? "—"}</td>
                      <td className="py-3 text-data-sm text-muted-foreground">{user.company ?? "—"}</td>
                      <td className="py-3">
                        <Badge variant={user.role === "admin" ? "default" : "secondary"}>
                          {user.role.toUpperCase()}
                        </Badge>
                      </td>
                      <td className="py-3">
                        <Badge variant={user.is_active ? "default" : "secondary"}>
                          {user.is_active ? tr.admin.users.status.active : tr.admin.users.status.passive}
                        </Badge>
                      </td>
                      <td className="py-3 text-right">
                        <div className="flex gap-2 justify-end">
                          <Button
                            size="sm"
                            variant="outline"
                            className="bg-primary/5 border-primary/20 text-primary hover:bg-primary/10 font-medium transition-all duration-300 rounded-full px-4"
                            onClick={() => setViewingUser(user)}
                          >
                            <Eye className="w-4 h-4 mr-2" />
                            {tr.admin.users.actions.examine}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditingUser(user);
                              setFormData({
                                email: user.email,
                                password: "",
                                full_name: user.full_name || "",
                                company: user.company || "",
                                location: user.location || "",
                                role: user.role,
                              });
                            }}
                          >
                            {tr.admin.users.actions.edit}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                               if (confirm(tr.admin.users.table.confirmRoleChange.replace("{email}", user.email))) {
                                try {
                                  const newRole = user.role === "admin" ? "free_user" : user.role === "free_user" ? "premium_user" : user.role === "premium_user" ? "pro_user" : "admin";
                                  await api.admin.updateUserRole(token, user.id, newRole);
                                  await loadUsers();
                                } catch (e) {
                                  alert(e instanceof Error ? e.message : tr.admin.users.errors.generic);
                                }
                              }
                            }}
                          >
                            {tr.admin.users.table.actions.changeRole}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={async () => {
                              const token = getToken();
                              if (!token) return;
                              try {
                                await api.admin.updateUserStatus(token, user.id, !user.is_active);
                                await loadUsers();
                              } catch (e) {
                                alert(e instanceof Error ? e.message : tr.admin.users.errors.generic);
                              }
                            }}
                          >
                            {user.is_active ? tr.admin.users.status.deactivate : tr.admin.users.status.activate}
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                               if (confirm(tr.admin.users.confirmDelete.replace("{email}", user.email))) {
                                try {
                                  await api.admin.deleteUser(token, user.id);
                                  await loadUsers();
                                } catch (e) {
                                  alert(e instanceof Error ? e.message : tr.admin.users.errors.generic);
                                }
                              }
                            }}
                          >
                            {tr.admin.users.status.delete}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Modal */}
      {(showCreateModal || editingUser) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background p-6 rounded-lg max-w-md w-full mx-4">
            <h2 className="text-lg font-semibold mb-4">
              {editingUser ? tr.admin.users.form.edit : tr.admin.users.form.new}
            </h2>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const token = getToken();
                if (!token) return;

                try {
                  if (editingUser) {
                    await api.admin.updateUser(token, editingUser.id, {
                      full_name: formData.full_name,
                      company: formData.company,
                      location: formData.location,
                    });
                    if (formData.role !== editingUser.role) {
                      await api.admin.updateUserRole(token, editingUser.id, formData.role);
                    }
                  } else {
                    await api.auth.signup({
                      email: formData.email,
                      password: formData.password,
                      full_name: formData.full_name,
                      company: formData.company,
                      location: formData.location,
                      privacy_policy_accepted: true,
                    });
                    // After signup, admin needs to update role
                    const newUsers = await api.auth.usersList(token);
                    const newUser = newUsers.find((u) => u.email === formData.email);
                    if (newUser && formData.role !== "free_user") {
                      await api.admin.updateUserRole(token, newUser.id, formData.role);
                    }
                  }
                  setShowCreateModal(false);
                  setEditingUser(null);
                  setFormData({
                    email: "",
                    password: "",
                    full_name: "",
                    company: "",
                    location: "",
                    role: "free_user",
                  });
                  await loadUsers();
                } catch (e) {
                  alert(e instanceof Error ? e.message : tr.admin.users.errors.generic);
                }
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-sm font-medium mb-1">{tr.auth.login.emailLabel}</label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                  disabled={!!editingUser}
                />
              </div>
              {!editingUser && (
                <div>
                  <label className="block text-sm font-medium mb-1">{tr.auth.signup.fields.password}</label>
                  <Input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    required
                    minLength={8}
                  />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium mb-1">{tr.auth.signup.fields.fullName}</label>
                <Input
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{tr.auth.signup.fields.company}</label>
                <Input
                  value={formData.company}
                  onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{tr.auth.signup.fields.location}</label>
                <Input
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{tr.admin.users.table.cols.role}</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md"
                >
                  <option value="free_user">Free User</option>
                  <option value="premium_user">Premium User</option>
                  <option value="pro_user">Pro User</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div className="flex gap-2 justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowCreateModal(false);
                    setEditingUser(null);
                    setFormData({
                      email: "",
                      password: "",
                      full_name: "",
                      company: "",
                      location: "",
                      role: "free_user",
                    });
                  }}
                >
                  {tr.common.cancel}
                </Button>
                <Button type="submit">{editingUser ? tr.common.save : tr.admin.users.table.actions.view}</Button>
              </div>
            </form>
          </div>
        </div>
      )}
      
      {/* View Details Modal */}
      {viewingUser && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-md flex items-center justify-center z-[60] animate-in fade-in duration-300">
          <div className="bg-card/95 backdrop-blur-xl p-0 rounded-[32px] max-w-lg w-full mx-4 overflow-hidden border border-white/10 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.3)] animate-in zoom-in-95 duration-300">
            <div className="px-8 py-6 border-b border-border/20 bg-secondary/10 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary border border-primary/10">
                  <User className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-bold tracking-tight text-foreground">{tr.admin.users.details.title}</h2>
                  <p className="text-xs font-medium text-muted-foreground mt-0.5">{viewingUser.email}</p>
                </div>
              </div>
              <button 
                onClick={() => setViewingUser(null)}
                className="p-2 hover:bg-secondary/50 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>
            
            <div className="p-8 space-y-8 max-h-[70vh] overflow-y-auto custom-scrollbar">
              {/* Status Section */}
              <div className="flex items-center gap-3">
                <Badge variant={viewingUser.profile_completed ? "default" : "secondary"} className="rounded-full px-4 py-1 text-[10px] font-bold tracking-wider">
                  <Info className="w-3 h-3 mr-1.5" />
                  {viewingUser.profile_completed ? tr.admin.users.status.profileCompleted : tr.admin.users.status.onboardingPending}
                </Badge>
              </div>

              {/* Grid Section */}
              <div className="grid grid-cols-2 gap-x-12 gap-y-8">
                <div className="space-y-1.5">
                  <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-[0.2em]">{tr.admin.users.table.cols.name}</p>
                  <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                    {viewingUser.full_name || "—"}
                  </p>
                </div>
                <div className="space-y-1.5">
                  <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-[0.2em]">{tr.admin.users.details.registrationDate}</p>
                  <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-muted-foreground/40" />
                    {new Date(viewingUser.created_at).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </p>
                </div>
                <div className="space-y-1.5">
                  <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-[0.2em]">{tr.admin.users.table.cols.company}</p>
                  <p className="text-sm font-semibold text-foreground">{viewingUser.company || "—"}</p>
                </div>
                <div className="space-y-1.5">
                  <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-[0.2em]">{tr.auth.signup.fields.location.toUpperCase()}</p>
                  <p className="text-sm font-semibold text-foreground">{viewingUser.location || "—"}</p>
                </div>
              </div>

              <div className="h-px bg-gradient-to-r from-transparent via-border/40 to-transparent" />

              {/* Enhanced Professional Info */}
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-12">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <Briefcase className="w-4 h-4 text-primary/60" />
                      <p className="text-[10px] font-bold text-primary uppercase tracking-[0.2em]">{tr.admin.users.details.department}</p>
                    </div>
                    <p className="text-sm font-semibold text-foreground pl-6">{viewingUser.department || "—"}</p>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-primary/60" />
                      <p className="text-[10px] font-bold text-primary uppercase tracking-[0.2em]">{tr.admin.users.details.jobTitle}</p>
                    </div>
                    <p className="text-sm font-semibold text-foreground pl-6">{viewingUser.job_title || "—"}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-[10px] font-bold text-primary uppercase tracking-[0.2em] mb-3">{tr.admin.users.details.usagePurpose}</p>
                  <div className="bg-secondary/40 p-5 rounded-[24px] border border-border/10">
                    <p className="text-sm leading-relaxed text-muted-foreground italic font-serif">
                      "{viewingUser.usage_purpose || tr.admin.users.details.notSpecified}"
                    </p>
                  </div>
                </div>

                <div className="bg-primary/5 p-4 rounded-2xl flex items-center justify-between border border-primary/10">
                  <p className="text-[10px] font-bold text-primary uppercase tracking-[0.2em]">{tr.admin.users.details.estimatedDailyViews}</p>
                  <p className="text-sm font-bond-nums font-bold text-primary">
                    {viewingUser.estimated_daily_views ? viewingUser.estimated_daily_views.toLocaleString() : "0"} {tr.admin.users.details.views}
                  </p>
                </div>
              </div>
            </div>

            <div className="px-8 py-6 border-t border-border/20 bg-secondary/5 flex justify-end">
              <Button 
                onClick={() => setViewingUser(null)}
                className="rounded-full px-10 py-6 h-auto text-sm font-bold shadow-lg shadow-primary/20 transition-all hover:scale-105 active:scale-95"
              >
                {tr.admin.users.details.close}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
