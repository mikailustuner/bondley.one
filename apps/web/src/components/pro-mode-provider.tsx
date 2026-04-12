"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { useTheme } from "next-themes";

interface ProModeContextType {
    isPro: boolean;
    toggleProMode: () => void;
    setProMode: (value: boolean) => void;
}

const ProModeContext = createContext<ProModeContextType | undefined>(undefined);

export function ProModeProvider({ children }: { children: React.ReactNode }) {
    const [isPro, setIsProState] = useState(false);
    const [mounted, setMounted] = useState(false);
    const { setTheme } = useTheme();

    useEffect(() => {
        setMounted(true);
        // Check local storage on mount
        const saved = localStorage.getItem("fincalc-pro-mode");
        if (saved === "true") {
            setIsProState(true);
            document.documentElement.classList.add("pro-mode");
        }
    }, []);

    const setProMode = (value: boolean) => {
        setIsProState(value);
        localStorage.setItem("fincalc-pro-mode", value ? "true" : "false");

        if (value) {
            document.documentElement.classList.add("pro-mode");
            // Force dark mode when pro is active
            setTheme("dark");
        } else {
            document.documentElement.classList.remove("pro-mode");
        }
    };

    const toggleProMode = () => setProMode(!isPro);


    return (
        <ProModeContext.Provider value={{ isPro, toggleProMode, setProMode }}>
            {children}
        </ProModeContext.Provider>
    );
}

export function useProMode() {
    const context = useContext(ProModeContext);
    if (context === undefined) {
        throw new Error("useProMode must be used within a ProModeProvider");
    }
    return context;
}
