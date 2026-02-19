"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api-client";
import { getToken } from "@/lib/auth";

type UserRow = {
  id: number;
  email: string;
  full_name: string | null;
  company: string | null;
  location: string | null;
  role: string;
  is_active: boolean;
  created_at: string;
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRow | null>(null);
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
      setError(e instanceof Error ? e.message : "Kullanicilar yuklenemedi");
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
          <h1 className="font-display text-display-md text-foreground">Kullanici Yonetimi</h1>
          <p className="text-data-sm text-muted-foreground mt-1">Kullanici hesaplarini yonetin</p>
        </div>
        <Button onClick={() => setShowCreateModal(true)}>Yeni Kullanici</Button>
      </div>

      <Card className="animate-fade-up-delay-1">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardDescription>HESAPLAR</CardDescription>
              <CardTitle className="mt-1">Kayitli Kullanicilar</CardTitle>
            </div>
            <span className="text-label text-muted-foreground">{users.length} KAYIT</span>
          </div>
        </CardHeader>
        <CardContent>
          {error && <p className="text-data-sm text-destructive mb-4">{error}</p>}
          {loading ? (
            <p className="text-data-sm text-muted-foreground">Yukleniyor…</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    {["ID", "E-POSTA", "AD SOYAD", "SIRKET", "ROL", "DURUM", "İŞLEMLER"].map((h, i) => (
                      <th
                        key={h}
                        className={`pb-3 text-label text-muted-foreground font-normal ${i === 5 ? "text-right" : "text-left"}`}
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
                          {user.is_active ? "AKTIF" : "PASIF"}
                        </Badge>
                      </td>
                      <td className="py-3 text-right">
                        <div className="flex gap-2 justify-end">
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
                            Düzenle
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={async () => {
                              const token = getToken();
                              if (!token) return;
                              if (confirm(`${user.email} kullanıcısının rolünü değiştirmek istediğinize emin misiniz?`)) {
                                try {
                                  const newRole = user.role === "admin" ? "free_user" : user.role === "free_user" ? "premium_user" : user.role === "premium_user" ? "pro_user" : "admin";
                                  await api.admin.updateUserRole(token, user.id, newRole);
                                  await loadUsers();
                                } catch (e) {
                                  alert(e instanceof Error ? e.message : "Hata oluştu");
                                }
                              }
                            }}
                          >
                            Rol Değiştir
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
                                alert(e instanceof Error ? e.message : "Hata oluştu");
                              }
                            }}
                          >
                            {user.is_active ? "Pasif Et" : "Aktif Et"}
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={async () => {
                              const token = getToken();
                              if (!token) return;
                              if (confirm(`${user.email} kullanıcısını silmek istediğinize emin misiniz?`)) {
                                try {
                                  await api.admin.deleteUser(token, user.id);
                                  await loadUsers();
                                } catch (e) {
                                  alert(e instanceof Error ? e.message : "Hata oluştu");
                                }
                              }
                            }}
                          >
                            Sil
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
              {editingUser ? "Kullanıcı Düzenle" : "Yeni Kullanıcı"}
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
                  alert(e instanceof Error ? e.message : "Hata oluştu");
                }
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-sm font-medium mb-1">E-posta</label>
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
                  <label className="block text-sm font-medium mb-1">Şifre</label>
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
                <label className="block text-sm font-medium mb-1">Ad Soyad</label>
                <Input
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Şirket</label>
                <Input
                  value={formData.company}
                  onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Konum</label>
                <Input
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Rol</label>
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
                  İptal
                </Button>
                <Button type="submit">{editingUser ? "Güncelle" : "Oluştur"}</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
