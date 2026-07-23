import { createClient } from "@supabase/supabase-js";
import CustomersTable from "../CustomersTable";

const supabaseServer = createClient(
  process.env.SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string,
  { auth: { persistSession: false } }
);

export const revalidate = 0;

export default async function CustomersPage() {
  const [
    { data: customers, error },
    { data: salesReps, error: repsError },
  ] = await Promise.all([
    supabaseServer
      .from("customers")
      .select("*")
      .order("customer_code", { ascending: true }),
    supabaseServer
      .from("sales_reps")
      .select("name")
      .order("name", { ascending: true }),
  ]);

  if (error || repsError) {
    return (
      <main style={{ padding: 32 }}>
        <h1>Error Loading Data</h1>
        <p style={{ color: "red" }}>{(error || repsError)?.message}</p>
      </main>
    );
  }

  return (
    <CustomersTable
      customers={customers ?? []}
      salesReps={(salesReps ?? []).map((rep) => rep.name)}
    />
  );
}
