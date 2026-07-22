import { createClient } from "@supabase/supabase-js";
import CustomersTable from "../CustomersTable";

const supabaseServer = createClient(
  process.env.SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string,
  { auth: { persistSession: false } }
);

export const revalidate = 0;

export default async function CustomersPage() {
  const { data: customers, error } = await supabaseServer
    .from("customers")
    .select("*")
    .order("customer_code", { ascending: true });

  if (error) {
    return (
      <main style={{ padding: 32 }}>
        <h1>Error Loading Data</h1>
        <p style={{ color: "red" }}>{error.message}</p>
      </main>
    );
  }

  return <CustomersTable customers={customers ?? []} />;
}