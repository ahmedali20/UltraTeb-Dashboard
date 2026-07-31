import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  createPasswordSalt,
  hashDashboardPassword,
  readDashboardSession,
} from "../../../../lib/dashboard-auth";
import { writeAuditLog } from "../../../../lib/audit-log";

const supabase = createClient(
  process.env.SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string,
  { auth: { persistSession: false } }
);

async function adminSession(request: NextRequest) {
  const session = await readDashboardSession(
    request.cookies.get("ultra_teb_session")?.value
  );
  return session?.role === "admin" ? session : null;
}

export async function GET(request: NextRequest) {
  if (!(await adminSession(request))) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }
  const { data, error } = await supabase
    .from("dashboard_users")
    .select("id, username, role, active, created_at")
    .order("username");
  return error
    ? NextResponse.json({ error: error.message }, { status: 400 })
    : NextResponse.json({ data });
}

export async function POST(request: NextRequest) {
  if (!(await adminSession(request))) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }
  const body = await request.json();
  const username = String(body.username ?? "").trim();
  const password = String(body.password ?? "");
  const role = body.role === "admin" ? "admin" : "user";

  if (username.length < 3 || password.length < 8) {
    return NextResponse.json(
      { error: "Username needs 3 characters and password needs 8 characters." },
      { status: 400 }
    );
  }
  const salt = createPasswordSalt();
  const { data, error } = await supabase
    .from("dashboard_users")
    .insert({
      username,
      password_hash: await hashDashboardPassword(password, salt),
      password_salt: salt,
      role,
      active: true,
    })
    .select("id, username, role, active, created_at")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  await writeAuditLog(request, {
    action: "CREATE_USER",
    entityType: "USER",
    entityId: data.id,
    description: `Created user ${data.username} with role ${data.role}.`,
    metadata: { username: data.username, role: data.role, active: data.active },
  });
  return NextResponse.json({ data });
}

export async function PATCH(request: NextRequest) {
  const session = await adminSession(request);
  if (!session) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }
  const body = await request.json();
  const id = String(body.id ?? "");
  if (!id) return NextResponse.json({ error: "Missing user ID." }, { status: 400 });

  const { data: target, error: targetError } = await supabase
    .from("dashboard_users")
    .select("username, role, active")
    .eq("id", id)
    .single();
  if (targetError) {
    return NextResponse.json({ error: targetError.message }, { status: 400 });
  }
  const isCurrentAdmin =
    target.username.toLowerCase() === session.username.toLowerCase();
  if (
    isCurrentAdmin &&
    (body.role === "user" || body.active === false)
  ) {
    return NextResponse.json(
      { error: "You cannot demote or deactivate your own admin account." },
      { status: 400 }
    );
  }

  const changes: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.role === "admin" || body.role === "user") changes.role = body.role;
  if (typeof body.active === "boolean") changes.active = body.active;
  if (body.password) {
    if (String(body.password).length < 8) {
      return NextResponse.json(
        { error: "Password must contain at least 8 characters." },
        { status: 400 }
      );
    }
    const salt = createPasswordSalt();
    changes.password_salt = salt;
    changes.password_hash = await hashDashboardPassword(
      String(body.password),
      salt
    );
  }

  const { data, error } = await supabase
    .from("dashboard_users")
    .update(changes)
    .eq("id", id)
    .select("id, username, role, active, created_at")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  await writeAuditLog(request, {
    action: "UPDATE_USER",
    entityType: "USER",
    entityId: data.id,
    description: `Updated user ${data.username}.`,
    metadata: {
      before: { username: target.username, role: target.role, active: target.active },
      after: { username: data.username, role: data.role, active: data.active },
      passwordChanged: Boolean(body.password),
    },
  });
  return NextResponse.json({ data });
}

export async function DELETE(request: NextRequest) {
  const session = await adminSession(request);
  if (!session) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }
  const id = request.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing user ID." }, { status: 400 });

  const { data: target } = await supabase
    .from("dashboard_users")
    .select("username, role, active")
    .eq("id", id)
    .single();
  if (target?.username?.toLowerCase() === session.username.toLowerCase()) {
    return NextResponse.json(
      { error: "You cannot delete your own active admin account." },
      { status: 400 }
    );
  }

  const { error } = await supabase.from("dashboard_users").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  await writeAuditLog(request, {
    action: "DELETE_USER",
    entityType: "USER",
    entityId: id,
    description: `Deleted user ${target?.username ?? id}.`,
    metadata: { deletedRecord: target },
  });
  return NextResponse.json({ success: true });
}
