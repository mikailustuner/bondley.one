"use client";

import { useState } from "react";
import { 
  Send, 
  Info, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle,
  Megaphone,
  History,
  Trash2,
  Clock
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api } from "@/lib/api-client";
import { getToken } from "@/lib/auth";
import { toast } from "sonner";
import { tr } from "@/locales/tr";

export default function AdminNotificationsPage() {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [type, setType] = useState("info");
  const [isSending, setIsSending] = useState(false);

  const handleBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !message) {
      toast.error(tr.dashboard.admin.notifications.form.required);
      return;
    }

    const token = getToken();
    if (!token) return;

    setIsSending(true);
    try {
      const response = await api.notifications.broadcast(token, {
        title,
        message,
        type
      });
      
      toast.success(tr.dashboard.admin.notifications.form.success, {
        description: tr.dashboard.admin.notifications.form.successDesc.replace("{count}", response.users_notified.toString()),
        icon: <Megaphone className="h-4 w-4 text-green-500" />
      });
      
      setTitle("");
      setMessage("");
      setType("info");
    } catch (error: any) {
      toast.error(tr.dashboard.admin.notifications.form.error, {
        description: error.message || tr.common.error
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight text-foreground">{tr.dashboard.admin.notifications.title}</h1>
          <p className="text-muted-foreground">{tr.dashboard.admin.notifications.description}</p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        {/* Composition Form */}
        <Card className="rounded-3xl border-border shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">{tr.dashboard.admin.notifications.form.title}</CardTitle>
            <CardDescription>
              {tr.dashboard.admin.notifications.form.description}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleBroadcast} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="title">{tr.dashboard.admin.notifications.form.subject}</Label>
                <Input
                  id="title"
                  placeholder={tr.dashboard.admin.notifications.form.subjectPlaceholder}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="rounded-xl"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="type">{tr.dashboard.admin.notifications.form.type}</Label>
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder={tr.dashboard.admin.notifications.form.typePlaceholder} />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="info" className="flex items-center gap-2">
                      <div className="flex items-center gap-2">
                        <Info className="h-4 w-4 text-blue-500" /> {tr.dashboard.admin.notifications.types.info}
                      </div>
                    </SelectItem>
                    <SelectItem value="success">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-500" /> {tr.dashboard.admin.notifications.types.success}
                      </div>
                    </SelectItem>
                    <SelectItem value="warning">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-amber-500" /> {tr.dashboard.admin.notifications.types.warning}
                      </div>
                    </SelectItem>
                    <SelectItem value="error">
                      <div className="flex items-center gap-2">
                        <XCircle className="h-4 w-4 text-red-500" /> {tr.dashboard.admin.notifications.types.error}
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="message">{tr.dashboard.admin.notifications.form.message}</Label>
                <Textarea
                  id="message"
                  placeholder={tr.dashboard.admin.notifications.form.messagePlaceholder}
                  className="rounded-xl min-h-[120px] resize-none"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  required
                />
              </div>

              <Button 
                type="submit" 
                className="w-full rounded-xl py-6 h-auto text-base font-semibold"
                disabled={isSending}
              >
                {isSending ? (
                  <>{tr.dashboard.admin.notifications.form.sending}</>
                ) : (
                  <>
                    <Send className="h-5 w-5 mr-2" />
                    {tr.dashboard.admin.notifications.form.submit}
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Preview & Info */}
        <div className="space-y-6">
          <Card className="rounded-3xl bg-secondary/30 border-dashed border-2">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground">{tr.dashboard.admin.notifications.preview.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-card border border-border rounded-2xl p-4 shadow-sm">
                <div className="flex gap-3">
                  <div className="mt-0.5 shrink-0">
                    {type === "info" && <Info className="h-4 w-4 text-primary" />}
                    {type === "success" && <CheckCircle2 className="h-4 w-4 text-positive" />}
                    {type === "warning" && <AlertTriangle className="h-4 w-4 text-warning" />}
                    {type === "error" && <XCircle className="h-4 w-4 text-destructive" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-[13px] font-semibold text-foreground truncate">
                      {title || tr.dashboard.admin.notifications.preview.defaultTitle}
                    </h4>
                    <p className="text-[12px] text-muted-foreground mt-1 leading-normal">
                      {message || tr.dashboard.admin.notifications.preview.defaultMessage}
                    </p>
                    <div className="mt-2">
                      <span className="text-[10px] text-muted-foreground/60 uppercase font-medium">
                        {tr.components.notificationBell.now}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-3xl border-border bg-destructive/5 border-destructive/10">
            <CardHeader>
              <div className="flex items-center gap-2 text-destructive">
                <Megaphone className="h-5 w-5" />
                <CardTitle className="text-lg">{tr.dashboard.admin.notifications.reminder.title}</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="text-sm text-destructive/80 space-y-3">
              <p>
                {tr.dashboard.admin.notifications.reminder.p1}
              </p>
              <p>
                {tr.dashboard.admin.notifications.reminder.p2}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
