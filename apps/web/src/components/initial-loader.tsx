"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

export function InitialLoader() {
  const [showLoader, setShowLoader] = useState(false);
  const [isFadingOut, setIsFadingOut] = useState(false);

  useEffect(() => {
    // Check if this is the first load
    if (typeof window === "undefined") return;

    const hasLoadedBefore = sessionStorage.getItem("bondley_initial_load");

    if (!hasLoadedBefore) {
      // First load - show loader
      setShowLoader(true);

      const handleLoad = () => {
        // Start fade-out animation
        setIsFadingOut(true);

        // Remove loader after animation completes
        setTimeout(() => {
          setShowLoader(false);
          sessionStorage.setItem("bondley_initial_load", "true");
        }, 400); // Match fade-out animation duration
      };

      // Check if page is already loaded
      if (document.readyState === "complete") {
        handleLoad();
      } else {
        window.addEventListener("load", handleLoad);
        return () => {
          window.removeEventListener("load", handleLoad);
        };
      }
    }
  }, []);

  if (!showLoader) {
    return null;
  }

  return (
    <div
      className={`fixed inset-0 z-[9999] bg-white flex items-center justify-center transition-opacity duration-400 ${
        isFadingOut ? "animate-loader-fade-out" : ""
      }`}
    >
      <div className="animate-logo-slide-up">
        <Image
          src="/logo.png"
          alt="Bondley Logo"
          width={160}
          height={160}
          className="w-32 h-32 md:w-40 md:h-40 lg:w-48 lg:h-48 object-contain"
          priority
        />
      </div>
    </div>
  );
}
