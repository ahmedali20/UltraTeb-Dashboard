"use client";

import { useEffect, useState } from "react";

type Props = {
  active: "home" | "customers" | "sales" | "reps";
  lang: "en" | "ar";
  onToggleLang: () => void;
};

const labels = {
  en: {
    home: "Home",
    customers: "Customers",
    addRecord: "Add Record",
    sales: "All Records",
    reps: "Sales Reps",
    switchTo: "العربية",
  },
  ar: {
    home: "الرئيسية",
    customers: "العملاء",
    addRecord: "إضافة فاتورة",
    sales: "كل الفواتير",
    reps: "المندوبون",
    switchTo: "English",
  },
};

export default function Header({
  active,
  lang,
  onToggleLang,
}: Props) {
  const t = labels[lang];
  const [isDark, setIsDark] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    const savedTheme = localStorage.getItem("dashboard-theme");
    const prefersDark = window.matchMedia(
      "(prefers-color-scheme: dark)"
    ).matches;

    const shouldUseDark =
      savedTheme === "dark" || (!savedTheme && prefersDark);

    setIsDark(shouldUseDark);
    applyTheme(shouldUseDark);
    setIsMounted(true);
  }, []);

  function applyTheme(dark: boolean) {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    document.documentElement.style.colorScheme = dark ? "dark" : "light";
  }

  function toggleTheme() {
    const nextTheme = !isDark;

    setIsDark(nextTheme);
    applyTheme(nextTheme);

    localStorage.setItem(
      "dashboard-theme",
      nextTheme ? "dark" : "light"
    );
  }

  const linkStyle = (page: string): React.CSSProperties => ({
    padding: "6px 14px",
    borderRadius: 6,
    textDecoration: "none",
    fontSize: 14,
    fontWeight: active === page ? 600 : 400,
    color: active === page ? "#fff" : "#cbd5d9",
    background: active === page ? "#178A6B" : "transparent",
  });

  return (
    <header
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "14px 28px",
        background: "#0F3B44",
        marginBottom: 28,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 24,
        }}
      >
        <span
          style={{
            color: "#fff",
            fontWeight: 700,
            fontSize: 17,
          }}
        >
          Ultra Teb
        </span>

        <nav style={{ display: "flex", gap: 6 }}>
          <a href="/" style={linkStyle("home")}>
            {t.home}
          </a>

          <a href="/customers" style={linkStyle("customers")}>
            {t.customers}
          </a>

          <a href="/sales#add-record" style={linkStyle("addRecord")}>
            {t.addRecord}
          </a>

          <a href="/sales#all-records" style={linkStyle("sales")}>
            {t.sales}
          </a>

          <a href="/sales-reps" style={linkStyle("reps")}>
            {t.reps}
          </a>
        </nav>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        {/* Light/dark sliding switch */}
        <button
          type="button"
          role="switch"
          aria-checked={isDark}
          aria-label={
            isDark ? "Switch to light mode" : "Switch to dark mode"
          }
          title={
            isDark ? "Switch to light mode" : "Switch to dark mode"
          }
          onClick={toggleTheme}
          style={{
            position: "relative",
            width: 64,
            height: 32,
            padding: 0,
            border: "1px solid rgba(255,255,255,0.22)",
            borderRadius: 999,
            background: isDark ? "#172033" : "#dbeafe",
            cursor: "pointer",
            transition:
              "background-color 250ms ease, border-color 250ms ease",
            outlineOffset: 3,
            opacity: isMounted ? 1 : 0,
          }}
        >
          {/* Sun icon */}
          <span
            aria-hidden="true"
            style={{
              position: "absolute",
              left: 8,
              top: "50%",
              width: 16,
              height: 16,
              transform: "translateY(-50%)",
              color: isDark ? "#64748b" : "#f59e0b",
              transition: "color 250ms ease",
            }}
          >
            <SunIcon />
          </span>

          {/* Moon icon */}
          <span
            aria-hidden="true"
            style={{
              position: "absolute",
              right: 8,
              top: "50%",
              width: 16,
              height: 16,
              transform: "translateY(-50%)",
              color: isDark ? "#c4b5fd" : "#64748b",
              transition: "color 250ms ease",
            }}
          >
            <MoonIcon />
          </span>

          {/* Animated thumb */}
          <span
            aria-hidden="true"
            style={{
              position: "absolute",
              top: 3,
              left: 3,
              width: 24,
              height: 24,
              borderRadius: "50%",
              background: isDark ? "#f8fafc" : "#ffffff",
              boxShadow: "0 2px 6px rgba(0,0,0,0.28)",
              transform: isDark
                ? "translateX(32px)"
                : "translateX(0)",
              transition:
                "transform 280ms cubic-bezier(0.4, 0, 0.2, 1)",
            }}
          />
        </button>

        {/* Language button */}
        <button
          type="button"
          onClick={onToggleLang}
          style={{
            padding: "6px 16px",
            borderRadius: 6,
            border: "1px solid #2f5a63",
            background: "transparent",
            color: "#fff",
            cursor: "pointer",
            fontSize: 13,
          }}
        >
          {t.switchTo}
        </button>
      </div>
    </header>
  );
}

function SunIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2" />
      <path d="M12 20v2" />
      <path d="m4.93 4.93 1.42 1.42" />
      <path d="m17.66 17.66 1.41 1.41" />
      <path d="M2 12h2" />
      <path d="M20 12h2" />
      <path d="m6.35 17.66-1.42 1.41" />
      <path d="m19.07 4.93-1.41 1.42" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" />
    </svg>
  );
}
