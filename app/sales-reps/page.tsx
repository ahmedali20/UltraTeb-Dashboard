import { createClient } from "@supabase/supabase-js";
import SalesRepsClient from "./SalesRepsClient";
import { getCurrentDashboardUser } from "../../lib/current-dashboard-user";

const supabaseServer = createClient(
  process.env.SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string,
  { auth: { persistSession: false } }
);

export const revalidate = 0;

export default async function SalesRepsPage() {
  const session = await getCurrentDashboardUser();
  const repName = session?.salesRepName ?? null;
  let salesQuery = supabaseServer.from("sales_view").select("id, invoice_no, sales_date, month, sales_rep, customer_name, sales_item_total, tax, total_sales").order("sales_date", { ascending: false });
  let repsQuery = supabaseServer.from("sales_reps").select("id, name").order("name", { ascending: true });
  if (repName) {
    salesQuery = salesQuery.eq("sales_rep", repName);
    repsQuery = repsQuery.eq("name", repName);
  }
  const [
    { data, error },
    { data: managedReps, error: repsError },
  ] = await Promise.all([
    salesQuery,
    repsQuery,
  ]);

  if (error || repsError) {
    return (
      <main style={{ padding: 32, color: "red" }}>
        {(error || repsError)?.message}
      </main>
    );
  }

  return <SalesRepsClient sales={data ?? []} managedReps={managedReps ?? []} />;
}
