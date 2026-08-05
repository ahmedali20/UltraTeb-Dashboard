import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { readDashboardSession } from "../../../lib/dashboard-auth";
import { writeAuditLog } from "../../../lib/audit-log";

const supabase = createClient(
  process.env.SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string,
  { auth: { persistSession: false } }
);

const sections = new Set([
  "SELLING_EXPENSE",
  "GENERAL_ADMIN_EXPENSE",
  "OTHER_OPERATING_EXPENSE",
  "OTHER_INCOME",
  "FINANCE_COST",
  "INCOME_TAX",
]);

async function isAdmin(request: NextRequest) {
  const session = await readDashboardSession(request.cookies.get("ultra_teb_session")?.value);
  return session?.role === "admin";
}

function values(body: Record<string, unknown>) {
  return {
    entry_month: String(body.entryMonth ?? "").trim(),
    statement_section: String(body.statementSection ?? "").trim(),
    category: String(body.category ?? "").trim(),
    description: String(body.description ?? "").trim() || null,
    amount: Number(body.amount ?? 0),
    updated_at: new Date().toISOString(),
  };
}

function validate(data: ReturnType<typeof values>) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(data.entry_month)) return "Choose a valid month.";
  if (!sections.has(data.statement_section)) return "Choose a valid Income Statement section.";
  if (!data.category) return "Category is required.";
  if (!Number.isFinite(data.amount) || data.amount < 0) return "Amount must be zero or greater.";
  return null;
}

export async function POST(request: NextRequest) {
  if (!(await isAdmin(request))) return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  const data = values(await request.json());
  const validationError = validate(data);
  if (validationError) return NextResponse.json({ error: validationError }, { status: 400 });
  const { data: created, error } = await supabase.from("income_statement_entries").insert(data).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  await writeAuditLog(request, { action: "CREATE_IS_ENTRY", entityType: "INCOME_STATEMENT_ENTRY", entityId: created.id, description: `Added ${created.category} for ${created.entry_month}.`, metadata: { after: created } });
  return NextResponse.json({ data: created });
}

export async function PATCH(request: NextRequest) {
  if (!(await isAdmin(request))) return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  const body = await request.json();
  const id = Number(body.id);
  const data = values(body);
  const validationError = validate(data);
  if (!Number.isSafeInteger(id) || id <= 0) return NextResponse.json({ error: "Invalid record." }, { status: 400 });
  if (validationError) return NextResponse.json({ error: validationError }, { status: 400 });
  const { data: before } = await supabase.from("income_statement_entries").select("*").eq("id", id).maybeSingle();
  const { data: updated, error } = await supabase.from("income_statement_entries").update(data).eq("id", id).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  await writeAuditLog(request, { action: "UPDATE_IS_ENTRY", entityType: "INCOME_STATEMENT_ENTRY", entityId: id, description: `Updated ${updated.category} for ${updated.entry_month}.`, metadata: { before, after: updated } });
  return NextResponse.json({ data: updated });
}

export async function DELETE(request: NextRequest) {
  if (!(await isAdmin(request))) return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!Number.isSafeInteger(id) || id <= 0) return NextResponse.json({ error: "Invalid record." }, { status: 400 });
  const { data: before } = await supabase.from("income_statement_entries").select("*").eq("id", id).maybeSingle();
  const { error } = await supabase.from("income_statement_entries").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  await writeAuditLog(request, { action: "DELETE_IS_ENTRY", entityType: "INCOME_STATEMENT_ENTRY", entityId: id, description: `Deleted ${before?.category ?? "Income Statement entry"}.`, metadata: { before } });
  return NextResponse.json({ success: true });
}
