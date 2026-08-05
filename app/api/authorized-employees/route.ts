import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { readDashboardSession } from "../../../lib/dashboard-auth";
import { writeAuditLog } from "../../../lib/audit-log";

const supabase = createClient(
  process.env.SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string,
  { auth: { persistSession: false } }
);

export async function POST(request: NextRequest) {
  const session = await readDashboardSession(request.cookies.get("ultra_teb_session")?.value);
  if (session?.role !== "admin") return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  const body = await request.json();
  const employeeName = String(body.employeeName ?? "").trim();
  const nationalId = String(body.nationalId ?? "").replace(/\s+/g, "");
  const usesPassport = employeeName.replace(/\s+/g, " ") === "رامي رامز خيري مهايني";
  if (!employeeName || !nationalId) return NextResponse.json({ error: `Employee name and ${usesPassport ? "passport number" : "National ID"} are required.` }, { status: 400 });
  if (usesPassport && !/^[A-Za-z0-9]{3,13}$/.test(nationalId)) return NextResponse.json({ error: "Passport number must contain 3 to 13 letters or digits." }, { status: 400 });
  if (!usesPassport && !/^\d{14}$/.test(nationalId)) return NextResponse.json({ error: "National ID must contain exactly 14 digits." }, { status: 400 });
  const { data, error } = await supabase.from("authorized_employees").insert({ employee_name: employeeName, national_id: nationalId }).select("id, employee_name, national_id").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  await writeAuditLog(request, { action: "CREATE_AUTHORIZED_EMPLOYEE", entityType: "AUTHORIZED_EMPLOYEE", entityId: data.id, description: `Saved authorized employee ${data.employee_name}.`, metadata: { after: data } });
  return NextResponse.json({ data });
}

export async function DELETE(request: NextRequest) {
  const session = await readDashboardSession(request.cookies.get("ultra_teb_session")?.value);
  if (session?.role !== "admin") return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  const id = Number(new URL(request.url).searchParams.get("id"));
  const { data: before } = await supabase.from("authorized_employees").select("id, employee_name, national_id").eq("id", id).maybeSingle();
  const { error } = await supabase.from("authorized_employees").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  await writeAuditLog(request, { action: "DELETE_AUTHORIZED_EMPLOYEE", entityType: "AUTHORIZED_EMPLOYEE", entityId: id, description: `Deleted authorized employee ${before?.employee_name ?? id}.`, metadata: { before } });
  return NextResponse.json({ success: true });
}
