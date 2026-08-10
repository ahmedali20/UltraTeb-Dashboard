import { createClient } from "@supabase/supabase-js";
import { getCurrentDashboardUser } from "../../lib/current-dashboard-user";
import { hasDashboardPermission } from "../../lib/dashboard-permissions";
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
  const { data: invoices, error: invoicesError } = await invoiceQuery;
  const invoiceIds = (invoices ?? []).map((invoice) => String(invoice.id));
  const collectionsResult = invoiceIds.length
    ? await supabase.from("invoice_collections").select("*").in("invoice_id", invoiceIds).order("collection_date", { ascending: false }).order("id", { ascending: false })
    : { data: [], error: null };
  const error = invoicesError || collectionsResult.error;
  if (error) return <main style={{ padding: 32, color: "#dc2626" }}>{error.message}</main>;
  return <CollectionsClient invoices={invoices ?? []} initialCollections={collectionsResult.data ?? []} canEdit={Boolean(session && hasDashboardPermission(session, "collections", "edit"))} />;
}
