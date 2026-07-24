"use client";

import { useEffect, useState } from "react";

type Props = {
  active: "home" | "customers" | "sales" | "reps" | "reports" | "users";
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
    reports: "Reports",
    users: "Users",
    switchTo: "العربية",
  },
  ar: {
    home: "الرئيسية",
    customers: "العملاء",
    addRecord: "إضافة فاتورة",
    sales: "كل الفواتير",
    reps: "المندوبون",
    reports: "التقارير",
    users: "المستخدمون",
    switchTo: "English",
  },
};

export default function Header({ active, lang, onToggleLang }: Props) {
  const t = labels[lang];
  const [isDark, setIsDark] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    const savedTheme = localStorage.getItem("dashboard-theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const shouldUseDark =
      savedTheme === "dark" || (!savedTheme && prefersDark);

    setIsDark(shouldUseDark);
    applyTheme(shouldUseDark);
    setIsMounted(true);

    fetch("/api/auth/me")
      .then((response) => (response.ok ? response.json() : null))
      .then((user) => setIsAdmin(user?.role === "admin"))
      .catch(() => setIsAdmin(false));
  }, []);

  function applyTheme(dark: boolean) {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    document.documentElement.style.colorScheme = dark ? "dark" : "light";
  }

  function toggleTheme() {
    const nextTheme = !isDark;
    setIsDark(nextTheme);
    applyTheme(nextTheme);
    localStorage.setItem("dashboard-theme", nextTheme ? "dark" : "light");
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  const linkClass = (page: string) =>
    `app-sidebar__link${active === page ? " app-sidebar__link--active" : ""}`;

  return (
    <header className="app-header">
      <div className="app-topbar">
        <button
          type="button"
          className="app-menu-button"
          aria-label="Open navigation"
          aria-expanded={isMenuOpen}
          onClick={() => setIsMenuOpen((open) => !open)}
        >
          ☰
        </button>
        <strong className="app-topbar__title">Ultra Teb Dashboard</strong>

        <div className="app-topbar__actions">
          <button
            type="button"
            role="switch"
            aria-checked={isDark}
            aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
            title={isDark ? "Switch to light mode" : "Switch to dark mode"}
            onClick={toggleTheme}
            className="theme-switch"
            style={{
              background: isDark ? "#172033" : "#dbeafe",
              opacity: isMounted ? 1 : 0,
            }}
          >
            <span aria-hidden="true" className="theme-switch__sun">
              <SunIcon />
            </span>
            <span aria-hidden="true" className="theme-switch__moon">
              <MoonIcon />
            </span>
            <span
              aria-hidden="true"
              className="theme-switch__thumb"
              style={{
                transform: isDark ? "translateX(32px)" : "translateX(0)",
              }}
            />
          </button>

          <button type="button" onClick={onToggleLang} className="app-topbar__button">
            {t.switchTo}
          </button>
          <button type="button" onClick={logout} className="app-topbar__button">
            Logout
          </button>
        </div>
      </div>

      <aside className={`app-sidebar${isMenuOpen ? " app-sidebar--open" : ""}`}>
        <div className="app-sidebar__brand">Ultra Teb</div>
        <nav className="app-sidebar__nav" aria-label="Main navigation">
          <a href="/" className={linkClass("home")}>{t.home}</a>
          <a href="/customers" className={linkClass("customers")}>{t.customers}</a>
          <a href="/sales#add-record" className={linkClass("addRecord")}>{t.addRecord}</a>
          <a href="/sales#all-records" className={linkClass("sales")}>{t.sales}</a>
          <a href="/sales-reps" className={linkClass("reps")}>{t.reps}</a>
          <a href="/reports" className={linkClass("reports")}>{t.reports}</a>
          {isAdmin && (
            <a href="/users" className={linkClass("users")}>{t.users}</a>
          )}
        </nav>
      </aside>

      {isMenuOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          className="app-sidebar-backdrop"
          onClick={() => setIsMenuOpen(false)}
        />
      )}
    </header>
  );
}

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2" /><path d="M12 20v2" />
      <path d="m4.93 4.93 1.42 1.42" /><path d="m17.66 17.66 1.41 1.41" />
      <path d="M2 12h2" /><path d="M20 12h2" />
      <path d="m6.35 17.66-1.42 1.41" /><path d="m19.07 4.93-1.41 1.42" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" />
    </svg>
  );
}
