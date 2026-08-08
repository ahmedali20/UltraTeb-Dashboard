import { NextRequest, NextResponse } from "next/server";
import { readDashboardSession } from "../../../../lib/dashboard-auth";

export async function GET(request: NextRequest) {
  const session = await readDashboardSession(
    request.cookies.get("ultra_teb_session")?.value
  );
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({
    username: session.username,
    role: session.role,
    salesRepId: session.salesRepId,
    salesRepName: session.salesRepName,
    permissions: session.permissions,
  });
}
