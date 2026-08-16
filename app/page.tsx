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

const SALES_PAGE_SIZE = 1000;

async function fetchAllHomeSales(canViewHistoricalSales: boolean, repName: string | null) {
  const rows: any[] = [];
  for (let from = 0; ; from += SALES_PAGE_SIZE) {
    let query = supabaseServer
      .from("sales_view")
      .select("id, invoice_no, sales_date, customer_code, customer_name, sales_rep, sales_item_total, tax, total_sales, document_type")
      .order("sales_date", { ascending: false })
      .order("id", { ascending: false })
      .range(from, from + SALES_PAGE_SIZE - 1);
    if (!canViewHistoricalSales) query = query.gte("sales_date", NON_ADMIN_SALES_START_DATE);
    if (repName) query = query.eq("sales_rep", repName);
    const { data, error } = await query;
    if (error) return { data: null, error };
    const batch = data ?? [];
    rows.push(...batch);
    if (batch.length < SALES_PAGE_SIZE) break;
  }
  return { data: rows, error: null };
}

export default async function HomePage() {
  const session = await getCurrentDashboardUser();
  const repName = session?.salesRepName ?? null;
  let customersQuery = supabaseServer.from("customers").select("*", { count: "exact", head: true });
  if (repName) {
    customersQuery = customersQuery.eq("sales_rep_name", repName);
  }
  const [
    { data: sales, error: salesError },
    { count: customerCount, error: customersError },
  ] = await Promise.all([
    fetchAllHomeSales(canViewPre2026Sales(session), repName),
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
