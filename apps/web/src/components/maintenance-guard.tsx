"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { api } from "@/lib/api-client";
import { getUser } from "@/lib/auth";
import { AlertCircle } from "lucide-react";

export function MaintenanceGuard({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();
    const [isMaintenance, setIsMaintenance] = useState(false);
    const [isAdmin, setIsAdmin] = useState(false);
    const [checked, setChecked] = useState(false);

    useEffect(() => {
        async function checkMaintenanceStatus() {
            try {
                const { is_maintenance } = await api.system.getMaintenanceStatus();
                setIsMaintenance(is_maintenance);

                const user = getUser();
                const userIsAdmin = user?.role === "admin";
                setIsAdmin(userIsAdmin);

                if (is_maintenance) {
                    if (!userIsAdmin && pathname !== "/maintenance" && pathname !== "/login") {
                        router.replace("/maintenance");
                    }
                } else {
                    if (pathname === "/maintenance") {
                        router.replace("/");
                    }
                }
            } catch (error) {
                console.error("Failed to check maintenance status:", error);
            } finally {
                setChecked(true);
            }
        }

        checkMaintenanceStatus();
    }, [pathname, router]);

    if (!checked) return null; // Avoid flickering

    // Don't render children if we need to redirect, just a loader or empty
    if (isMaintenance && !isAdmin && pathname !== "/maintenance" && pathname !== "/login") {
        return null;
    }

    return (
        <>
            {isMaintenance && isAdmin && pathname !== "/maintenance" && (
                <div className="bg-red-500 text-white p-2 text-center text-sm font-medium flex items-center justify-center gap-2 z-[100] relative">
                    <AlertCircle className="w-4 h-4" />
                    DİKKAT: Site şu anda Bakım Modunda (Sadece Adminler girebilir).
                </div>
            )}
            {children}
        </>
    );
}
