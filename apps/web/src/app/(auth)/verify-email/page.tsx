"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api-client";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { tr } from "@/locales/tr";

function VerifyEmailContent() {
    const searchParams = useSearchParams();
    const token = searchParams.get("token");
    const router = useRouter();
    const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
    const [errorMessage, setErrorMessage] = useState("");

    useEffect(() => {
        if (!token) {
            setStatus("error");
            setErrorMessage(tr.auth.verifyEmail.missingToken);
            return;
        }

        const verify = async () => {
            try {
                await api.auth.verifyEmail(token);
                setStatus("success");
            } catch (err: any) {
                setStatus("error");
                setErrorMessage(err.message || tr.auth.verifyEmail.genericError);
            }
        };

        verify();
    }, [token]);

    return (
        <div className="flex h-screen w-screen items-center justify-center p-4">
            <Card className="w-full max-w-md">
                <CardHeader className="text-center">
                    <CardTitle className="text-2xl flex justify-center items-center gap-2">
                        {status === "loading" && <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />}
                        {status === "success" && <CheckCircle2 className="h-8 w-8 text-green-500" />}
                        {status === "error" && <XCircle className="h-8 w-8 text-destructive" />}
                         <span>
                            {status === "loading" && tr.auth.verifyEmail.loading}
                            {status === "success" && tr.auth.verifyEmail.title}
                            {status === "error" && tr.auth.verifyEmail.error}
                        </span>
                    </CardTitle>
                     <CardDescription>
                        {status === "loading" && tr.auth.verifyEmail.waitMessage}
                        {status === "success" && tr.auth.verifyEmail.successMessage}
                        {status === "error" && errorMessage}
                    </CardDescription>
                </CardHeader>
                <CardContent className="flex justify-center pb-2">
                    {status === "loading" && <div className="animate-pulse h-4 w-32 bg-secondary rounded mt-4"></div>}
                </CardContent>
                <CardFooter className="flex justify-center flex-col gap-2">
                    {status === "success" && (
                        <Button className="w-full" onClick={() => router.push("/dashboard")}>
                            {tr.auth.verifyEmail.goToDashboard}
                        </Button>
                    )}
                    {status === "error" && (
                        <div className="flex w-full flex-col gap-2">
                            <Button className="w-full" variant="outline" onClick={() => router.push("/login")}>
                                {tr.auth.login.submit}
                            </Button>
                            <p className="text-xs text-center text-muted-foreground mt-2">
                                {tr.auth.verifyEmail.expiredLink}
                            </p>
                        </div>
                    )}
                </CardFooter>
            </Card>
        </div>
    );
}

export default function VerifyEmailPage() {
    return (
        <Suspense fallback={<div className="flex h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>}>
            <VerifyEmailContent />
        </Suspense>
    );
}
