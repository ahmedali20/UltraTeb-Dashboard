import { createClient } from "@supabase/supabase-js";
import { getCurrentDashboardUser } from "../../lib/current-dashboard-user";
import { hasDashboardPermission } from "../../lib/dashboard-permissions";
import { canViewPre2026Sales, NON_ADMIN_SALES_START_DATE } from "../../lib/sales-visibility";
import ChequesClient from "./ChequesClient";

const supabase = createClient(process.env.SUPABASE_URL as string, process.env.SUPABASE_SERVICE_ROLE_KEY as string, { auth: { persistSession: false } });
export const revalidate = 0;

export default async function ChequesPage() {
  const session = await getCurrentDashboardUser();
  let invoiceQuery = supabase.from("sales_view").select("id").eq("document_type", "INVOICE");
  if (session?.salesRepName) invoiceQuery = invoiceQuery.eq("sales_rep", session.salesRepName);
  if (!canViewPre2026Sales(session)) invoiceQuery = invoiceQuery.gte("sales_date", NON_ADMIN_SALES_START_DATE);
  const { data: invoices, error: invoiceError } = await invoiceQuery;
  const visibleInvoiceIds = new Set((invoices ?? []).map((invoice) => String(invoice.id)));
  // Do not send every invoice ID through an `.in(...)` URL. Once the invoice
  // register became large, that URL exceeded PostgREST's request-size limit and
  // the Cheques page returned "Bad Request". Fetch allocations once and apply
  // the already-authorized invoice set locally instead.
  const allocationResult = await supabase
    .from("cheque_allocations")
    .select("id, cheque_id, invoice_id, invoice_no, allocated_amount");
  const visibleAllocations = (allocationResult.data ?? []).filter((allocation) =>
    visibleInvoiceIds.has(String(allocation.invoice_id)),
  );
  const chequeIds = Array.from(new Set(visibleAllocations.map((allocation) => allocation.cheque_id)));
  const result = chequeIds.length ? await supabase.from("customer_cheques").select("*").in("id", chequeIds).order("cheque_status_date", { ascending: false }).order("id", { ascending: false }) : { data: [], error: null };
  const allocationsByCheque = visibleAllocations.reduce((map, allocation) => { const list = map.get(allocation.cheque_id) ?? []; list.push(allocation); map.set(allocation.cheque_id, list); return map; }, new Map<number, any[]>());
  const cheques = (result.data ?? []).map((cheque) => ({ ...cheque, allocations: allocationsByCheque.get(cheque.id) ?? [] }));
  const error = invoiceError || allocationResult.error || result.error;
  if (error) return <main style={{ padding: 32, color: "#dc2626" }}>{error.message}</main>;
  return <ChequesClient initialCheques={cheques} canEdit={Boolean(session && hasDashboardPermission(session, "cheques", "edit"))} />;
}
