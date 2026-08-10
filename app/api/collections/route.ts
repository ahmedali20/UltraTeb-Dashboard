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

async function editableSession(request: NextRequest) {
  const session = await readDashboardSession(request.cookies.get("ultra_teb_session")?.value);
  return session && hasDashboardPermission(session, "collections", "edit") ? session : null;
}

function collectionValues(body: Record<string, unknown>) {
  return {
    collection_date: String(body.collectionDate ?? "").trim(),
    amount: Number(body.amount ?? 0),
    payment_method: String(body.paymentMethod ?? "BANK_TRANSFER").trim().toUpperCase(),
    reference_no: String(body.referenceNo ?? "").trim() || null,
    notes: String(body.notes ?? "").trim() || null,
    updated_at: new Date().toISOString(),
  };
}

function validationError(values: ReturnType<typeof collectionValues>) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(values.collection_date)) return "Collection date is required.";
  if (!Number.isFinite(values.amount) || values.amount <= 0) return "Collected amount must be greater than zero.";
  if (!["CASH", "BANK_TRANSFER", "CHEQUE", "OTHER"].includes(values.payment_method)) return "Invalid payment method.";
  if (values.payment_method === "CHEQUE" && !values.reference_no) return "Cheque number is required.";
  return null;
}

async function permittedInvoice(invoiceId: string, salesRepName: string | null) {
  let query = supabase.from("sales_view").select("id, invoice_no, customer_code, customer_name, sales_rep, document_type").eq("id", invoiceId).eq("document_type", "INVOICE");
  if (salesRepName) query = query.eq("sales_rep", salesRepName);
  const { data } = await query.maybeSingle();
  return data;
}

export async function POST(request: NextRequest) {
  const session = await editableSession(request);
  if (!session) return NextResponse.json({ error: "Collections edit permission required." }, { status: 403 });
  const body = await request.json();
  const invoiceId = String(body.invoiceId ?? "").trim();
  const values = collectionValues(body);
  const errorMessage = validationError(values);
  if (!invoiceId) return NextResponse.json({ error: "Please choose an invoice." }, { status: 400 });
  if (errorMessage) return NextResponse.json({ error: errorMessage }, { status: 400 });
  const invoice = await permittedInvoice(invoiceId, session.salesRepName);
  if (!invoice) return NextResponse.json({ error: "Invoice not found or unavailable to this user." }, { status: 404 });
  const { data, error } = await supabase.from("invoice_collections").insert({
    ...values,
    cheque_status: values.payment_method === "CHEQUE" ? "IN_TREASURY" : null,
    cheque_status_date: values.payment_method === "CHEQUE" ? values.collection_date : null,
    invoice_id: String(invoice.id),
    invoice_no: String(invoice.invoice_no),
    customer_code: invoice.customer_code,
    customer_name: invoice.customer_name,
  }).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  await writeAuditLog(request, { action: "CREATE_COLLECTION", entityType: "COLLECTION", entityId: data.id, description: `Recorded ${data.amount} EGP collection for invoice ${data.invoice_no}.`, metadata: { after: data } });
  return NextResponse.json({ data });
}

export async function PATCH(request: NextRequest) {
  const session = await editableSession(request);
  if (!session) return NextResponse.json({ error: "Collections edit permission required." }, { status: 403 });
  const body = await request.json();
  const id = Number(body.id);
  const values = collectionValues(body);
  const errorMessage = validationError(values);
  if (!Number.isSafeInteger(id) || id <= 0) return NextResponse.json({ error: "Invalid collection record." }, { status: 400 });
  if (errorMessage) return NextResponse.json({ error: errorMessage }, { status: 400 });
  const { data: before } = await supabase.from("invoice_collections").select("*").eq("id", id).maybeSingle();
  if (!before || !(await permittedInvoice(String(before.invoice_id), session.salesRepName))) return NextResponse.json({ error: "Collection not found or unavailable to this user." }, { status: 404 });
  const chequeStatus = values.payment_method === "CHEQUE"
    ? before.payment_method === "CHEQUE" ? before.cheque_status || "IN_TREASURY" : "IN_TREASURY"
    : null;
  const { data, error } = await supabase.from("invoice_collections").update({
    ...values,
    cheque_status: chequeStatus,
    cheque_status_date: chequeStatus ? before.cheque_status_date || values.collection_date : null,
  }).eq("id", id).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  await writeAuditLog(request, { action: "UPDATE_COLLECTION", entityType: "COLLECTION", entityId: id, description: `Updated collection for invoice ${data.invoice_no}.`, metadata: { before, after: data } });
  return NextResponse.json({ data });
}

export async function DELETE(request: NextRequest) {
  const session = await editableSession(request);
  if (!session) return NextResponse.json({ error: "Collections edit permission required." }, { status: 403 });
  const id = Number(new URL(request.url).searchParams.get("id"));
  const { data: before } = await supabase.from("invoice_collections").select("*").eq("id", id).maybeSingle();
  if (!before || !(await permittedInvoice(String(before.invoice_id), session.salesRepName))) return NextResponse.json({ error: "Collection not found or unavailable to this user." }, { status: 404 });
  const { error } = await supabase.from("invoice_collections").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  await writeAuditLog(request, { action: "DELETE_COLLECTION", entityType: "COLLECTION", entityId: id, description: `Deleted collection for invoice ${before.invoice_no}.`, metadata: { before } });
  return NextResponse.json({ success: true });
}
