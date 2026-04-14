"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, Terminal, ShieldCheck, Activity } from "lucide-react";
import { api } from "@/lib/api-client";
import { getToken } from "@/lib/auth";

export default function SentryDebugPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const triggerFrontendError = () => {
    setResult({ type: "success", message: "Frontend hatası fırlatıldı! Sentry panelinizi kontrol edin." });
    // @ts-ignore - Intentionally calling an undefined function to trigger a ReferenceError
    myUndefinedFunction();
  };

  const triggerBackendError = async () => {
    setLoading(true);
    setResult(null);
    try {
      const token = getToken();
      if (!token) throw new Error("Oturum bulunamadı");
      
      await api.admin.triggerSentryError(token);
      // We don't expect to reach here if the API raises an exception, 
      // but apiFetch handles non-2xx as errors anyway.
    } catch (err: any) {
      setResult({ 
        type: "success", 
        message: "Backend hatası tetiklendi! Sunucu bu hatayı Sentry'e iletti." 
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
          <h1 className="font-display text-display-md text-foreground tracking-tight">Sentry Entegrasyon Testi</h1>
        </div>
        <p className="text-data-sm text-muted-foreground ml-13">
          Sistem hatalarının Sentry paneline doğru şekilde iletildiğini doğrulamak için bu aracı kullanın.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Frontend Card */}
        <Card className="border-border/40 shadow-sm hover:shadow-md transition-all duration-300 rounded-[24px] overflow-hidden group">
          <CardHeader className="bg-secondary/10 pb-4">
            <div className="flex items-center gap-3">
              <Terminal className="w-5 h-5 text-primary" />
              <CardTitle className="text-lg">Frontend (Browser)</CardTitle>
            </div>
            <CardDescription>Tarayıcı tarafındaki JS hatalarını test eder.</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground leading-relaxed mb-6">
              Bu buton bir JavaScript <code className="bg-secondary px-1.5 py-0.5 rounded text-xs">Error</code> fırlatacak ve 
              uygulamanın Global Error Boundary mekanizmasını test edecektir.
            </p>
            <Button 
              variant="outline" 
              className="w-full rounded-full border-primary/20 hover:bg-primary/5 text-primary font-semibold"
              onClick={triggerFrontendError}
            >
              Frontend Hatası Fırlat
            </Button>
          </CardContent>
        </Card>

        {/* Backend Card */}
        <Card className="border-border/40 shadow-sm hover:shadow-md transition-all duration-300 rounded-[24px] overflow-hidden group">
          <CardHeader className="bg-secondary/10 pb-4">
            <div className="flex items-center gap-3">
              <ShieldCheck className="w-5 h-5 text-primary" />
              <CardTitle className="text-lg">Backend (API)</CardTitle>
            </div>
            <CardDescription>Sunucu tarafındaki Python hatalarını test eder.</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground leading-relaxed mb-6">
              Bu buton sunucuya bir istek atar ve API tarafında kasti bir <code className="bg-secondary px-1.5 py-0.5 rounded text-xs">Exception</code> 
              oluşturularak Sentry'nin yakalaması sağlanır.
            </p>
            <Button 
              variant="default" 
              disabled={loading}
              className="w-full rounded-full font-bold shadow-lg shadow-primary/20"
              onClick={triggerBackendError}
            >
              {loading ? "Tetikleniyor..." : "Backend Hatası Tetikle"}
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
        <h3 className="font-bold text-sm tracking-widest text-muted-foreground uppercase">Nasil Dogrulanir?</h3>
        <ul className="space-y-3">
          {[
            { step: "1", text: "Yukarıdaki butonlardan birine basın." },
            { step: "2", text: "Sentry.io dashboard'una giriş yapın ve projenizi seçin." },
            { step: "3", text: " 'Issues' sekmesinde yeni fırlatılan hatayı görmeniz gerekir." },
            { step: "4", text: "Hatanın detaylarında işletim sistemi, tarayıcı veya sunucu loglarını inceleyin." }
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
