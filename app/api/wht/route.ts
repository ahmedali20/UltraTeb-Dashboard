import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { readDashboardSession } from "../../../lib/dashboard-auth";
import { writeAuditLog } from "../../../lib/audit-log";
import { hasDashboardPermission } from "../../../lib/dashboard-permissions";

const supabase = createClient(
  process.env.SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string,
  { auth: { persistSession: false } }
);

async function isAdmin(request: NextRequest) {
  const session = await readDashboardSession(request.cookies.get("ultra_teb_session")?.value);
  return Boolean(session && hasDashboardPermission(session, "wht", "edit"));
}

function values(body: Record<string, unknown>) {
  return {
    customer_name: String(body.customerName ?? "").trim(),
    invoice_no: String(body.invoiceNo ?? "").trim(),
    invoice_date: String(body.invoiceDate ?? "").trim(),
    subtotal: Number(body.subtotal ?? 0),
    tax: Number(body.tax ?? 0),
    wht_rate: 1,
    collected_amount: Number(body.collectedAmount ?? 0),
    collection_date: body.collectionDate ? String(body.collectionDate) : null,
    updated_at: new Date().toISOString(),
  };
}

function validate(data: ReturnType<typeof values>) {
  if (!data.customer_name || !data.invoice_no || !data.invoice_date) return "Customer, invoice number, and invoice date are required.";
  if (![data.subtotal, data.tax, data.collected_amount].every(Number.isFinite)) return "Amounts must be valid numbers.";
  if (data.subtotal < 0 || data.tax < 0 || data.collected_amount < 0) return "Amounts cannot be negative.";
  return null;
}

export async function POST(request: NextRequest) {
  if (!(await isAdmin(request))) return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  const data = values(await request.json());
  const validationError = validate(data);
  if (validationError) return NextResponse.json({ error: validationError }, { status: 400 });
  const { data: created, error } = await supabase.from("wht_collections").insert(data).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  await writeAuditLog(request, { action: "CREATE_WHT", entityType: "WHT", entityId: created.id, description: `Added WHT collection for invoice ${created.invoice_no}.`, metadata: { after: created } });
  return NextResponse.json({ data: created });
}

export async function PATCH(request: NextRequest) {
  if (!(await isAdmin(request))) return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  const body = await request.json();
  const id = Number(body.id);
  const data = values(body);
  const validationError = validate(data);
  if (!Number.isSafeInteger(id) || id <= 0) return NextResponse.json({ error: "Invalid WHT record." }, { status: 400 });
  if (validationError) return NextResponse.json({ error: validationError }, { status: 400 });
  const { data: before } = await supabase.from("wht_collections").select("*").eq("id", id).maybeSingle();
  const { data: updated, error } = await supabase.from("wht_collections").update(data).eq("id", id).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  await writeAuditLog(request, { action: "UPDATE_WHT", entityType: "WHT", entityId: id, description: `Updated WHT collection for invoice ${updated.invoice_no}.`, metadata: { before, after: updated } });
  return NextResponse.json({ data: updated });
}

export async function DELETE(request: NextRequest) {
  if (!(await isAdmin(request))) return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  const id = Number(new URL(request.url).searchParams.get("id"));
  const { data: before } = await supabase.from("wht_collections").select("*").eq("id", id).maybeSingle();
  const { error } = await supabase.from("wht_collections").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  await writeAuditLog(request, { action: "DELETE_WHT", entityType: "WHT", entityId: id, description: `Deleted WHT collection for invoice ${before?.invoice_no ?? id}.`, metadata: { before } });
  return NextResponse.json({ success: true });
}
