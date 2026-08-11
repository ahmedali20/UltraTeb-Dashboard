import { createClient } from "@supabase/supabase-js";
import WhtClient from "./WhtClient";
import { getCurrentDashboardUser } from "../../lib/current-dashboard-user";
import { canViewPre2026Sales, NON_ADMIN_SALES_START_DATE } from "../../lib/sales-visibility";

const supabase = createClient(
  process.env.SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string,
  { auth: { persistSession: false } }
);

export const revalidate = 0;

export default async function WhtPage() {
  const session = await getCurrentDashboardUser();
  let recordsQuery = supabase.from("wht_collections").select("*").order("invoice_date", { ascending: false });
  let invoicesQuery = supabase
    .from("sales_view")
    .select("invoice_no, customer_name, sales_date, sales_item_total, tax")
    .eq("document_type", "INVOICE")
    .order("sales_date", { ascending: false });
  if (!canViewPre2026Sales(session)) {
    recordsQuery = recordsQuery.gte("invoice_date", NON_ADMIN_SALES_START_DATE);
    invoicesQuery = invoicesQuery.gte("sales_date", NON_ADMIN_SALES_START_DATE);
  }
  const [
    { data: customers, error: customersError },
    { data: records, error: recordsError },
    { data: invoices, error: invoicesError },
  ] =
    await Promise.all([
      supabase.from("customers").select("customer_name").order("customer_name"),
      recordsQuery,
      invoicesQuery,
    ]);

  const error = customersError || recordsError || invoicesError;
  if (error) {
    return <main style={{ padding: 32, color: "#dc2626" }}>{error.message}</main>;
  }

  return (
    <WhtClient
      customers={Array.from(new Set((customers ?? []).map((item) => item.customer_name).filter(Boolean)))}
      initialRecords={records ?? []}
      invoices={invoices ?? []}
    />
  );
}
