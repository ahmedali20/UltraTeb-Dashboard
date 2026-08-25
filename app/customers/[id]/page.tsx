import { createClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";
import { getCurrentDashboardUser } from "../../../lib/current-dashboard-user";
import { canViewPre2026Sales, NON_ADMIN_SALES_START_DATE } from "../../../lib/sales-visibility";
import CustomerBalanceClient from "./CustomerBalanceClient";

const supabase = createClient(process.env.SUPABASE_URL as string, process.env.SUPABASE_SERVICE_ROLE_KEY as string, { auth: { persistSession: false } });
export const revalidate = 0;

export default async function CustomerBalancePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getCurrentDashboardUser();
  let customerQuery = supabase.from("customers").select("*").eq("id", id);
  if (session?.salesRepName) customerQuery = customerQuery.eq("sales_rep_name", session.salesRepName);
  const { data: customer } = await customerQuery.maybeSingle();
  if (!customer) notFound();

  let invoiceQuery = supabase.from("sales_view").select("id, invoice_no, original_invoice_no, sales_date, due_date, sales_item_total, total_sales, sales_rep, document_type").eq("customer_code", customer.customer_code).in("document_type", ["INVOICE", "CR_NOTE", "DR_NOTE"]).order("sales_date", { ascending: false });
  if (session?.salesRepName) invoiceQuery = invoiceQuery.eq("sales_rep", session.salesRepName);
  if (!canViewPre2026Sales(session)) invoiceQuery = invoiceQuery.gte("sales_date", NON_ADMIN_SALES_START_DATE);
  const { data: invoices, error: invoiceError } = await invoiceQuery;
  if (invoiceError) return <main style={{ padding: 32, color: "#dc2626" }}>{invoiceError.message}</main>;

  const invoiceIds = (invoices ?? []).map((item) => String(item.id));
  const [collectionsResult, allocationsResult, whtResult] = await Promise.all([
    invoiceIds.length ? supabase.from("invoice_collections").select("invoice_id, amount, transfer_fees, cash_fraction, wht_deducted_amount").in("invoice_id", invoiceIds).neq("payment_method", "CHEQUE") : Promise.resolve({ data: [], error: null }),
    invoiceIds.length ? supabase.from("cheque_allocations").select("invoice_id, cheque_id, allocated_amount, cash_fraction, wht_deducted_amount").in("invoice_id", invoiceIds) : Promise.resolve({ data: [], error: null }),
    supabase.from("wht_collections").select("sales_id, document_type, invoice_no, invoice_date, wht_amount, collected_amount").eq("customer_name", customer.customer_name),
  ]);
  const customerChequesResult = await supabase.from("customer_cheques").select("id, cheque_no, bank_name, cheque_date, amount, cheque_status").eq("customer_code", customer.customer_code);
  const customerChequeIds = (customerChequesResult.data ?? []).map((item: any) => String(item.id));
  const allCustomerAllocationsResult = customerChequeIds.length
    ? await supabase.from("cheque_allocations").select("cheque_id, allocated_amount").in("cheque_id", customerChequeIds)
    : { data: [], error: null };
  const chequeIds = Array.from(new Set((allocationsResult.data ?? []).map((item: any) => String(item.cheque_id))));
  const chequesResult = chequeIds.length ? await supabase.from("customer_cheques").select("id, cheque_status").in("id", chequeIds) : { data: [], error: null };
  const error = collectionsResult.error || allocationsResult.error || whtResult.error || chequesResult.error || customerChequesResult.error || allCustomerAllocationsResult.error;
  if (error) return <main style={{ padding: 32, color: "#dc2626" }}>{error.message}</main>;

  const payments = new Map<string, number>();
  const transferFeeAdjustmentsByInvoice = new Map<string, number>();
  const deductedWht = new Map<string, number>();
  const cashFractions = new Map<string, number>();
  (collectionsResult.data ?? []).forEach((item: any) => {
    payments.set(String(item.invoice_id), (payments.get(String(item.invoice_id)) ?? 0) + Math.max(0, Number(item.amount || 0) - Number(item.transfer_fees || 0)));
    transferFeeAdjustmentsByInvoice.set(String(item.invoice_id), (transferFeeAdjustmentsByInvoice.get(String(item.invoice_id)) ?? 0) + Number(item.transfer_fees || 0));
    cashFractions.set(String(item.invoice_id), (cashFractions.get(String(item.invoice_id)) ?? 0) + Number(item.cash_fraction || 0));
    deductedWht.set(String(item.invoice_id), (deductedWht.get(String(item.invoice_id)) ?? 0) + Number(item.wht_deducted_amount || 0));
  });
  const chequeStatus = new Map((chequesResult.data ?? []).map((item: any) => [String(item.id), item.cheque_status]));
  (allocationsResult.data ?? []).forEach((item: any) => {
    if (chequeStatus.get(String(item.cheque_id)) === "COLLECTED") {
      payments.set(String(item.invoice_id), (payments.get(String(item.invoice_id)) ?? 0) + Number(item.allocated_amount || 0));
      cashFractions.set(String(item.invoice_id), (cashFractions.get(String(item.invoice_id)) ?? 0) + Number(item.cash_fraction || 0));
      deductedWht.set(String(item.invoice_id), (deductedWht.get(String(item.invoice_id)) ?? 0) + Number(item.wht_deducted_amount || 0));
    }
  });
  const wht = new Map<string, { expected: number; collected: number }>();
  (whtResult.data ?? []).forEach((item: any) => {
    const key = item.sales_id ? String(item.sales_id) : `${item.document_type ?? "INVOICE"}|${String(item.invoice_no)}|${String(item.invoice_date ?? "").slice(0, 10)}`;
    const current = wht.get(key) ?? { expected: 0, collected: 0 };
    current.expected += Number(item.wht_amount || 0);
    current.collected += Number(item.collected_amount || 0);
    wht.set(key, current);
  });
  const rows = (invoices ?? []).map((invoice: any) => {
    const legacyWhtKey = `${invoice.document_type}|${String(invoice.invoice_no)}|${String(invoice.sales_date).slice(0, 10)}`;
    const recordedWht = wht.get(String(invoice.id)) ?? wht.get(legacyWhtKey);
    const automaticDocumentWht = Math.round(Number(invoice.sales_item_total || 0)) / 100;
    const recordedOrDeductedWht = Math.max(deductedWht.get(String(invoice.id)) ?? 0, recordedWht?.expected ?? 0);
    const expectedWht = invoice.document_type === "CR_NOTE" ? automaticDocumentWht : Math.max(recordedOrDeductedWht, automaticDocumentWht);
    const collectedWht = recordedWht?.collected ?? 0;
    const customerPayments = payments.get(String(invoice.id)) ?? 0;
    const cashFraction = cashFractions.get(String(invoice.id)) ?? 0;
    const remainingWht = expectedWht - collectedWht;
    const transferFeeAdjustment = transferFeeAdjustmentsByInvoice.get(String(invoice.id)) ?? 0;
    const remainingMoney = Number(invoice.total_sales || 0) - expectedWht - customerPayments - transferFeeAdjustment - cashFraction;
    return { ...invoice, expected_wht: expectedWht, collected_wht: collectedWht, customer_payments: customerPayments, cash_fraction: cashFraction, remaining_wht: invoice.document_type === "CR_NOTE" ? remainingWht : Math.max(0, remainingWht), remaining_money: invoice.document_type === "CR_NOTE" ? remainingMoney : Math.max(0, remainingMoney) };
  });
  const invoiceRowsByNumber = new Map<string, any[]>();
  rows.filter((row: any) => row.document_type === "INVOICE").forEach((invoice: any) => {
    const key = String(invoice.invoice_no).trim();
    const matches = invoiceRowsByNumber.get(key) ?? [];
    matches.push(invoice);
    invoiceRowsByNumber.set(key, matches);
  });
  invoiceRowsByNumber.forEach((matches) => matches.sort((a, b) => String(a.sales_date).localeCompare(String(b.sales_date))));
  const linkedNoteAdjustments = new Map<any, { money: number; wht: number }>();
  rows.filter((row: any) => row.document_type === "CR_NOTE" || row.document_type === "DR_NOTE").forEach((note: any) => {
    const originalInvoiceNo = String(note.original_invoice_no ?? "").trim();
    if (!originalInvoiceNo) return;
    const matches = invoiceRowsByNumber.get(originalInvoiceNo) ?? [];
    const eligible = matches.filter((invoice: any) => String(invoice.sales_date) <= String(note.sales_date));
    const invoice = eligible.at(-1) ?? matches.at(-1);
    if (!invoice) return;
    const adjustment = linkedNoteAdjustments.get(invoice) ?? { money: 0, wht: 0 };
    adjustment.money += Number(note.remaining_money || 0);
    adjustment.wht += Number(note.remaining_wht || 0);
    linkedNoteAdjustments.set(invoice, adjustment);
    note.remaining_money = 0;
    note.remaining_wht = 0;
  });
  let customerCreditBalance = 0;
  linkedNoteAdjustments.forEach((adjustment, invoice) => {
    const adjustedMoney = Number(invoice.remaining_money || 0) + adjustment.money;
    if (adjustedMoney < 0) customerCreditBalance += Math.abs(adjustedMoney);
    if (adjustedMoney > 0 && adjustedMoney < 1) {
      invoice.cash_fraction = Number(invoice.cash_fraction || 0) + adjustedMoney;
      invoice.remaining_money = 0;
    } else {
      invoice.remaining_money = Math.max(0, adjustedMoney);
    }
    invoice.remaining_wht = Math.max(0, Number(invoice.remaining_wht || 0) + adjustment.wht);
  });
  const allocationsByCheque = new Map<string, number>();
  (allCustomerAllocationsResult.data ?? []).forEach((item: any) => allocationsByCheque.set(String(item.cheque_id), (allocationsByCheque.get(String(item.cheque_id)) ?? 0) + Number(item.allocated_amount || 0)));
  const unallocatedChequeBalance = (customerChequesResult.data ?? []).reduce((sum: number, cheque: any) => cheque.cheque_status === "COLLECTED" ? sum + Math.max(0, Number(cheque.amount || 0) - (allocationsByCheque.get(String(cheque.id)) ?? 0)) : sum, 0);
  const unallocatedCheques = (customerChequesResult.data ?? []).map((cheque: any) => ({
    id: Number(cheque.id),
    cheque_no: String(cheque.cheque_no || ""),
    bank_name: cheque.bank_name ? String(cheque.bank_name) : null,
    cheque_date: cheque.cheque_date ? String(cheque.cheque_date) : null,
    amount: Number(cheque.amount || 0),
    unallocated_amount: Math.max(0, Number(cheque.amount || 0) - (allocationsByCheque.get(String(cheque.id)) ?? 0)),
  })).filter((cheque: any) => cheque.unallocated_amount > 0.005);
  const transferFeeAdjustments = (collectionsResult.data ?? []).reduce((sum: number, item: any) => sum + Number(item.transfer_fees || 0), 0);
  return <CustomerBalanceClient customer={customer} invoices={rows} customerCreditBalance={customerCreditBalance} unallocatedChequeBalance={unallocatedChequeBalance} unallocatedCheques={unallocatedCheques} transferFeeAdjustments={transferFeeAdjustments} />;
}
