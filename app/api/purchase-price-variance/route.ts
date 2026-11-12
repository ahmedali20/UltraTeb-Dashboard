import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { readDashboardSession } from "../../../lib/dashboard-auth";
import { hasDashboardPermission } from "../../../lib/dashboard-permissions";
import { writeAuditLog } from "../../../lib/audit-log";

const supabase = createClient(
  process.env.SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string,
  { auth: { persistSession: false } }
);

async function canEdit(request: NextRequest) {
  const session = await readDashboardSession(request.cookies.get("ultra_teb_session")?.value);
  return Boolean(session && hasDashboardPermission(session, "purchaseVariance", "edit"));
}

function values(body: Record<string, unknown>) {
  const invoiceNumbers = Array.isArray(body.invoiceNumbers)
    ? Array.from(new Set(body.invoiceNumbers.map((value) => String(value).trim()).filter(Boolean)))
    : [];
  return {
    item_code: String(body.itemCode ?? "").trim(),
    product_name: String(body.productName ?? "").trim(),
    quantity: Number(body.quantity ?? 0),
    invoice_price: Number(body.invoicePrice ?? 0),
    actual_price: Number(body.actualPrice ?? 0),
    prices_include_vat: body.pricesIncludeVat === true,
    invoice_numbers: invoiceNumbers,
    notes: String(body.notes ?? "").trim() || null,
    updated_at: new Date().toISOString(),
  };
}

function validate(data: ReturnType<typeof values>) {
  if (!data.item_code) return "Item code is required.";
  if (!data.product_name) return "Product name is required.";
  if (!Number.isFinite(data.quantity) || data.quantity <= 0) return "Quantity must be greater than zero.";
  if (!Number.isFinite(data.invoice_price) || data.invoice_price < 0) return "Invoice price must be zero or greater.";
  if (!Number.isFinite(data.actual_price) || data.actual_price < 0) return "Actual price must be zero or greater.";
  if (!data.invoice_numbers.length) return "Add at least one invoice number.";
  return null;
}

export async function POST(request: NextRequest) {
  if (!(await canEdit(request))) return NextResponse.json({ error: "Edit permission required." }, { status: 403 });
  const data = values(await request.json());
  const validationError = validate(data);
  if (validationError) return NextResponse.json({ error: validationError }, { status: 400 });
  const result = await supabase.from("purchase_price_variances").insert(data).select("*").single();
  if (result.error) return NextResponse.json({ error: result.error.message }, { status: 400 });
  await writeAuditLog(request, { action: "CREATE_PURCHASE_VARIANCE", entityType: "PURCHASE_PRICE_VARIANCE", entityId: result.data.id, description: `Added purchase price variance for ${result.data.item_code}.`, metadata: { after: result.data } });
  return NextResponse.json({ data: result.data });
}

export async function PATCH(request: NextRequest) {
  if (!(await canEdit(request))) return NextResponse.json({ error: "Edit permission required." }, { status: 403 });
  const body = await request.json();
  const id = Number(body.id);
  const data = values(body);
  if (!Number.isSafeInteger(id) || id <= 0) return NextResponse.json({ error: "Invalid record." }, { status: 400 });
  const validationError = validate(data);
  if (validationError) return NextResponse.json({ error: validationError }, { status: 400 });
  const { data: before } = await supabase.from("purchase_price_variances").select("*").eq("id", id).maybeSingle();
  const result = await supabase.from("purchase_price_variances").update(data).eq("id", id).select("*").single();
  if (result.error) return NextResponse.json({ error: result.error.message }, { status: 400 });
  await writeAuditLog(request, { action: "UPDATE_PURCHASE_VARIANCE", entityType: "PURCHASE_PRICE_VARIANCE", entityId: id, description: `Updated purchase price variance for ${result.data.item_code}.`, metadata: { before, after: result.data } });
  return NextResponse.json({ data: result.data });
}

export async function DELETE(request: NextRequest) {
  if (!(await canEdit(request))) return NextResponse.json({ error: "Edit permission required." }, { status: 403 });
  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!Number.isSafeInteger(id) || id <= 0) return NextResponse.json({ error: "Invalid record." }, { status: 400 });
  const { data: before } = await supabase.from("purchase_price_variances").select("*").eq("id", id).maybeSingle();
  const { error } = await supabase.from("purchase_price_variances").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  await writeAuditLog(request, { action: "DELETE_PURCHASE_VARIANCE", entityType: "PURCHASE_PRICE_VARIANCE", entityId: id, description: `Deleted purchase price variance for ${before?.item_code ?? id}.`, metadata: { before } });
  return NextResponse.json({ success: true });
}
