import { createClient } from "@supabase/supabase-js";
import SalesTable from "./SalesTable";
import { getCurrentDashboardUser } from "../../lib/current-dashboard-user";
import { canViewPre2026Sales, NON_ADMIN_SALES_START_DATE } from "../../lib/sales-visibility";

const supabaseServer = createClient(
  process.env.SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string,
  { auth: { persistSession: false } }
);

export const revalidate = 0;

export default async function SalesPage() {
  const session = await getCurrentDashboardUser();
  const repName = session?.salesRepName ?? null;
  let salesQuery = supabaseServer.from("sales_view").select("*").order("sales_date", { ascending: false });
  let customersQuery = supabaseServer.from("customers").select("customer_code, customer_name, sales_rep_name, payment_terms_days").order("customer_code", { ascending: true });
  let repsQuery = supabaseServer.from("sales_reps").select("name").order("name", { ascending: true });
  if (!canViewPre2026Sales(session)) salesQuery = salesQuery.gte("sales_date", NON_ADMIN_SALES_START_DATE);
  if (repName) {
    salesQuery = salesQuery.eq("sales_rep", repName);
    customersQuery = customersQuery.eq("sales_rep_name", repName);
    repsQuery = repsQuery.eq("name", repName);
  }
  const [
    { data: sales, error: salesError },
    { data: customers, error: customersError },
    { data: salesReps, error: salesRepsError },
    { data: syncStatus },
  ] = await Promise.all([
    salesQuery,
    customersQuery,
    repsQuery,
    supabaseServer
      .from("dashboard_settings")
      .select("value")
      .eq("key", "google_sheet_last_success")
      .maybeSingle(),
  ]);

  const error = salesError || customersError || salesRepsError;

  if (error) {
    return (
      <main style={{ padding: 32 }}>
        <h1>Error Loading Data</h1>
        <p style={{ color: "red" }}>{error.message}</p>
      </main>
    );
  }

  return (
    <SalesTable
      sales={sales ?? []}
      customers={customers ?? []}
      salesReps={(salesReps ?? []).map((rep) => rep.name)}
      lastSuccessfulSync={syncStatus?.value ?? null}
    />
  );
}
