import { createClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";
import { getCurrentDashboardUser } from "../../../lib/current-dashboard-user";
import { canViewPre2026Sales, NON_ADMIN_SALES_START_DATE } from "../../../lib/sales-visibility";
import CustomerBalanceClient from "./CustomerBalanceClient";

const supabase = createClient(process.env.SUPABASE_URL as string, process.env.SUPABASE_SERVICE_ROLE_KEY as string, { auth: { persistSession: false } });
export const revalidate = 0;

export default async function CustomerBalancePage({ params }: { params: { id: string } }) {
  const session = await getCurrentDashboardUser();
  let customerQuery = supabase.from("customers").select("*").eq("id", params.id);
  if (session?.salesRepName) customerQuery = customerQuery.eq("sales_rep_name", session.salesRepName);
  const { data: customer } = await customerQuery.maybeSingle();
  if (!customer) notFound();

  let invoiceQuery = supabase.from("sales_view").select("id, invoice_no, sales_date, due_date, sales_item_total, total_sales, sales_rep").eq("customer_code", customer.customer_code).eq("document_type", "INVOICE").order("sales_date", { ascending: false });
  if (session?.salesRepName) invoiceQuery = invoiceQuery.eq("sales_rep", session.salesRepName);
  if (!canViewPre2026Sales(session)) invoiceQuery = invoiceQuery.gte("sales_date", NON_ADMIN_SALES_START_DATE);
  const { data: invoices, error: invoiceError } = await invoiceQuery;
  if (invoiceError) return <main style={{ padding: 32, color: "#dc2626" }}>{invoiceError.message}</main>;

  const invoiceIds = (invoices ?? []).map((item) => String(item.id));
  const invoiceNumbers = Array.from(new Set((invoices ?? []).map((item) => String(item.invoice_no))));
  const [collectionsResult, allocationsResult, whtResult] = await Promise.all([
    invoiceIds.length ? supabase.from("invoice_collections").select("invoice_id, amount, cash_fraction, wht_deducted_amount").in("invoice_id", invoiceIds).neq("payment_method", "CHEQUE") : Promise.resolve({ data: [], error: null }),
    invoiceIds.length ? supabase.from("cheque_allocations").select("invoice_id, cheque_id, allocated_amount, wht_deducted_amount").in("invoice_id", invoiceIds) : Promise.resolve({ data: [], error: null }),
    invoiceNumbers.length ? supabase.from("wht_collections").select("invoice_no, invoice_date, wht_amount, collected_amount").in("invoice_no", invoiceNumbers) : Promise.resolve({ data: [], error: null }),
  ]);
  const chequeIds = Array.from(new Set((allocationsResult.data ?? []).map((item: any) => String(item.cheque_id))));
  const chequesResult = chequeIds.length ? await supabase.from("customer_cheques").select("id, cheque_status").in("id", chequeIds) : { data: [], error: null };
  const error = collectionsResult.error || allocationsResult.error || whtResult.error || chequesResult.error;
  if (error) return <main style={{ padding: 32, color: "#dc2626" }}>{error.message}</main>;

  const payments = new Map<string, number>();
  const deductedWht = new Map<string, number>();
  const cashFractions = new Map<string, number>();
  (collectionsResult.data ?? []).forEach((item: any) => {
    payments.set(String(item.invoice_id), (payments.get(String(item.invoice_id)) ?? 0) + Number(item.amount || 0));
    cashFractions.set(String(item.invoice_id), (cashFractions.get(String(item.invoice_id)) ?? 0) + Number(item.cash_fraction || 0));
    deductedWht.set(String(item.invoice_id), (deductedWht.get(String(item.invoice_id)) ?? 0) + Number(item.wht_deducted_amount || 0));
  });
  const chequeStatus = new Map((chequesResult.data ?? []).map((item: any) => [String(item.id), item.cheque_status]));
  (allocationsResult.data ?? []).forEach((item: any) => {
    if (chequeStatus.get(String(item.cheque_id)) === "COLLECTED") {
      payments.set(String(item.invoice_id), (payments.get(String(item.invoice_id)) ?? 0) + Number(item.allocated_amount || 0));
      deductedWht.set(String(item.invoice_id), (deductedWht.get(String(item.invoice_id)) ?? 0) + Number(item.wht_deducted_amount || 0));
    }
  });
  const wht = new Map<string, { expected: number; collected: number }>();
  (whtResult.data ?? []).forEach((item: any) => {
    const key = `${String(item.invoice_no)}|${String(item.invoice_date ?? "").slice(0, 10)}`;
    const current = wht.get(key) ?? { expected: 0, collected: 0 };
    current.expected += Number(item.wht_amount || 0);
    current.collected += Number(item.collected_amount || 0);
    wht.set(key, current);
  });
  const rows = (invoices ?? []).map((invoice: any) => {
    const key = `${String(invoice.invoice_no)}|${String(invoice.sales_date).slice(0, 10)}`;
    const recordedWht = wht.get(key);
    const expectedWht = Math.max(deductedWht.get(String(invoice.id)) ?? 0, recordedWht?.expected ?? 0);
    const collectedWht = recordedWht?.collected ?? 0;
    const customerPayments = payments.get(String(invoice.id)) ?? 0;
    const cashFraction = cashFractions.get(String(invoice.id)) ?? 0;
    return { ...invoice, expected_wht: expectedWht, collected_wht: collectedWht, customer_payments: customerPayments, cash_fraction: cashFraction, remaining_wht: Math.max(0, expectedWht - collectedWht), remaining_money: Math.max(0, Number(invoice.total_sales || 0) - expectedWht - customerPayments - cashFraction) };
  });
  return <CustomerBalanceClient customer={customer} invoices={rows} />;
}
