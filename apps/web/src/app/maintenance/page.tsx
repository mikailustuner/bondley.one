"use client";

import { Wrench } from "lucide-react";

export default function MaintenancePage() {
    return (
        <div className="flex h-screen w-screen items-center justify-center p-4 bg-background">
            <div className="text-center space-y-6 max-w-md">
                <div className="flex justify-center">
                    <Wrench className="h-16 w-16 text-muted-foreground animate-pulse" />
                </div>
                <h1 className="text-3xl font-bold font-display tracking-tight">Bakımdayız</h1>
                <p className="text-lg text-muted-foreground">
                    Sistemimizde şu anda planlı bir bakım çalışması yürütülmektedir.
                    Daha iyi bir hizmet sunabilmek için kısa süre içinde tekrar yayında olacağız.
                </p>
                <p className="text-sm text-muted-foreground/80 pt-4 border-t border-border">
                    Anlayışınız için teşekkür ederiz.
                </p>
            </div>
        </div>
    );
}
