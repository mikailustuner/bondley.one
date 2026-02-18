"use client";

import { useState, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function ImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setResult(null);

    try {
      const token = localStorage.getItem("fincalc_token") || "";
      const formData = new FormData();
      formData.append("file", file);

      const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";
      const res = await fetch(`${apiBase}/import/csv`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      const data = await res.json();
      setResult(data);
    } catch (err: any) {
      setResult({ status: "error", message: err.message });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="animate-fade-up">
        <h1 className="font-display text-display-md text-foreground">Veri Aktarimi</h1>
        <p className="text-data-sm text-muted-foreground mt-1">CSV dosyasi yukleyerek tahvil verilerini iceri aktarin</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="animate-fade-up-delay-1">
          <CardHeader>
            <CardDescription>CSV IMPORT</CardDescription>
            <CardTitle className="mt-1">Dosya Yukle</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div
              className="border border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-primary/30 hover:bg-primary/[0.02] transition-colors"
              onClick={() => fileRef.current?.click()}
            >
              <Input
                ref={fileRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="hidden"
              />
              <div className="space-y-3">
                <div className="mx-auto h-12 w-12 rounded-lg bg-secondary flex items-center justify-center">
                  <svg className="h-5 w-5 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                  </svg>
                </div>
                {file ? (
                  <p className="font-mono-data text-data-sm text-primary">{file.name}</p>
                ) : (
                  <p className="text-data-sm text-muted-foreground">Book3.xlsx, Sheet1.csv formatinda dosya secin</p>
                )}
              </div>
            </div>

            <Button onClick={handleUpload} disabled={!file || uploading} className="w-full">
              {uploading ? "Isleniyor..." : "Yukle ve Isle"}
            </Button>

            {result && (
              <div
                className={`p-4 rounded-md border text-data-sm ${
                  result.status === "success"
                    ? "border-positive/30 bg-positive/5 text-positive"
                    : "border-destructive/30 bg-destructive/5 text-destructive"
                }`}
              >
                <p className="font-display font-medium mb-1">
                  {result.status === "success" ? "BASARILI" : "HATA"}
                </p>
                {result.imported !== undefined && (
                  <p className="font-mono-data">Aktarilan: {result.imported} kayit</p>
                )}
                {result.skipped !== undefined && (
                  <p className="font-mono-data">Atlanan: {result.skipped} kayit</p>
                )}
                {result.message && <p>{result.message}</p>}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="animate-fade-up-delay-2">
          <CardHeader>
            <CardDescription>BORSA ISTANBUL</CardDescription>
            <CardTitle className="mt-1">TLREF Veri Cekme</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button variant="outline" className="w-full justify-between group">
              <span>Gunluk TLREF Oranini Cek</span>
              <span className="text-muted-foreground/40 group-hover:text-primary transition-colors">&rarr;</span>
            </Button>
            <Button variant="outline" className="w-full justify-between group">
              <span>Tarihsel TLREF Verilerini Cek (ZIP)</span>
              <span className="text-muted-foreground/40 group-hover:text-primary transition-colors">&rarr;</span>
            </Button>

            <div className="mt-6 p-4 rounded-md bg-secondary/50 border border-border">
              <div className="text-label text-muted-foreground mb-3">ZAMANLANMIS GOREVLER</div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-data-sm text-muted-foreground">Gunluk TLREF</span>
                  <span className="font-mono-data text-label text-primary">HER IS GUNU 18:30</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-data-sm text-muted-foreground">Hesaplama</span>
                  <span className="font-mono-data text-label text-primary">HER IS GUNU 18:45</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
