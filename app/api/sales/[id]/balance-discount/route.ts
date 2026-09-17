import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { readDashboardSession } from "../../../../../lib/dashboard-auth";
import { hasDashboardPermission } from "../../../../../lib/dashboard-permissions";
import { writeAuditLog } from "../../../../../lib/audit-log";
import { NON_ADMIN_SALES_START_DATE } from "../../../../../lib/sales-visibility";

const supabase = createClient(
  process.env.SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string,
  { auth: { persistSession: false } }
);

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await readDashboardSession(request.cookies.get("ultra_teb_session")?.value);
  if (!session || !hasDashboardPermission(session, "customers", "edit")) {
    return NextResponse.json({ error: "Customer edit permission required." }, { status: 403 });
  }
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const amount = Number(body.amount);
  const reason = String(body.reason ?? "").trim();
  if (!Number.isFinite(amount) || amount < 0 || Math.abs(amount * 100 - Math.round(amount * 100)) > 1e-6) {
    return NextResponse.json({ error: "Enter a non-negative discount with at most two decimal places." }, { status: 400 });
  }
  if (amount > 0 && !reason) {
    return NextResponse.json({ error: "A reason is required for a balance discount." }, { status: 400 });
  }
  let invoiceQuery = supabase.from("sales_view").select("id, invoice_no, customer_code, sales_date, document_type, total_sales, sales_rep").eq("id", id).eq("document_type", "INVOICE");
  if (session.salesRepName) invoiceQuery = invoiceQuery.eq("sales_rep", session.salesRepName);
  if (session.role !== "admin") invoiceQuery = invoiceQuery.gte("sales_date", NON_ADMIN_SALES_START_DATE);
  const { data: invoice, error: invoiceError } = await invoiceQuery.maybeSingle();
  if (invoiceError) return NextResponse.json({ error: invoiceError.message }, { status: 400 });
  if (!invoice) return NextResponse.json({ error: "Invoice not found." }, { status: 404 });
  const { data: before, error: beforeError } = await supabase.from("sales").select("balance_discount, balance_discount_reason").eq("id", id).maybeSingle();
  if (beforeError) return NextResponse.json({ error: beforeError.message }, { status: 400 });

  const [notes, collections, allocations, wht] = await Promise.all([
    supabase.from("sales_view").select("total_sales").eq("customer_code", invoice.customer_code).eq("original_invoice_no", String(invoice.invoice_no)).in("document_type", ["CR_NOTE", "DR_NOTE"]).gte("sales_date", invoice.sales_date),
    supabase.from("invoice_collections").select("amount, cash_fraction, wht_deducted_amount").eq("invoice_id", id).neq("payment_method", "CHEQUE"),
    supabase.from("cheque_allocations").select("cheque_id, allocated_amount, cash_fraction, wht_deducted_amount").eq("invoice_id", id),
    supabase.from("wht_collections").select("wht_amount").eq("document_type", "INVOICE").eq("invoice_no", String(invoice.invoice_no)),
  ]);
  const queryError = notes.error || collections.error || allocations.error || wht.error;
  if (queryError) return NextResponse.json({ error: queryError.message }, { status: 400 });
  const chequeIds = [...new Set((allocations.data ?? []).map((row) => String(row.cheque_id)))];
  const chequeStatuses = chequeIds.length
    ? await supabase.from("customer_cheques").select("id, cheque_status").in("id", chequeIds)
    : { data: [], error: null };
  if (chequeStatuses.error) return NextResponse.json({ error: chequeStatuses.error.message }, { status: 400 });
  const activeCheques = new Set((chequeStatuses.data ?? []).filter((row) => !["REFUSED", "RETURNED_TO_CUSTOMER"].includes(row.cheque_status)).map((row) => String(row.id)));
  const effectiveTotal = Number(invoice.total_sales || 0) + (notes.data ?? []).reduce((sum, row) => sum + Number(row.total_sales || 0), 0);
  const directSettled = (collections.data ?? []).reduce((sum, row) => sum + Number(row.amount || 0) + Number(row.cash_fraction || 0), 0);
  const activeAllocations = (allocations.data ?? []).filter((row) => activeCheques.has(String(row.cheque_id)));
  const chequeSettled = activeAllocations.reduce((sum, row) => sum + Number(row.allocated_amount || 0) + Number(row.cash_fraction || 0), 0);
  const deductedWht = (collections.data ?? []).reduce((sum, row) => sum + Number(row.wht_deducted_amount || 0), 0) + activeAllocations.reduce((sum, row) => sum + Number(row.wht_deducted_amount || 0), 0);
  const recordedWht = (wht.data ?? []).reduce((sum, row) => sum + Number(row.wht_amount || 0), 0);
  const maximumDiscount = Math.max(0, Math.round((effectiveTotal - directSettled - chequeSettled - Math.max(deductedWht, recordedWht)) * 100) / 100);
  if (amount > maximumDiscount + 0.005) {
    return NextResponse.json({ error: `Discount cannot exceed the unsettled invoice balance (EGP ${maximumDiscount.toFixed(2)}).` }, { status: 400 });
  }
  const { data, error } = await supabase.from("sales").update({ balance_discount: amount, balance_discount_reason: amount ? reason : null }).eq("id", id).eq("document_type", "INVOICE").select("id, invoice_no, balance_discount, balance_discount_reason").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  await writeAuditLog(request, {
    action: "UPDATE_INVOICE_BALANCE_DISCOUNT",
    entityType: "INVOICE",
    entityId: id,
    description: `Changed balance discount on invoice ${invoice.invoice_no} from EGP ${Number(before?.balance_discount || 0).toFixed(2)} to EGP ${amount.toFixed(2)}${reason ? ` — ${reason}` : ""}.`,
    metadata: { changes: { balance_discount: { from: Number(before?.balance_discount || 0), to: amount }, balance_discount_reason: { from: before?.balance_discount_reason, to: amount ? reason : null } } },
  });
  return NextResponse.json({ data });
}
