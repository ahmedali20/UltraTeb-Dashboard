import { NextRequest, NextResponse } from "next/server";
import { readDashboardSession } from "./lib/dashboard-auth";
import { hasDashboardPermission, type DashboardModule } from "./lib/dashboard-permissions";

function requestedModule(pathname: string): DashboardModule | null {
  if (pathname === "/") return "home";
  if (pathname.startsWith("/customers") || pathname.startsWith("/api/customers")) return "customers";
  if (pathname.startsWith("/sales-teams") || pathname.startsWith("/api/sales-teams") || pathname.startsWith("/api/sales-reps/bonus") || pathname.startsWith("/api/sales-reps/deductions")) return "teams";
  if (pathname.startsWith("/sales-reps") || pathname === "/api/sales-reps") return "reps";
  if (pathname.startsWith("/sales") || pathname.startsWith("/api/sales")) return "sales";
  if (pathname.startsWith("/reports")) return "reports";
  if (pathname.startsWith("/wht") || pathname.startsWith("/api/wht")) return "wht";
  if (pathname.startsWith("/cogs")) return "cogs";
  if (pathname.startsWith("/vat-report") || pathname.startsWith("/api/vat-report")) return "vat";
  if (pathname.startsWith("/income-statement-data") || pathname.startsWith("/api/income-statement-data")) return "incomeStatement";
  if (pathname.startsWith("/authorization") || pathname.startsWith("/api/authorized-employees")) return "authorization";
  return null;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname === "/login" || pathname === "/api/auth/login" || pathname === "/access-denied" || pathname.startsWith("/_next/") || pathname === "/favicon.ico") return NextResponse.next();

  if (pathname === "/api/google-sheets-sync" && process.env.CRON_SECRET && request.headers.get("authorization") === `Bearer ${process.env.CRON_SECRET}`) return NextResponse.next();

  const session = await readDashboardSession(request.cookies.get("ultra_teb_session")?.value);
  if (!session) {
    if (pathname.startsWith("/api/")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(loginUrl);
  }

  const alwaysAdmin = pathname === "/users" || pathname === "/activity-log" || pathname.startsWith("/api/auth/users") || pathname.startsWith("/api/activity-log") || pathname.startsWith("/api/google-sheets-sync");
  if (alwaysAdmin && session.role !== "admin") {
    if (pathname.startsWith("/api/")) return NextResponse.json({ error: "Admin access required." }, { status: 403 });
    return NextResponse.redirect(new URL("/access-denied", request.url));
  }

  const module = requestedModule(pathname);
  if (module) {
    const access = pathname.startsWith("/api/") && request.method !== "GET" ? "edit" : "view";
    if (!hasDashboardPermission(session, module, access)) {
      if (pathname.startsWith("/api/")) return NextResponse.json({ error: `${access === "edit" ? "Edit" : "View"} permission required.` }, { status: 403 });
      return NextResponse.redirect(new URL("/access-denied", request.url));
    }
  }

  return NextResponse.next();
}

export const config = { matcher: ["/((?!.*\\.[\\w]+$).*)"] };
