import { NextResponse } from "next/server";
import { createDashboardSession } from "../../../../lib/dashboard-auth";

export async function POST(request: Request) {
  const { username, password } = await request.json();
  const expectedUsername = process.env.DASHBOARD_USERNAME;
  const expectedPassword = process.env.DASHBOARD_PASSWORD;

  if (!expectedUsername || !expectedPassword) {
    return NextResponse.json(
      { error: "Dashboard login is not configured." },
      { status: 500 }
    );
  }

  if (username !== expectedUsername || password !== expectedPassword) {
    return NextResponse.json(
      { error: "Incorrect username or password." },
      { status: 401 }
    );
  }

  const token = await createDashboardSession(expectedUsername);
  const response = NextResponse.json({ success: true });
  response.cookies.set("ultra_teb_session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 8 * 60 * 60,
  });
  return response;
}

