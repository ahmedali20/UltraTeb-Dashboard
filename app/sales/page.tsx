import { createClient } from "@supabase/supabase-js";
import SalesTable from "./SalesTable";

const supabaseServer = createClient(
  process.env.SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string,
  { auth: { persistSession: false } }
);

export const revalidate = 0;

export default async function SalesPage() {
  const [
    { data: sales, error: salesError },
    { data: customers, error: customersError },
    { data: salesReps, error: salesRepsError },
  ] = await Promise.all([
    supabaseServer
      .from("sales_view")
      .select("*")
      .order("sales_date", { ascending: false }),
    supabaseServer
      .from("customers")
      .select("customer_code, customer_name, sales_rep_name")
      .order("customer_code", { ascending: true }),
    supabaseServer
      .from("sales_reps")
      .select("name")
      .order("name", { ascending: true }),
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
    />
  );
}
