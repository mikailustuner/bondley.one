"use client";

import { useState } from "react";

export default function SentryTestPage() {
    const [shouldCrash, setShouldCrash] = useState(false);

    if (shouldCrash) {
        // Bu kod React rendering yaşam döngüsü içerisinde patlayacağı için 
        // Sentry (ve Next.js Error Boundaries) bunu %100 yakalayacaktır.
        throw new Error("Frontend Gercekci Sentry Hatasi!");
    }

    return (
        <div style={{ padding: "50px", textAlign: "center", color: "white" }}>
            <h1>Sentry Test Sayfası</h1>
            <p style={{ marginBottom: "20px" }}>Aşağıdaki butona tıkladığınızda sitenin Client tarafında (tarayıcıda) kasıtlı bir hata yaratılacaktır.</p>
            <button
                onClick={() => setShouldCrash(true)}
                style={{ padding: "10px 20px", background: "#ef4444", color: "white", cursor: "pointer", border: "none", borderRadius: "5px" }}
            >
                Sentry Hatası Fırlat
            </button>
        </div>
    );
}
