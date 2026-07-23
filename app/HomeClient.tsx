"use client";

import { useState } from "react";
import Header from "./Header";
import Footer from "./Footer";

const text = {
  en: { title: "Ultra Teb Dashboard", subtitle: "Choose a section to get started" },
  ar: { title: "لوحة تحكم الترا طب", subtitle: "اختر قسم للبدء" },
};

export default function HomeClient() {
  const [lang, setLang] = useState<"en" | "ar">("en");
  const t = text[lang];
  const dir = lang === "ar" ? "rtl" : "ltr";

  return (
    <div dir={dir} style={{ fontFamily: "Arial, 'Segoe UI', Tahoma, sans-serif", minHeight: "100vh", background: "var(--page-bg)", color: "var(--text-primary)" }}>
      <Header active="home" lang={lang} onToggleLang={() => setLang(lang === "en" ? "ar" : "en")} />
      <main
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "60px 20px",
        }}
      >
        <h1 style={{ marginBottom: 8 }}>{t.title}</h1>
        <p style={{ color: "var(--text-secondary)", marginBottom: 32 }}>{t.subtitle}</p>
        <div style={{ display: "flex", gap: 20 }}>
          <a
            href="/customers"
            style={{
              padding: "20px 40px",
              borderRadius: 10,
              background: "#0F3B44",
              color: "#fff",
              textDecoration: "none",
              fontSize: 18,
              boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
            }}
          >
            {lang === "ar" ? "العملاء" : "Customers"}
          </a>
          <a
            href="/sales"
            style={{
              padding: "20px 40px",
              borderRadius: 10,
              background: "#178A6B",
              color: "#fff",
              textDecoration: "none",
              fontSize: 18,
              boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
            }}
          >
            {lang === "ar" ? "المبيعات" : "Sales"}
          </a>
        </div>
      </main>
      <Footer lang={lang} />
    </div>
  );
}
