import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { readDashboardSession } from "../../../../lib/dashboard-auth";
import { hasDashboardPermission } from "../../../../lib/dashboard-permissions";
import { writeAuditLog } from "../../../../lib/audit-log";
import { NON_ADMIN_SALES_START_DATE } from "../../../../lib/sales-visibility";

const supabase = createClient(process.env.SUPABASE_URL as string, process.env.SUPABASE_SERVICE_ROLE_KEY as string, { auth: { persistSession: false } });

export async function POST(request: NextRequest) {
  const session = await readDashboardSession(request.cookies.get("ultra_teb_session")?.value);
  if (!session || !hasDashboardPermission(session, "cheques", "edit")) return NextResponse.json({ error: "Cheques edit permission required." }, { status: 403 });
  const body = await request.json();
  const chequeId = Number(body.chequeId);
  const invoiceId = String(body.invoiceId ?? "").trim();
  const amount = Math.round(Number(body.amount ?? 0) * 100) / 100;
  if (!Number.isSafeInteger(chequeId) || chequeId <= 0 || !invoiceId || !Number.isFinite(amount) || amount <= 0) return NextResponse.json({ error: "Select a cheque, invoice and valid allocation amount." }, { status: 400 });

  const { data: cheque } = await supabase.from("customer_cheques").select("*").eq("id", chequeId).maybeSingle();
  if (!cheque) return NextResponse.json({ error: "Cheque not found." }, { status: 404 });
  if (["REFUSED", "RETURNED_TO_CUSTOMER"].includes(String(cheque.cheque_status))) return NextResponse.json({ error: "This cheque cannot be allocated in its current status." }, { status: 400 });

  let invoiceQuery = supabase.from("sales_view").select("id, invoice_no, customer_code, customer_name, sales_date, sales_item_total, total_sales, sales_rep").eq("id", invoiceId).eq("document_type", "INVOICE");
  if (session.salesRepName) invoiceQuery = invoiceQuery.eq("sales_rep", session.salesRepName);
  if (session.role !== "admin") invoiceQuery = invoiceQuery.gte("sales_date", NON_ADMIN_SALES_START_DATE);
  const { data: invoice } = await invoiceQuery.maybeSingle();
  if (!invoice || String(invoice.customer_code) !== String(cheque.customer_code)) return NextResponse.json({ error: "The invoice must belong to the same customer as the cheque." }, { status: 400 });

  const { data: chequeAllocations, error: chequeAllocationError } = await supabase.from("cheque_allocations").select("allocated_amount").eq("cheque_id", chequeId);
  if (chequeAllocationError) return NextResponse.json({ error: chequeAllocationError.message }, { status: 400 });
  const allocatedChequeTotal = (chequeAllocations ?? []).reduce((sum, item) => sum + Number(item.allocated_amount || 0), 0);
  const chequeAvailable = Math.round((Number(cheque.amount || 0) - allocatedChequeTotal) * 100) / 100;
  if (amount > chequeAvailable + .01) return NextResponse.json({ error: `Only EGP ${chequeAvailable.toFixed(2)} remains unallocated on this cheque.` }, { status: 400 });

  const [notesResult, collectionsResult, invoiceAllocationsResult, recordedWhtResult] = await Promise.all([
    supabase.from("sales_view").select("sales_item_total, total_sales").eq("customer_code", invoice.customer_code).eq("original_invoice_no", String(invoice.invoice_no)).in("document_type", ["CR_NOTE", "DR_NOTE"]).gte("sales_date", invoice.sales_date),
    supabase.from("invoice_collections").select("amount, cash_fraction, wht_deducted_amount").eq("invoice_id", invoiceId).neq("payment_method", "CHEQUE"),
    supabase.from("cheque_allocations").select("cheque_id, allocated_amount, cash_fraction, wht_deducted_amount").eq("invoice_id", invoiceId),
    supabase.from("wht_collections").select("wht_amount").eq("document_type", "INVOICE").eq("invoice_no", String(invoice.invoice_no)),
  ]);
  const error = notesResult.error || collectionsResult.error || invoiceAllocationsResult.error || recordedWhtResult.error;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  const effectiveTotal = Number(invoice.total_sales || 0) + (notesResult.data ?? []).reduce((sum, note) => sum + Number(note.total_sales || 0), 0);
  let settled = (collectionsResult.data ?? []).reduce((sum, item) => sum + Number(item.amount || 0) + Number(item.cash_fraction || 0) + Number(item.wht_deducted_amount || 0), 0);
  const relatedChequeIds = Array.from(new Set((invoiceAllocationsResult.data ?? []).map((item) => String(item.cheque_id))));
  const activeChequeIds = new Set<string>();
  if (relatedChequeIds.length) {
    const { data: statuses } = await supabase.from("customer_cheques").select("id, cheque_status").in("id", relatedChequeIds);
    (statuses ?? []).forEach((item) => { if (!["REFUSED", "RETURNED_TO_CUSTOMER"].includes(String(item.cheque_status))) activeChequeIds.add(String(item.id)); });
  }
  settled += (invoiceAllocationsResult.data ?? []).filter((item) => activeChequeIds.has(String(item.cheque_id))).reduce((sum, item) => sum + Number(item.allocated_amount || 0) + Number(item.cash_fraction || 0) + Number(item.wht_deducted_amount || 0), 0);
  const recordedWht = (recordedWhtResult.data ?? []).reduce((sum, item) => sum + Number(item.wht_amount || 0), 0);
  const invoiceAvailable = Math.max(0, Math.round((effectiveTotal - Math.max(settled, recordedWht)) * 100) / 100);
  if (amount > invoiceAvailable + .01) return NextResponse.json({ error: `Only EGP ${invoiceAvailable.toFixed(2)} remains available on invoice ${invoice.invoice_no}.` }, { status: 400 });

  const { data, error: insertError } = await supabase.from("cheque_allocations").insert({ cheque_id: chequeId, invoice_id: invoiceId, invoice_no: String(invoice.invoice_no), allocated_amount: amount, cash_fraction: 0, wht_deducted_amount: 0 }).select("*").single();
  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 400 });
  await writeAuditLog(request, { action: "ALLOCATE_CHEQUE_BALANCE", entityType: "CHEQUE", entityId: chequeId, description: `Allocated ${amount.toFixed(2)} EGP from cheque ${cheque.cheque_no} to invoice ${invoice.invoice_no}.`, metadata: { chequeId, invoiceId, amount, allocation: data } });
  return NextResponse.json({ data });
}
