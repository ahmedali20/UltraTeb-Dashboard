import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { readDashboardSession } from "../../../../lib/dashboard-auth";
import { writeAuditLog } from "../../../../lib/audit-log";

const supabase = createClient(
  process.env.SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string,
  { auth: { persistSession: false } }
);

async function requireAdmin(request: NextRequest) {
  const session = await readDashboardSession(
    request.cookies.get("ultra_teb_session")?.value
  );
  return session?.role === "admin";
}

export async function POST(request: NextRequest) {
  if (!(await requireAdmin(request))) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const body = await request.json();
  const salesRepId = Number(body.salesRepId);
  const month = String(body.month ?? "").trim();
  const amount = Number(body.amount);
  const reason = String(body.reason ?? "").trim();

  if (!Number.isSafeInteger(salesRepId) || salesRepId <= 0 || !month || month === "All") {
    return NextResponse.json({ error: "Select a representative and a specific month." }, { status: 400 });
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "Deduction amount must be greater than zero." }, { status: 400 });
  }
  if (!reason) {
    return NextResponse.json({ error: "Deduction reason is required." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("sales_rep_salary_deductions")
    .insert({ sales_rep_id: salesRepId, month, amount, reason })
    .select("id, sales_rep_id, month, amount, reason")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await writeAuditLog(request, {
    action: "CREATE_DEDUCTION",
    entityType: "SALES_REP",
    entityId: salesRepId,
    description: `Added ${amount} EGP salary deduction for ${month}: ${reason}.`,
    metadata: { after: data },
  });
  return NextResponse.json({ data });
}

export async function DELETE(request: NextRequest) {
  if (!(await requireAdmin(request))) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }
  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!Number.isSafeInteger(id) || id <= 0) {
    return NextResponse.json({ error: "A valid deduction is required." }, { status: 400 });
  }

  const { data: before } = await supabase
    .from("sales_rep_salary_deductions")
    .select("id, sales_rep_id, month, amount, reason")
    .eq("id", id)
    .maybeSingle();
  const { error } = await supabase.from("sales_rep_salary_deductions").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await writeAuditLog(request, {
    action: "DELETE_DEDUCTION",
    entityType: "SALES_REP",
    entityId: before?.sales_rep_id ?? null,
    description: `Deleted a salary deduction${before ? ` of ${before.amount} EGP for ${before.month}` : ""}.`,
    metadata: { before },
  });
  return NextResponse.json({ success: true });
}
