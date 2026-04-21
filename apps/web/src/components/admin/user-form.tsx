"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { tr } from "@/locales/tr";

type UserFormData = {
  email: string;
  password?: string;
  full_name: string;
  company: string;
  location: string;
  role: string;
};

type UserFormProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: UserFormData) => Promise<void>;
  initialData?: {
    id: number;
    email: string;
    full_name: string | null;
    company: string | null;
    location: string | null;
    role: string;
  } | null;
  mode: "create" | "edit";
};

export function UserForm({ open, onOpenChange, onSubmit, initialData, mode }: UserFormProps) {
  const [formData, setFormData] = useState<UserFormData>({
    email: initialData?.email || "",
    password: "",
    full_name: initialData?.full_name || "",
    company: initialData?.company || "",
    location: initialData?.location || "",
    role: initialData?.role || "free_user",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (mode === "create" && !formData.password) {
        setError(tr.admin.users.form.passwordRequired);
        setLoading(false);
        return;
      }

      await onSubmit(formData);
      onOpenChange(false);
      setFormData({
        email: "",
        password: "",
        full_name: "",
        company: "",
        location: "",
        role: "free_user",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : tr.admin.users.errors.generic);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? tr.admin.users.form.new : tr.admin.users.form.edit}</DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? tr.admin.users.form.newDesc
              : tr.admin.users.form.editDesc}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="email">{tr.auth.login.emailLabel}</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
                disabled={mode === "edit"}
              />
            </div>
            {mode === "create" && (
              <div className="space-y-2">
                <Label htmlFor="password">{tr.auth.signup.fields.password}</Label>
                <Input
                  id="password"
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                  minLength={8}
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="full_name">{tr.auth.signup.fields.fullName}</Label>
              <Input
                id="full_name"
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="company">{tr.auth.signup.fields.company}</Label>
              <Input
                id="company"
                value={formData.company}
                onChange={(e) => setFormData({ ...formData, company: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="location">{tr.auth.signup.fields.location}</Label>
              <Input
                id="location"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">{tr.admin.users.table.cols.role}</Label>
              <Select value={formData.role} onValueChange={(value) => setFormData({ ...formData, role: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="free_user">Free User</SelectItem>
                  <SelectItem value="premium_user">Premium User</SelectItem>
                  <SelectItem value="pro_user">Pro User</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              {tr.common.cancel}
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? tr.common.saving : mode === "create" ? tr.common.create : tr.common.save}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
