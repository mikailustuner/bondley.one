"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api-client";
import { getToken, getUser, setAuth, getRefreshToken } from "@/lib/auth";

const DEPARTMENTS = [
    { group: "Bankacilik", items: ["Hazine", "Kurumsal Bankacilik", "Yatirim Bankaciligi", "Bireysel Bankacilik", "Sermaye Piyasalari"] },
    { group: "Yatirim", items: ["Portfolyo Yonetimi", "Varlik Yonetimi", "Fon Yonetimi"] },
    { group: "Risk & Uyum", items: ["Risk Yonetimi", "Uyum / Regulasyon", "Ic Kontrol", "Denetim"] },
    { group: "Finans", items: ["Muhasebe / Finans", "Finansal Planlama ve Analiz (FP&A)", "Aktuarya"] },
    { group: "Arastirma", items: ["Arastirma / Strateji", "Akademik / Arastirma"] },
    { group: "Diger", items: ["Ust Yonetim", "IT / Teknoloji", "Bagimsiz Danismanlik", "Diger"] },
];

const JOB_TITLES = [
    { group: "Ust Yonetim", items: ["Genel Mudur", "Genel Mudur Yardimcisi", "Yonetim Kurulu Uyesi"] },
    { group: "Orta Yonetim", items: ["Direktor", "Bolum Muduru", "Birim Muduru", "Grup Muduru", "Sube Muduru"] },
    { group: "Uzman", items: ["Basuzman", "Kidemli Uzman", "Uzman", "Analist", "Denetci"] },
    { group: "Giris Seviye", items: ["Uzman Yardimcisi", "Asistan", "Stajyer"] },
    { group: "Akademik", items: ["Profesor", "Docent", "Arastirma Gorevlisi", "Ogrenci"] },
    { group: "Bagimsiz", items: ["Bagimsiz Danismani", "Serbest Yatirimci"] },
];

const DAILY_VIEWS = [
    { value: 5, label: "1 – 10" },
    { value: 25, label: "10 – 50" },
    { value: 75, label: "50 – 100" },
    { value: 250, label: "100 – 500" },
    { value: 750, label: "500+" },
];

export default function OnboardingPage() {
    const router = useRouter();
    const [step, setStep] = useState(0);
    const [department, setDepartment] = useState("");
    const [jobTitle, setJobTitle] = useState("");
    const [usagePurpose, setUsagePurpose] = useState("");
    const [dailyViews, setDailyViews] = useState<number | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        const user = getUser();
        if (!user) {
            router.push("/login");
            return;
        }
        if (user.profile_completed) {
            router.push("/dashboard");
        }
    }, [router]);

    const steps = [
        { title: "Birim / Departman", subtitle: "Hangi birimde calisiyorsunuz?" },
        { title: "Unvan", subtitle: "Mevcut gorev unvaniniz nedir?" },
        { title: "Kullanim Amaci", subtitle: "Bondley'i hangi amacla kullanmayi planliyorsunuz?" },
        { title: "Gunluk Kullanim", subtitle: "Tahmini gunluk goruntuyleme sayiniz" },
    ];

    const canNext = () => {
        if (step === 0) return department.length > 0;
        if (step === 1) return jobTitle.length > 0;
        if (step === 2) return usagePurpose.length >= 5;
        if (step === 3) return dailyViews !== null;
        return false;
    };

    const handleSubmit = async () => {
        const token = getToken();
        if (!token || dailyViews === null) return;

        setLoading(true);
        setError("");

        try {
            const updatedUser = await api.auth.onboarding(token, {
                department,
                job_title: jobTitle,
                usage_purpose: usagePurpose,
                estimated_daily_views: dailyViews,
            });
            const refreshToken = getRefreshToken() || "";
            setAuth(token, refreshToken, updatedUser);
            router.push("/dashboard");
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Bir hata olustu");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-background grain px-4 py-12">
            <div className="data-strip fixed top-0 left-0 right-0" />

            <div className="w-full max-w-lg animate-fade-up">
                <div className="text-center mb-8">
                    <div className="inline-flex h-10 w-10 items-center justify-center mb-4">
                        <Image
                            src="/logo.png"
                            alt="Bondley Logo"
                            width={40}
                            height={40}
                            className="h-10 w-10 object-contain"
                            priority
                        />
                    </div>
                    <h1 className="font-display text-display-md text-foreground">
                        Profilinizi Tamamlayin
                    </h1>
                    <p className="text-data-sm text-muted-foreground mt-2">
                        Size daha iyi hizmet verebilmemiz icin birka bilgiye ihtiyacimiz var
                    </p>
                </div>

                {/* Progress Bar */}
                <div className="flex gap-1.5 mb-6">
                    {steps.map((_, i) => (
                        <div
                            key={i}
                            className={`h-1 flex-1 rounded-full transition-colors ${i <= step ? "bg-primary" : "bg-muted"
                                }`}
                        />
                    ))}
                </div>

                <Card className="emerald-glow-border">
                    <CardHeader className="pb-4">
                        <CardDescription>ADIM {step + 1} / {steps.length}</CardDescription>
                        <CardTitle className="mt-1">{steps[step].title}</CardTitle>
                        <p className="text-data-sm text-muted-foreground mt-1">{steps[step].subtitle}</p>
                    </CardHeader>
                    <CardContent>
                        {/* Step 0: Department */}
                        {step === 0 && (
                            <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
                                {DEPARTMENTS.map((group) => (
                                    <div key={group.group}>
                                        <p className="text-label text-muted-foreground mb-1.5">{group.group.toUpperCase()}</p>
                                        <div className="flex flex-wrap gap-1.5">
                                            {group.items.map((item) => (
                                                <button
                                                    key={item}
                                                    type="button"
                                                    onClick={() => setDepartment(item)}
                                                    className={`px-3 py-1.5 rounded-md text-data-sm border transition-colors ${department === item
                                                            ? "bg-primary text-primary-foreground border-primary"
                                                            : "bg-card text-foreground border-border hover:border-primary/50"
                                                        }`}
                                                >
                                                    {item}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Step 1: Job Title */}
                        {step === 1 && (
                            <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
                                {JOB_TITLES.map((group) => (
                                    <div key={group.group}>
                                        <p className="text-label text-muted-foreground mb-1.5">{group.group.toUpperCase()}</p>
                                        <div className="flex flex-wrap gap-1.5">
                                            {group.items.map((item) => (
                                                <button
                                                    key={item}
                                                    type="button"
                                                    onClick={() => setJobTitle(item)}
                                                    className={`px-3 py-1.5 rounded-md text-data-sm border transition-colors ${jobTitle === item
                                                            ? "bg-primary text-primary-foreground border-primary"
                                                            : "bg-card text-foreground border-border hover:border-primary/50"
                                                        }`}
                                                >
                                                    {item}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Step 2: Usage Purpose */}
                        {step === 2 && (
                            <div>
                                <textarea
                                    value={usagePurpose}
                                    onChange={(e) => setUsagePurpose(e.target.value)}
                                    placeholder="Bondley'i hangi amacla kullanmayi planliyorsunuz? (orn: Tahvil fiyatlama, risk analizi, portfoy takibi...)"
                                    className="w-full h-32 px-3 py-2 rounded-md border border-border bg-card text-foreground text-data-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                                    maxLength={500}
                                />
                                <p className="text-label text-muted-foreground mt-1.5 text-right">
                                    {usagePurpose.length} / 500
                                </p>
                            </div>
                        )}

                        {/* Step 3: Daily Views */}
                        {step === 3 && (
                            <div className="space-y-2">
                                {DAILY_VIEWS.map((option) => (
                                    <button
                                        key={option.value}
                                        type="button"
                                        onClick={() => setDailyViews(option.value)}
                                        className={`w-full px-4 py-3 rounded-md text-left text-data-sm border transition-colors ${dailyViews === option.value
                                                ? "bg-primary text-primary-foreground border-primary"
                                                : "bg-card text-foreground border-border hover:border-primary/50"
                                            }`}
                                    >
                                        <span className="font-mono-data font-medium">{option.label}</span>
                                        <span className="text-muted-foreground ml-2">goruntuyleme / gun</span>
                                    </button>
                                ))}
                            </div>
                        )}

                        {error && (
                            <div className="mt-4 p-3 rounded-md border border-destructive/30 bg-destructive/5 text-destructive text-data-sm">
                                {error}
                            </div>
                        )}

                        {/* Navigation */}
                        <div className="flex gap-3 mt-6">
                            {step > 0 && (
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => setStep(step - 1)}
                                    className="flex-1"
                                >
                                    Geri
                                </Button>
                            )}
                            {step < 3 ? (
                                <Button
                                    type="button"
                                    onClick={() => setStep(step + 1)}
                                    disabled={!canNext()}
                                    className="flex-1"
                                >
                                    Devam
                                </Button>
                            ) : (
                                <Button
                                    type="button"
                                    onClick={handleSubmit}
                                    disabled={!canNext() || loading}
                                    className="flex-1"
                                >
                                    {loading ? "Kaydediliyor..." : "Tamamla ve Basla"}
                                </Button>
                            )}
                        </div>
                    </CardContent>
                </Card>

                <p className="text-center text-label text-muted-foreground/50 mt-6">
                    &copy; 2026 Bondley
                </p>
            </div>
        </div>
    );
}
