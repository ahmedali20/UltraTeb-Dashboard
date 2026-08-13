"use client";

import { useEffect, useRef, useState } from "react";
import { normalizePermissions, type DashboardModule, type DashboardPermissions } from "../lib/dashboard-permissions";

type Props = {
  active: "home" | "customers" | "sales" | "reps" | "teams" | "reports" | "wht" | "collections" | "cheques" | "cogs" | "vat" | "incomeStatement" | "authorization" | "users" | "activity";
  lang: "en" | "ar";
  onToggleLang: () => void;
};

const labels = {
  en: {
    home: "Home",
    customers: "Customers",
    addRecord: "Add Record",
    sales: "Invoices",
    reps: "Sales Reps",
    teams: "Sales Teams",
    reports: "Reports",
    wht: "Collected WHT",
    collections: "Collections",
    cheques: "Cheques",
    cogs: "Invoices COGS",
    vat: "VAT Report",
    incomeStatement: "Income Statement Data",
    authorization: "Authorization Letters",
    users: "Users",
    activity: "Activity Log",
    workspace: "Workspace",
    administration: "Administration",
    admin: "Admin",
    user: "User",
    logout: "Logout",
    switchTo: "العربية",
  },
  ar: {
    home: "الرئيسية",
    customers: "العملاء",
    addRecord: "إضافة فاتورة",
    sales: "الفواتير",
    reps: "المندوبون",
    teams: "فرق المبيعات",
    reports: "التقارير",
    wht: "ضريبة الخصم المحصلة",
    collections: "التحصيلات",
    cheques: "الشيكات",
    cogs: "تكلفة الفواتير",
    vat: "تقرير ضريبة القيمة المضافة",
    incomeStatement: "بيانات قائمة الدخل",
    authorization: "خطابات التفويض",
    users: "المستخدمون",
    activity: "سجل النشاط",
    workspace: "مساحة العمل",
    administration: "الإدارة",
    admin: "مسؤول",
    user: "مستخدم",
    logout: "تسجيل الخروج",
    switchTo: "English",
  },
};

export default function Header({ active, lang, onToggleLang }: Props) {
  const t = labels[lang];
  const [isDark, setIsDark] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [currentUser, setCurrentUser] = useState<{
    username: string;
    role: "admin" | "user";
    salesRepName: string | null;
    permissions: DashboardPermissions;
  } | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const headerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const savedTheme = localStorage.getItem("dashboard-theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const shouldUseDark =
      savedTheme === "dark" || (!savedTheme && prefersDark);

    setIsDark(shouldUseDark);
    applyTheme(shouldUseDark);
    setIsMounted(true);
    setIsSidebarOpen(
      window.innerWidth > 600 &&
        localStorage.getItem("dashboard-sidebar") !== "closed"
    );

    fetch("/api/auth/me")
      .then((response) => (response.ok ? response.json() : null))
      .then((user) => {
        setCurrentUser(user);
        setIsAdmin(user?.role === "admin");
      })
      .catch(() => {
        setCurrentUser(null);
        setIsAdmin(false);
      });
  }, []);

  useEffect(() => {
    const pageShell = headerRef.current?.parentElement;
    pageShell?.classList.toggle("dashboard-shell--sidebar-open", isSidebarOpen);
    document.body.classList.toggle("dashboard-sidebar-open", isSidebarOpen);
    document.body.classList.toggle("dashboard-sidebar-rtl", lang === "ar");
    const sidebarSpace = isSidebarOpen ? "236px" : "0px";
    document.body.style.setProperty(
      "padding-left",
      lang === "ar" ? "0px" : sidebarSpace,
      "important"
    );
    document.body.style.setProperty(
      "padding-right",
      lang === "ar" ? sidebarSpace : "0px",
      "important"
    );
    document.body.style.setProperty("box-sizing", "border-box", "important");
    document.body.style.setProperty("width", "100%", "important");
    document.body.style.setProperty("overflow-x", "hidden", "important");

    return () => {
      pageShell?.classList.remove("dashboard-shell--sidebar-open");
      document.body.classList.remove(
        "dashboard-sidebar-open",
        "dashboard-sidebar-rtl"
      );
      document.body.style.removeProperty("padding-left");
      document.body.style.removeProperty("padding-right");
      document.body.style.removeProperty("box-sizing");
      document.body.style.removeProperty("width");
      document.body.style.removeProperty("overflow-x");
    };
  }, [isSidebarOpen, lang]);

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

  function toggleSidebar() {
    setIsSidebarOpen((open) => {
      const next = !open;
      if (window.innerWidth > 600) {
        localStorage.setItem("dashboard-sidebar", next ? "open" : "closed");
      }
      return next;
    });
  }

  const linkClass = (page: string) =>
    `app-sidebar__link${active === page ? " app-sidebar__link--active" : ""}`;
  const canView = (module: DashboardModule) =>
    isAdmin || normalizePermissions(currentUser?.permissions)[module]?.view === true;
  const hasAdministrationAccess = isAdmin || (["teams", "wht", "collections", "cheques", "cogs", "vat", "incomeStatement", "authorization"] as DashboardModule[]).some(canView);

  return (
    <header
      ref={headerRef}
      className={`app-header${isSidebarOpen ? " app-header--sidebar-open" : ""}`}
    >
      <div className="app-topbar">
        <button
          type="button"
          className="app-menu-button"
          aria-label={isSidebarOpen ? "Hide navigation" : "Show navigation"}
          title={isSidebarOpen ? "Hide sidebar" : "Show sidebar"}
          aria-expanded={isSidebarOpen}
          onClick={toggleSidebar}
        >
          <MenuIcon />
        </button>
        <div className="app-topbar__heading">
          <strong className="app-topbar__title">Ultra Teb Dashboard</strong>
          <span>{active === "reps" ? t.reps : active === "sales" ? t.sales : t[active]}</span>
        </div>

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
          {currentUser && (
            <div className="app-user-chip" title={`${currentUser.username} · ${currentUser.role}`}>
              <span className="app-user-chip__avatar">
                {currentUser.username.slice(0, 1).toUpperCase()}
              </span>
              <span className="app-user-chip__copy">
                <strong>{currentUser.username}</strong>
                <small>{currentUser.role === "admin" ? t.admin : currentUser.salesRepName ?? t.user}</small>
              </span>
            </div>
          )}
          <button
            type="button"
            onClick={logout}
            className="app-topbar__button app-topbar__logout"
            title={t.logout}
          >
            <LogoutIcon />
            <span>{t.logout}</span>
          </button>
        </div>
      </div>

      <aside className={`app-sidebar${isSidebarOpen ? " app-sidebar--open" : ""}`}>
        <div className="app-sidebar__brand">
          <span>UT</span>
          <div>
            <strong>Ultra Teb</strong>
            <small>Sales Intelligence</small>
          </div>
        </div>
        <nav className="app-sidebar__nav" aria-label="Main navigation">
          <span className="app-sidebar__section">{t.workspace}</span>
          {canView("home") && <NavLink href="/" page="home" label={t.home} icon="home" className={linkClass("home")} />}
          {canView("customers") && <NavLink href="/customers" page="customers" label={t.customers} icon="customers" className={linkClass("customers")} />}
          {canView("sales") && <NavLink href="/sales#all-records" page="sales" label={t.sales} icon="records" className={linkClass("sales")} />}
          {canView("reps") && <NavLink href="/sales-reps" page="reps" label={t.reps} icon="reps" className={linkClass("reps")} />}
          {canView("reports") && <NavLink href="/reports" page="reports" label={t.reports} icon="reports" className={linkClass("reports")} />}
          {hasAdministrationAccess && (
            <>
              <span className="app-sidebar__section app-sidebar__section--admin">{t.administration}</span>
              {canView("teams") && <NavLink href="/sales-teams" page="teams" label={t.teams} icon="teams" className={linkClass("teams")} />}
              {canView("wht") && <NavLink href="/wht" page="wht" label={t.wht} icon="records" className={linkClass("wht")} />}
              {canView("collections") && <NavLink href="/collections" page="collections" label={t.collections} icon="records" className={linkClass("collections")} />}
              {canView("cheques") && <NavLink href="/cheques" page="cheques" label={t.cheques} icon="records" className={linkClass("cheques")} />}
              {canView("cogs") && <NavLink href="/cogs" page="cogs" label={t.cogs} icon="records" className={linkClass("cogs")} />}
              {canView("vat") && <NavLink href="/vat-report" page="vat" label={t.vat} icon="reports" className={linkClass("vat")} />}
              {canView("incomeStatement") && <NavLink href="/income-statement-data" page="incomeStatement" label={t.incomeStatement} icon="reports" className={linkClass("incomeStatement")} />}
              {canView("authorization") && <NavLink href="/authorization" page="authorization" label={t.authorization} icon="reports" className={linkClass("authorization")} />}
              {isAdmin && <NavLink href="/users" page="users" label={t.users} icon="users" className={linkClass("users")} />}
              {isAdmin && <NavLink href="/activity-log" page="activity" label={t.activity} icon="activity" className={linkClass("activity")} />}
            </>
          )}
        </nav>
      </aside>

      {isSidebarOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          className="app-sidebar-backdrop"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}
    </header>
  );
}

function NavLink({
  href,
  label,
  icon,
  className,
}: {
  href: string;
  page: string;
  label: string;
  icon: "home" | "customers" | "add" | "records" | "reps" | "teams" | "reports" | "users" | "activity";
  className: string;
}) {
  return (
    <a href={href} className={className}>
      <SidebarIcon name={icon} />
      <span>{label}</span>
    </a>
  );
}

function SidebarIcon({
  name,
}: {
  name: "home" | "customers" | "add" | "records" | "reps" | "teams" | "reports" | "users" | "activity";
}) {
  const paths = {
    home: <><path d="m3 11 9-8 9 8" /><path d="M5 10v10h14V10" /><path d="M9 20v-6h6v6" /></>,
    customers: <><circle cx="9" cy="8" r="3" /><path d="M3 20v-2a6 6 0 0 1 12 0v2" /><circle cx="17" cy="9" r="2" /><path d="M16 14a5 5 0 0 1 5 5v1" /></>,
    add: <><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 8h8M12 12v6M9 15h6" /></>,
    records: <><path d="M6 3h12v18H6z" /><path d="M9 8h6M9 12h6M9 16h4" /></>,
    reps: <><circle cx="8" cy="8" r="3" /><circle cx="17" cy="9" r="2.5" /><path d="M2.5 20a5.5 5.5 0 0 1 11 0M13 16a4.5 4.5 0 0 1 8.5 2" /></>,
    teams: <><circle cx="7" cy="8" r="2.5" /><circle cx="17" cy="8" r="2.5" /><circle cx="12" cy="5" r="2.5" /><path d="M2.5 20a4.5 4.5 0 0 1 9 0M12.5 20a4.5 4.5 0 0 1 9 0M7.5 15a4.5 4.5 0 0 1 9 0" /></>,
    reports: <><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></>,
    users: <><circle cx="12" cy="7" r="3" /><path d="M5 21v-2a7 7 0 0 1 14 0v2" /><path d="M19 5v4M17 7h4" /></>,
    activity: <><path d="M4 4h16v16H4z" /><path d="M8 9h8M8 13h8M8 17h5" /><path d="M8 4V2M16 4V2" /></>,
  };
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {paths[name]}
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 17l5-5-5-5M15 12H3" /><path d="M14 3h5a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-5" />
    </svg>
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
