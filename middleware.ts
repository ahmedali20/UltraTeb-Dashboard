import { NextRequest, NextResponse } from "next/server";
import { verifyDashboardSession } from "./lib/dashboard-auth";

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

  const authenticated = await verifyDashboardSession(
    request.cookies.get("ultra_teb_session")?.value
  );
  if (authenticated) return NextResponse.next();

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

