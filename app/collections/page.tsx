import { createClient } from "@supabase/supabase-js";
import { getCurrentDashboardUser } from "../../lib/current-dashboard-user";
import { hasDashboardPermission } from "../../lib/dashboard-permissions";
import { canViewPre2026Sales, NON_ADMIN_SALES_START_DATE } from "../../lib/sales-visibility";
import CollectionsClient from "./CollectionsClient";

const supabase = createClient(
  process.env.SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string,
  { auth: { persistSession: false } }
);

export const revalidate = 0;

export default async function CollectionsPage() {
  const session = await getCurrentDashboardUser();
  let invoiceQuery = supabase.from("sales_view").select("id, invoice_no, customer_code, customer_name, sales_date, due_date, total_sales, sales_rep").eq("document_type", "INVOICE").order("sales_date", { ascending: false });
  if (session?.salesRepName) invoiceQuery = invoiceQuery.eq("sales_rep", session.salesRepName);
  if (!canViewPre2026Sales(session)) invoiceQuery = invoiceQuery.gte("sales_date", NON_ADMIN_SALES_START_DATE);
  const { data: invoices, error: invoicesError } = await invoiceQuery;
  const invoiceIds = (invoices ?? []).map((invoice) => String(invoice.id));
  const collectionsResult = invoiceIds.length
    ? await supabase.from("invoice_collections").select("*").in("invoice_id", invoiceIds).order("collection_date", { ascending: false }).order("id", { ascending: false })
    : { data: [], error: null };
  const invoiceNumbers = (invoices ?? []).map((invoice) => String(invoice.invoice_no));
  let whtQuery = supabase.from("wht_collections").select("invoice_no, collected_amount").in("invoice_no", invoiceNumbers);
  if (!canViewPre2026Sales(session)) whtQuery = whtQuery.gte("invoice_date", NON_ADMIN_SALES_START_DATE);
  const whtResult = invoiceNumbers.length
    ? await whtQuery
    : { data: [], error: null };
  const error = invoicesError || collectionsResult.error || whtResult.error;
  if (error) return <main style={{ padding: 32, color: "#dc2626" }}>{error.message}</main>;
  return <CollectionsClient invoices={invoices ?? []} initialCollections={collectionsResult.data ?? []} initialWht={whtResult.data ?? []} canEdit={Boolean(session && hasDashboardPermission(session, "collections", "edit"))} />;
}
