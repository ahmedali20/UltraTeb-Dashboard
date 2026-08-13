import { createClient } from "@supabase/supabase-js";
import HomeClient from "./HomeClient";
import { getCurrentDashboardUser } from "../lib/current-dashboard-user";
import { canViewPre2026Sales, NON_ADMIN_SALES_START_DATE } from "../lib/sales-visibility";

const supabaseServer = createClient(
  process.env.SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string,
  { auth: { persistSession: false } }
);

export const revalidate = 0;

export default async function HomePage() {
  const session = await getCurrentDashboardUser();
  const repName = session?.salesRepName ?? null;
  let salesQuery = supabaseServer
    .from("sales_view")
    .select("id, invoice_no, sales_date, customer_code, customer_name, sales_rep, sales_item_total, tax, total_sales, document_type")
    .order("sales_date", { ascending: false });
  let customersQuery = supabaseServer.from("customers").select("*", { count: "exact", head: true });
  if (!canViewPre2026Sales(session)) salesQuery = salesQuery.gte("sales_date", NON_ADMIN_SALES_START_DATE);
  if (repName) {
    salesQuery = salesQuery.eq("sales_rep", repName);
    customersQuery = customersQuery.eq("sales_rep_name", repName);
  }
  const [
    { data: sales, error: salesError },
    { count: customerCount, error: customersError },
  ] = await Promise.all([
    salesQuery,
    customersQuery,
  ]);

  const error = salesError || customersError;

  if (error) {
    return (
      <main style={{ padding: 32 }}>
        <h1>Error Loading Dashboard</h1>
        <p style={{ color: "red" }}>{error.message}</p>
      </main>
    );
  }

  return (
    <HomeClient
      sales={sales ?? []}
      customerCount={customerCount ?? 0}
    />
  );
}
