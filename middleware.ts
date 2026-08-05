  import { NextRequest, NextResponse } from "next/server";
  import { readDashboardSession } from "./lib/dashboard-auth";
  
  export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;
  
    if (
      pathname === "/login" ||
      pathname === "/api/auth/login" ||
      pathname.startsWith("/_next/") ||
      pathname === "/favicon.ico"
    ) {
      return NextResponse.next();
    }
  
    if (
      pathname === "/api/google-sheets-sync" &&
      process.env.CRON_SECRET &&
      request.headers.get("authorization") ===
        `Bearer ${process.env.CRON_SECRET}`
    ) {
      return NextResponse.next();
    }
  
    const session = await readDashboardSession(
      request.cookies.get("ultra_teb_session")?.value
    );
    if (session) {
      if (
        (pathname === "/users" ||
          pathname === "/sales-teams" ||
          pathname === "/wht" ||
          pathname === "/cogs" ||
          pathname === "/authorization" ||
          pathname === "/activity-log" ||
          pathname.startsWith("/api/auth/users") ||
          pathname.startsWith("/api/activity-log") ||
          pathname.startsWith("/api/sales-teams") ||
          pathname.startsWith("/api/wht") ||
          pathname.startsWith("/api/authorized-employees") ||
          pathname.startsWith("/api/sales-reps/bonus")) &&
        session.role !== "admin"
      ) {
        if (pathname.startsWith("/api/")) {
          return NextResponse.json({ error: "Admin access required." }, { status: 403 });
        }
        return NextResponse.redirect(new URL("/", request.url));
      }
      if (
        session.salesRepId &&
        request.method !== "GET" &&
        (pathname.startsWith("/api/sales") ||
          pathname.startsWith("/api/customers") ||
          pathname.startsWith("/api/google-sheets-sync"))
      ) {
        return NextResponse.json(
          { error: "Sales representative accounts have read-only access." },
          { status: 403 }
        );
      }
      return NextResponse.next();
    }
  
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(loginUrl);
  }
  
  export const config = {
    matcher: ["/((?!.*\\.[\\w]+$).*)"],
  };
