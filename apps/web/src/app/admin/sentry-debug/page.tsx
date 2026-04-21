"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, Terminal, ShieldCheck, Activity } from "lucide-react";
import { api } from "@/lib/api-client";
import { getToken } from "@/lib/auth";

import { tr } from "@/locales/tr";

export default function SentryDebugPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const triggerFrontendError = () => {
    setResult({ type: "success", message: tr.admin.sentry.frontend.success });
    // @ts-ignore - Intentionally calling an undefined function to trigger a ReferenceError
    myUndefinedFunction();
  };

  const triggerBackendError = async () => {
    setLoading(true);
    setResult(null);
    try {
      const token = getToken();
      if (!token) throw new Error(tr.admin.overview.operations.noSession);
      
      await api.admin.triggerSentryError(token);
    } catch (err: any) {
      setResult({ 
        type: "success", 
        message: tr.admin.sentry.backend.success 
      });
      console.log("Backend error expected and caught locally:", err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-destructive/10 flex items-center justify-center text-destructive border border-destructive/20 shadow-sm">
            <Activity className="w-5 h-5" />
          </div>
          <h1 className="font-display text-display-md text-foreground tracking-tight">{tr.admin.sentry.title}</h1>
        </div>
        <p className="text-data-sm text-muted-foreground ml-13">
          {tr.admin.sentry.description}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Frontend Card */}
        <Card className="border-border/40 shadow-sm hover:shadow-md transition-all duration-300 rounded-[24px] overflow-hidden group">
          <CardHeader className="bg-secondary/10 pb-4">
            <div className="flex items-center gap-3">
              <Terminal className="w-5 h-5 text-primary" />
              <CardTitle className="text-lg">{tr.admin.sentry.frontend.title}</CardTitle>
            </div>
            <CardDescription>{tr.admin.sentry.frontend.desc}</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground leading-relaxed mb-6">
              {tr.admin.sentry.frontend.info}
            </p>
            <Button 
              variant="outline" 
              className="w-full rounded-full border-primary/20 hover:bg-primary/5 text-primary font-semibold"
              onClick={triggerFrontendError}
            >
              {tr.admin.sentry.frontend.button}
            </Button>
          </CardContent>
        </Card>

        {/* Backend Card */}
        <Card className="border-border/40 shadow-sm hover:shadow-md transition-all duration-300 rounded-[24px] overflow-hidden group">
          <CardHeader className="bg-secondary/10 pb-4">
            <div className="flex items-center gap-3">
              <ShieldCheck className="w-5 h-5 text-primary" />
              <CardTitle className="text-lg">{tr.admin.sentry.backend.title}</CardTitle>
            </div>
            <CardDescription>{tr.admin.sentry.backend.desc}</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground leading-relaxed mb-6">
              {tr.admin.sentry.backend.info}
            </p>
            <Button 
              variant="default" 
              disabled={loading}
              className="w-full rounded-full font-bold shadow-lg shadow-primary/20"
              onClick={triggerBackendError}
            >
              {loading ? tr.admin.sentry.backend.triggering : tr.admin.sentry.backend.button}
            </Button>
          </CardContent>
        </Card>
      </div>

      {result && (
        <div className={`p-5 rounded-[20px] flex items-center gap-4 animate-in zoom-in-95 duration-300 border ${
          result.type === "success" ? "bg-primary/5 border-primary/10 text-primary" : "bg-destructive/5 border-destructive/10 text-destructive"
        }`}>
          <AlertCircle className="w-5 h-5" />
          <p className="text-sm font-semibold">{result.message}</p>
        </div>
      )}

      <div className="bg-secondary/20 p-8 rounded-[32px] border border-border/30 space-y-4">
        <h3 className="font-bold text-sm tracking-widest text-muted-foreground uppercase">{tr.admin.sentry.steps.title}</h3>
        <ul className="space-y-3">
          {[
            { step: "1", text: tr.admin.sentry.steps.step1 },
            { step: "2", text: tr.admin.sentry.steps.step2 },
            { step: "3", text: tr.admin.sentry.steps.step3 },
            { step: "4", text: tr.admin.sentry.steps.step4 }
          ].map((item) => (
            <li key={item.step} className="flex items-start gap-4 text-sm text-muted-foreground">
              <span className="bg-background w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border border-border/50 shrink-0">
                {item.step}
              </span>
              <span className="pt-0.5">{item.text}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
