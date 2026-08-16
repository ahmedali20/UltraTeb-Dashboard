import { createClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";
import { getCurrentDashboardUser } from "../../../lib/current-dashboard-user";
import { canViewPre2026Sales, NON_ADMIN_SALES_START_DATE } from "../../../lib/sales-visibility";
import ChequeDetailsClient from "./ChequeDetailsClient";

const supabase = createClient(process.env.SUPABASE_URL as string, process.env.SUPABASE_SERVICE_ROLE_KEY as string, { auth: { persistSession: false } });
export const revalidate = 0;

export default async function ChequeDetailsPage({ params }: { params: { id: string } }) {
  const session = await getCurrentDashboardUser();
  const chequeId = Number(params.id);
  if (!Number.isSafeInteger(chequeId) || chequeId <= 0) notFound();
  const { data: cheque } = await supabase.from("customer_cheques").select("*").eq("id", chequeId).maybeSingle();
  if (!cheque) notFound();
  const { data: allocations, error: allocationError } = await supabase.from("cheque_allocations").select("id, invoice_id, invoice_no, allocated_amount, wht_deducted_amount").eq("cheque_id", chequeId).order("id");
  if (allocationError || !allocations?.length) notFound();
  const invoiceIds = allocations.map((allocation) => String(allocation.invoice_id));
  let invoiceQuery = supabase.from("sales_view").select("id, invoice_no, sales_date, due_date, customer_name, total_sales, sales_rep").in("id", invoiceIds).eq("document_type", "INVOICE");
  if (session?.salesRepName) invoiceQuery = invoiceQuery.eq("sales_rep", session.salesRepName);
  if (!canViewPre2026Sales(session)) invoiceQuery = invoiceQuery.gte("sales_date", NON_ADMIN_SALES_START_DATE);
  const { data: invoices, error: invoiceError } = await invoiceQuery;
  if (invoiceError || (invoices ?? []).length !== invoiceIds.length) notFound();
  const invoiceMap = new Map((invoices ?? []).map((invoice) => [String(invoice.id), invoice]));
  const rows = allocations.map((allocation) => ({ ...allocation, invoice: invoiceMap.get(String(allocation.invoice_id)) }));
  return <ChequeDetailsClient cheque={cheque} allocations={rows} />;
}
