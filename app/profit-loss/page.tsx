import { createClient } from "@supabase/supabase-js";
import ProfitLossClient from "./ProfitLossClient";
import { getCurrentDashboardUser } from "../../lib/current-dashboard-user";
import { canViewPre2026Sales, NON_ADMIN_SALES_START_DATE } from "../../lib/sales-visibility";

const supabase = createClient(
  process.env.SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string,
  { auth: { persistSession: false } }
);

export const revalidate = 0;

export default async function ProfitLossPage() {
  const session = await getCurrentDashboardUser();
  let salesQuery = supabase
    .from("sales_view")
    .select("id, invoice_no, sales_date, month, customer_name, sales_rep, sales_item_total, document_type, original_invoice_no")
    .order("sales_date", { ascending: false });
  let cogsQuery = supabase
    .from("invoice_cogs")
    .select("id, invoice_no, document_type, cogs_subtotal")
    .order("sales_date", { ascending: false });

  if (!canViewPre2026Sales(session)) {
    salesQuery = salesQuery.gte("sales_date", NON_ADMIN_SALES_START_DATE);
    cogsQuery = cogsQuery.gte("sales_date", NON_ADMIN_SALES_START_DATE);
  }
  if (session?.salesRepName) salesQuery = salesQuery.eq("sales_rep", session.salesRepName);

  const [salesResult, cogsResult] = await Promise.all([salesQuery, cogsQuery]);
  if (salesResult.error) return <main style={{ padding: 32, color: "#dc2626" }}>Sales Error: {salesResult.error.message}</main>;
  if (cogsResult.error) return <main style={{ padding: 32, color: "#dc2626" }}>COGS Error: {cogsResult.error.message}</main>;

  const visibleKeys = new Set((salesResult.data ?? []).map((item) => `${item.document_type ?? "INVOICE"}:${item.invoice_no}`));
  const visibleCogs = (cogsResult.data ?? []).filter((item) => visibleKeys.has(`${item.document_type ?? "INVOICE"}:${item.invoice_no}`));
  return <ProfitLossClient sales={salesResult.data ?? []} cogs={visibleCogs} />;
}
