"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Loader2, Building2, Briefcase, Target, Eye } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api-client";
import { toast } from "sonner";
import { updateLocalUser, getToken } from "@/lib/auth";
import Image from "next/image";
import { tr } from "@/locales/tr";

const formSchema = z.object({
    department: z.string().min(2, {
        message: tr.onboarding.form.department.validation,
    }),
    job_title: z.string().min(2, {
        message: tr.onboarding.form.jobTitle.validation,
    }),
    usage_purpose: z.string().min(10, {
        message: tr.onboarding.form.usagePurpose.validation,
    }),
    estimated_daily_views: z.string().refine((val) => {
        const parsed = parseInt(val, 10);
        return !isNaN(parsed) && parsed >= 1 && parsed <= 10000;
    }, { message: tr.onboarding.form.dailyViews.validation }),
});

export default function OnboardingPage() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            department: "",
            job_title: "",
            usage_purpose: "",
            estimated_daily_views: "10",
        },
    });

    async function onSubmit(values: z.infer<typeof formSchema>) {
        setIsLoading(true);
        try {
            const token = getToken();
            if (!token) throw new Error("Oturum süreniz dolmuş. Lütfen tekrar giriş yapın.");

            const payload = {
                ...values,
                estimated_daily_views: parseInt(values.estimated_daily_views, 10),
            };

            const response = await api.auth.onboarding(token, payload);
            // Update local storage user data to reflect profile_completed = true
            updateLocalUser(response);

            toast.success(tr.onboarding.successTitle, {
                description: tr.onboarding.successDescription,
            });

            // Redirect to main dashboard
            router.push("/dashboard");
            router.refresh();

        } catch (error: any) {
            toast.error(tr.common.error, {
                description: error.message || tr.onboarding.errorDescription,
            });
        } finally {
            setIsLoading(false);
        }
    }

    return (
        <div className="min-h-screen grid lg:grid-cols-2 bg-background">
            {/* Left Column - Form */}
            <div className="flex flex-col justify-center px-8 sm:px-16 md:px-24 lg:px-32 relative z-10">

                {/* Logo */}
                <div className="absolute top-12 left-8 sm:left-16 md:left-24 lg:left-32 flex items-center gap-3">
                    <span className="bondley-app-logo-tile">
                        <Image src="/logo-mark.svg" alt="" width={34} height={34} />
                    </span>
                    <span className="flex flex-col gap-1">
                        <span className="font-mono-data font-semibold text-base tracking-[-.07em]">Bondley</span>
                        <span className="font-mono-data text-[7px] uppercase tracking-[.16em] text-primary">by Aurict</span>
                    </span>
                </div>

                <div className="max-w-[440px] w-full mt-24 lg:mt-0">
                    <div className="mb-10 animate-fade-in" style={{ animationDelay: "100ms" }}>
                        <h1 className="text-3xl font-display font-medium tracking-tight mb-3">
                            {tr.onboarding.title}
                        </h1>
                        <p className="text-muted-foreground text-sm leading-relaxed">
                            {tr.onboarding.description}
                        </p>
                    </div>

                    <div className="animate-fade-in" style={{ animationDelay: "200ms" }}>
                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                                <div className="grid gap-6">
                                    {/* Department */}
                                    <FormField
                                        control={form.control}
                                        name="department"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="flex items-center gap-2 text-data-sm text-muted-foreground">
                                                    <Building2 className="h-3.5 w-3.5" />
                                                    {tr.onboarding.form.department.label}
                                                </FormLabel>
                                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                    <FormControl>
                                                        <SelectTrigger className="h-11 bg-background">
                                                            <SelectValue placeholder={tr.onboarding.form.department.placeholder} />
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent>
                                                        <SelectItem value="Hazine">{tr.onboarding.form.department.options.treasury}</SelectItem>
                                                        <SelectItem value="Portföy Yönetimi">{tr.onboarding.form.department.options.portfolio}</SelectItem>
                                                        <SelectItem value="Risk Yönetimi">{tr.onboarding.form.department.options.risk}</SelectItem>
                                                        <SelectItem value="Araştırma / Strateji">{tr.onboarding.form.department.options.research}</SelectItem>
                                                        <SelectItem value="Kurumsal Finansman">{tr.onboarding.form.department.options.corporate}</SelectItem>
                                                        <SelectItem value="Bireysel Yatırımcı">{tr.onboarding.form.department.options.retail}</SelectItem>
                                                        <SelectItem value="Fon Hizmet">{tr.onboarding.form.department.options.fund_serv}</SelectItem>
                                                        <SelectItem value="Saklama">{tr.onboarding.form.department.options.custody}</SelectItem>
                                                        <SelectItem value="Fon Operasyon">{tr.onboarding.form.department.options.fund_ops}</SelectItem>
                                                        <SelectItem value="Diğer ve Öğrenci">{tr.onboarding.form.department.options.other}</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    {/* Job Title */}
                                    <FormField
                                        control={form.control}
                                        name="job_title"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="flex items-center gap-2 text-data-sm text-muted-foreground">
                                                    <Briefcase className="h-3.5 w-3.5" />
                                                    {tr.onboarding.form.jobTitle.label}
                                                </FormLabel>
                                                <FormControl>
                                                    <Input
                                                        placeholder={tr.onboarding.form.jobTitle.placeholder}
                                                        className="h-11 bg-background"
                                                        {...field}
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    {/* Usage Purpose */}
                                    <FormField
                                        control={form.control}
                                        name="usage_purpose"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="flex items-center gap-2 text-data-sm text-muted-foreground">
                                                    <Target className="h-3.5 w-3.5" />
                                                    {tr.onboarding.form.usagePurpose.label}
                                                </FormLabel>
                                                <FormControl>
                                                    <Textarea
                                                        placeholder={tr.onboarding.form.usagePurpose.placeholder}
                                                        className="min-h-[100px] bg-background resize-none"
                                                        {...field}
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    {/* Estimated Daily Views */}
                                    <FormField
                                        control={form.control}
                                        name="estimated_daily_views"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="flex items-center gap-2 text-data-sm text-muted-foreground">
                                                    <Eye className="h-3.5 w-3.5" />
                                                    {tr.onboarding.form.dailyViews.label}
                                                </FormLabel>
                                                <FormControl>
                                                    <Input
                                                        type="number"
                                                        min="1"
                                                        max="10000"
                                                        className="h-11 bg-background"
                                                        {...field}
                                                    />
                                                </FormControl>
                                                <FormDescription className="text-xs">
                                                    {tr.onboarding.form.dailyViews.description}
                                                </FormDescription>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>

                                <div className="pt-4">
                                    <Button
                                        type="submit"
                                        className="w-full h-11"
                                        disabled={isLoading}
                                    >
                                        {isLoading ? (
                                            <>
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                {tr.common.saving}
                                            </>
                                        ) : (
                                            tr.onboarding.form.submit
                                        )}
                                    </Button>
                                </div>
                            </form>
                        </Form>
                    </div>
                </div>
            </div>

            {/* Right Column - Brand/Visual */}
            <div className="hidden lg:flex relative bg-black flex-col items-center justify-center p-12 overflow-hidden">
                {/* Background Effects */}
                <div className="absolute inset-0 z-0">
                    <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-primary/20 rounded-full blur-[120px]" />
                    <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-blue-500/10 rounded-full blur-[100px]" />
                    <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))]" opacity-20 />
                </div>

                <div className="relative z-10 max-w-lg text-center animate-fade-in" style={{ animationDelay: "300ms" }}>
                    <div className="glass-panel p-8 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md mb-8">
                        <h2 className="text-2xl font-display font-medium text-white mb-4">
                            {tr.onboarding.hero.title}
                        </h2>
                        <p className="text-white/60 text-sm leading-relaxed">
                            {tr.onboarding.hero.description}
                        </p>
                    </div>

                    <div className="flex items-center justify-center gap-4 text-xs font-mono text-white/40 tracking-widest">
                        <span>BIST</span>
                        <span className="w-1 h-1 rounded-full bg-white/20" />
                        <span>TLREFK</span>
                        <span className="w-1 h-1 rounded-full bg-white/20" />
                        <span>TLREF</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
