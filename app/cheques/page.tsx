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
  const ids = (invoices ?? []).map((invoice) => String(invoice.id));
  const result = ids.length ? await supabase.from("invoice_collections").select("*").eq("payment_method", "CHEQUE").in("invoice_id", ids).order("cheque_status_date", { ascending: false }).order("id", { ascending: false }) : { data: [], error: null };
  const error = invoiceError || result.error;
  if (error) return <main style={{ padding: 32, color: "#dc2626" }}>{error.message}</main>;
  return <ChequesClient initialCheques={result.data ?? []} canEdit={Boolean(session && hasDashboardPermission(session, "cheques", "edit"))} />;
}
