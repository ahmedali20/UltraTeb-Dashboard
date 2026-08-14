import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { readDashboardSession } from "../../../lib/dashboard-auth";
import { hasDashboardPermission } from "../../../lib/dashboard-permissions";
import { writeAuditLog } from "../../../lib/audit-log";
import { NON_ADMIN_SALES_START_DATE } from "../../../lib/sales-visibility";

const supabase = createClient(process.env.SUPABASE_URL as string, process.env.SUPABASE_SERVICE_ROLE_KEY as string, { auth: { persistSession: false } });
const statuses = ["IN_TREASURY", "UNDER_COLLECTION", "COLLECTED", "REFUSED", "RETURNED_TO_CUSTOMER"];

export async function PATCH(request: NextRequest) {
  const session = await readDashboardSession(request.cookies.get("ultra_teb_session")?.value);
  if (!session || !hasDashboardPermission(session, "cheques", "edit")) return NextResponse.json({ error: "Cheques edit permission required." }, { status: 403 });
  const body = await request.json();
  const id = Number(body.id);
  const action = String(body.action ?? "STATUS").trim().toUpperCase();
  if (!Number.isSafeInteger(id) || id <= 0) return NextResponse.json({ error: "Invalid cheque record." }, { status: 400 });
  const { data: before } = await supabase.from("customer_cheques").select("*").eq("id", id).maybeSingle();
  if (!before) return NextResponse.json({ error: "Cheque not found." }, { status: 404 });
  const { data: allocations } = await supabase.from("cheque_allocations").select("invoice_id, allocated_amount").eq("cheque_id", id);
  const invoiceIds = (allocations ?? []).map((allocation) => allocation.invoice_id);
  if (!invoiceIds.length && session.role !== "admin") return NextResponse.json({ error: "Cheque has no invoice allocations." }, { status: 400 });
  if (invoiceIds.length) {
    let invoiceQuery = supabase.from("sales_view").select("id").in("id", invoiceIds).eq("document_type", "INVOICE");
    if (session.salesRepName) invoiceQuery = invoiceQuery.eq("sales_rep", session.salesRepName);
    if (session.role !== "admin") invoiceQuery = invoiceQuery.gte("sales_date", NON_ADMIN_SALES_START_DATE);
    const { data: visibleInvoices } = await invoiceQuery;
    if ((visibleInvoices ?? []).length !== invoiceIds.length) return NextResponse.json({ error: "Cheque unavailable to this user." }, { status: 404 });
  }

  if (action === "DETAILS") {
    const chequeNo = String(body.chequeNo ?? "").trim();
    const bankName = String(body.bankName ?? "").trim();
    const collectionDate = String(body.collectionDate ?? "").trim();
    const chequeDate = String(body.chequeDate ?? "").trim();
    const amount = Number(body.amount ?? 0);
    const notes = String(body.notes ?? "").trim() || null;
    const allocatedTotal = (allocations ?? []).reduce((sum, item) => sum + Number(item.allocated_amount || 0), 0);
    if (!chequeNo || !bankName) return NextResponse.json({ error: "Cheque number and bank name are required." }, { status: 400 });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(collectionDate) || !/^\d{4}-\d{2}-\d{2}$/.test(chequeDate)) return NextResponse.json({ error: "Collection date and cheque date are required." }, { status: 400 });
    if (!Number.isFinite(amount) || amount <= 0) return NextResponse.json({ error: "Cheque amount must be greater than zero." }, { status: 400 });
    if (amount + 0.01 < allocatedTotal) return NextResponse.json({ error: "Cheque amount cannot be less than its invoice allocations." }, { status: 400 });
    const { data, error } = await supabase.from("customer_cheques").update({ cheque_no: chequeNo, bank_name: bankName, collection_date: collectionDate, cheque_date: chequeDate, amount, notes, updated_at: new Date().toISOString() }).eq("id", id).select("*").single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    await writeAuditLog(request, { action: "UPDATE_CHEQUE", entityType: "CHEQUE", entityId: id, description: `Updated cheque ${data.cheque_no}.`, metadata: { before, after: data } });
    return NextResponse.json({ data });
  }

  const status = String(body.status ?? "").trim().toUpperCase();
  const statusDate = String(body.statusDate ?? "").trim();
  if (!statuses.includes(status)) return NextResponse.json({ error: "Invalid cheque status." }, { status: 400 });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(statusDate)) return NextResponse.json({ error: "Status date is required." }, { status: 400 });
  const { data, error } = await supabase.from("customer_cheques").update({ cheque_status: status, cheque_status_date: statusDate, updated_at: new Date().toISOString() }).eq("id", id).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  await writeAuditLog(request, { action: "UPDATE_CHEQUE_STATUS", entityType: "CHEQUE", entityId: id, description: `Changed cheque ${data.cheque_no || id} from ${before.cheque_status} to ${status}.`, metadata: { before: { status: before.cheque_status, statusDate: before.cheque_status_date }, after: { status, statusDate }, invoiceIds, amount: data.amount } });
  return NextResponse.json({ data });
}

export async function DELETE(request: NextRequest) {
  const session = await readDashboardSession(request.cookies.get("ultra_teb_session")?.value);
  if (!session || !hasDashboardPermission(session, "cheques", "edit")) return NextResponse.json({ error: "Cheques edit permission required." }, { status: 403 });
  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!Number.isSafeInteger(id) || id <= 0) return NextResponse.json({ error: "Invalid cheque record." }, { status: 400 });
  const { data: before } = await supabase.from("customer_cheques").select("*").eq("id", id).maybeSingle();
  if (!before) return NextResponse.json({ error: "Cheque not found." }, { status: 404 });
  const { data: allocations } = await supabase.from("cheque_allocations").select("invoice_id, invoice_no, allocated_amount").eq("cheque_id", id);
  if (session.role !== "admin") {
    const invoiceIds = (allocations ?? []).map((item) => item.invoice_id);
    if (!invoiceIds.length) return NextResponse.json({ error: "Cheque unavailable to this user." }, { status: 404 });
    let invoiceQuery = supabase.from("sales_view").select("id").in("id", invoiceIds).eq("document_type", "INVOICE");
    if (session.salesRepName) invoiceQuery = invoiceQuery.eq("sales_rep", session.salesRepName);
    invoiceQuery = invoiceQuery.gte("sales_date", NON_ADMIN_SALES_START_DATE);
    const { data: visibleInvoices } = await invoiceQuery;
    if ((visibleInvoices ?? []).length !== invoiceIds.length) return NextResponse.json({ error: "Cheque unavailable to this user." }, { status: 404 });
  }
  const { error: allocationError } = await supabase.from("cheque_allocations").delete().eq("cheque_id", id);
  if (allocationError) return NextResponse.json({ error: allocationError.message }, { status: 400 });
  const { error } = await supabase.from("customer_cheques").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  await writeAuditLog(request, { action: "DELETE_CHEQUE", entityType: "CHEQUE", entityId: id, description: `Deleted cheque ${before.cheque_no}.`, metadata: { before, allocations } });
  return NextResponse.json({ success: true });
}
