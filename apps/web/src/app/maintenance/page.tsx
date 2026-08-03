"use client";

import { Wrench } from "lucide-react";

export default function MaintenancePage() {
    return (
        <div className="bondley-status-page flex h-screen w-screen items-center justify-center p-4 bg-background">
            <div className="relative z-10 text-left space-y-6 max-w-md border-l-4 border-primary pl-8">
                <div className="flex justify-center">
                    <Wrench className="h-12 w-12 text-primary animate-pulse" />
                </div>
                <h1 className="text-6xl font-medium font-display tracking-[-.06em]">Bakımdayız</h1>
                <p className="font-mono-data text-sm leading-7 text-muted-foreground">
                    Sistemimizde şu anda planlı bir bakım çalışması yürütülmektedir.
                    Daha iyi bir hizmet sunabilmek için kısa süre içinde tekrar yayında olacağız.
                </p>
                <p className="font-mono-data text-[10px] uppercase tracking-widest text-muted-foreground/80 pt-4 border-t border-border">
                    Anlayışınız için teşekkür ederiz.
                </p>
            </div>
        </div>
    );
}
