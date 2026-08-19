import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  createDashboardSession,
  createPasswordSalt,
  hashDashboardPassword,
} from "../../../../lib/dashboard-auth";
import { writeAuditLog } from "../../../../lib/audit-log";
import { normalizePermissions, type DashboardPermissions } from "../../../../lib/dashboard-permissions";

const supabase = createClient(
  process.env.SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string,
  { auth: { persistSession: false } }
);

const LOGIN_RATE_LIMIT_WINDOW_MINUTES = 15;
const LOGIN_RATE_LIMIT_MAX_ATTEMPTS = 5;

function getClientIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || "unknown";
}

async function isRateLimited(ip: string) {
  if (ip === "unknown") return false; // avoid locking everyone out together if IP is ever missing
  const since = new Date(
    Date.now() - LOGIN_RATE_LIMIT_WINDOW_MINUTES * 60 * 1000
  ).toISOString();
  const { count } = await supabase
    .from("dashboard_audit_logs")
    .select("id", { count: "exact", head: true })
    .eq("action", "LOGIN_FAILED")
    .eq("ip_address", ip)
    .gte("created_at", since);
  return (count ?? 0) >= LOGIN_RATE_LIMIT_MAX_ATTEMPTS;
}

export async function POST(request: Request) {
  const clientIp = getClientIp(request);

  if (await isRateLimited(clientIp)) {
    return NextResponse.json(
      {
        error: `عدد محاولات كبير جدًا. حاول تاني بعد ${LOGIN_RATE_LIMIT_WINDOW_MINUTES} دقيقة.`,
      },
      { status: 429 }
    );
  }

  const { username, password } = await request.json();
  const normalizedUsername = String(username ?? "").trim();
  const submittedPassword = String(password ?? "");
  let authenticatedRole: "admin" | "user" | null = null;
  let salesRepId: number | null = null;
  let salesRepName: string | null = null;
  let permissions: DashboardPermissions = {};

  const { data: managedUser } = await supabase
    .from("dashboard_users")
    .select("username, password_hash, password_salt, role, active, sales_rep_id, permissions, sales_reps(name)")
    .ilike("username", normalizedUsername)
    .maybeSingle();

  if (managedUser?.active) {
    const submittedHash = await hashDashboardPassword(
      submittedPassword,
      managedUser.password_salt
    );
    if (submittedHash === managedUser.password_hash) {
      authenticatedRole = managedUser.role;
      salesRepId = managedUser.sales_rep_id ?? null;
      salesRepName = (managedUser.sales_reps as any)?.name ?? null;
      permissions = normalizePermissions(managedUser.permissions);
    }
  }

  const environmentAdmin =
    normalizedUsername === process.env.DASHBOARD_USERNAME &&
    submittedPassword === process.env.DASHBOARD_PASSWORD;

  if (environmentAdmin) {
    authenticatedRole = "admin";
    salesRepId = null;
    salesRepName = null;
    permissions = {};

    if (!managedUser) {
      const salt = createPasswordSalt();
      await supabase.from("dashboard_users").insert({
        username: normalizedUsername,
        password_hash: await hashDashboardPassword(submittedPassword, salt),
        password_salt: salt,
        role: "admin",
        active: true,
      });
    }
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
    authenticatedRole,
    salesRepId,
    salesRepName,
    permissions
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
