import { NextRequest, NextResponse } from "next/server";
import { writeAuditLog } from "../../../../lib/audit-log";

export async function POST(request: NextRequest) {
  await writeAuditLog(request, {
    action: "LOGOUT",
    entityType: "AUTH",
    description: "User signed out.",
  });
  const response = NextResponse.json({ success: true });
  response.cookies.set("ultra_teb_session", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    expires: new Date(0),
  });
  return response;
}
