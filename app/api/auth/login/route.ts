import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  createDashboardSession,
  createPasswordSalt,
  hashDashboardPassword,
} from "../../../../lib/dashboard-auth";
import { writeAuditLog } from "../../../../lib/audit-log";

const supabase = createClient(
  process.env.SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string,
  { auth: { persistSession: false } }
);

export async function POST(request: Request) {
  const { username, password } = await request.json();
  const normalizedUsername = String(username ?? "").trim();
  const submittedPassword = String(password ?? "");
  let authenticatedRole: "admin" | "user" | null = null;

  const { data: managedUser } = await supabase
    .from("dashboard_users")
    .select("username, password_hash, password_salt, role, active")
    .ilike("username", normalizedUsername)
    .maybeSingle();

  if (managedUser?.active) {
    const submittedHash = await hashDashboardPassword(
      submittedPassword,
      managedUser.password_salt
    );
    if (submittedHash === managedUser.password_hash) {
      authenticatedRole = managedUser.role;
    }
  }

  const environmentAdmin =
    normalizedUsername === process.env.DASHBOARD_USERNAME &&
    submittedPassword === process.env.DASHBOARD_PASSWORD;

  if (!managedUser && environmentAdmin) {
    const salt = createPasswordSalt();
    await supabase.from("dashboard_users").insert({
      username: normalizedUsername,
      password_hash: await hashDashboardPassword(submittedPassword, salt),
      password_salt: salt,
      role: "admin",
      active: true,
    });
    authenticatedRole = "admin";
  }

  if (!authenticatedRole) {
    await writeAuditLog(request, {
      username: normalizedUsername || "Unknown",
      role: null,
      action: "LOGIN_FAILED",
      entityType: "AUTH",
      description: `Failed sign-in attempt for ${normalizedUsername || "unknown user"}.`,
      success: false,
    });
    return NextResponse.json(
      { error: "Incorrect username or password." },
      { status: 401 }
    );
  }

  const token = await createDashboardSession(
    normalizedUsername,
    authenticatedRole
  );
  const response = NextResponse.json({ success: true });
  await writeAuditLog(request, {
    username: normalizedUsername,
    role: authenticatedRole,
    action: "LOGIN",
    entityType: "AUTH",
    description: `${normalizedUsername} signed in.`,
  });
  response.cookies.set("ultra_teb_session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 8 * 60 * 60,
  });
  return response;
}
